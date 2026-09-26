use arkana_ore_vault_api::prelude::*;
use steel::*;

/// Deposits ORE into a new 365-day staking tranche.
/// All fees and rent are paid by the user. Arkana pays 0.
pub fn process_deposit_tranche(accounts: &[AccountInfo<'_>], data: &[u8]) -> ProgramResult {
    let args = DepositTranche::try_from_bytes(data)?;
    let amount = u64::from_le_bytes(args.amount);
    if amount == 0 {
        return Err(ArkanaVaultError::ZeroDeposit.into());
    }

    let clock = Clock::get()?;
    let [signer_info, config_info, vault_authority_info, user_vault_info, tranche_info, user_tokens_info, vault_tokens_info, ore_mint_info, system_program, token_program, associated_token_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // Security & Address assertions
    signer_info.is_signer()?;
    system_program.is_program(&system_program::ID)?;
    token_program.is_program(&spl_token::ID)?;
    associated_token_program.is_program(&spl_associated_token_account::ID)?;

    let (config_addr, _) = config_pda();
    config_info.has_address(&config_addr)?;
    let config = config_info.as_account_mut::<VaultConfig>(&arkana_ore_vault_api::ID)?;
    if config.is_initialized == 0 {
        return Err(ProgramError::UninitializedAccount);
    }

    ore_mint_info.has_address(&config.ore_mint)?.as_mint()?;

    let (vault_auth_addr, _) = vault_authority_pda();
    vault_authority_info.has_address(&vault_auth_addr)?;

    user_tokens_info.as_associated_token_account(signer_info.key, &config.ore_mint)?;
    vault_tokens_info.as_associated_token_account(&vault_auth_addr, &config.ore_mint)?;

    // 1. Initialize or load UserVault
    let (user_vault_addr, _) = user_vault_pda(signer_info.key);
    user_vault_info.has_address(&user_vault_addr)?;

    if user_vault_info.data_is_empty() {
        create_program_account::<UserVault>(
            user_vault_info,
            system_program,
            signer_info,
            &arkana_ore_vault_api::ID,
            &[USER_VAULT_SEED, signer_info.key.as_ref()],
        )?;
        let user_vault =
            user_vault_info.as_account_mut::<UserVault>(&arkana_ore_vault_api::ID)?;
        user_vault.owner = *signer_info.key;
        user_vault.tranche_count = 0;
        user_vault.last_deposit_day = 0;
        user_vault.total_staked_ore = 0;
        user_vault.total_yield_claimed = 0;
    }

    let user_vault =
        user_vault_info.as_account_mut::<UserVault>(&arkana_ore_vault_api::ID)?;
    let today = (clock.unix_timestamp / 86400) as u32;

    let is_same_day = user_vault.tranche_count > 0 && user_vault.last_deposit_day == today;
    let target_tranche_id = if is_same_day {
        user_vault.tranche_count
    } else {
        user_vault
            .tranche_count
            .checked_add(1)
            .ok_or(ArkanaVaultError::MathOverflow)?
    };

    // 2. Validate Tranche PDA address
    let (tranche_addr, _) = tranche_pda(signer_info.key, target_tranche_id);
    tranche_info.has_address(&tranche_addr)?;

    // 3. Baseline rewards factor from VaultConfig
    let current_rewards_factor = config.rewards_factor;

    if tranche_info.data_is_empty() {
        // First deposit of the day: create new Tranche account (pays 1-time rent for the day)
        create_program_account::<Tranche>(
            tranche_info,
            system_program,
            signer_info,
            &arkana_ore_vault_api::ID,
            &[
                TRANCHE_SEED,
                signer_info.key.as_ref(),
                &target_tranche_id.to_le_bytes(),
            ],
        )?;

        let tranche = tranche_info.as_account_mut::<Tranche>(&arkana_ore_vault_api::ID)?;
        tranche.owner = *signer_info.key;
        tranche.tranche_id = target_tranche_id;
        tranche.is_matured = 0;
        tranche.deposited_amount = amount;
        tranche.deposited_at = clock.unix_timestamp;
        tranche.expires_at = clock
            .unix_timestamp
            .checked_add(TRANCHE_LOCK_DURATION_SECONDS)
            .ok_or(ArkanaVaultError::MathOverflow)?;
        tranche.rewards_factor_at_deposit = current_rewards_factor;
        tranche.last_rewards_factor = current_rewards_factor;
        tranche.claimed_rewards = 0;

        user_vault.tranche_count = target_tranche_id;
        user_vault.last_deposit_day = today;
        config.total_tranches_count = config
            .total_tranches_count
            .checked_add(1)
            .ok_or(ArkanaVaultError::MathOverflow)?;
    } else {
        // Subsequent deposit on the same day: Top-up existing Tranche account (0 rent!)
        let tranche = tranche_info.as_account_mut::<Tranche>(&arkana_ore_vault_api::ID)?;
        if tranche.owner != *signer_info.key {
            return Err(ArkanaVaultError::Unauthorized.into());
        }
        if tranche.tranche_id != target_tranche_id {
            return Err(ProgramError::InvalidAccountData);
        }
        if tranche.is_matured != 0 {
            return Err(ArkanaVaultError::TrancheAlreadyMatured.into());
        }

        // Settle accrued yield on old balance before adding new principal
        if current_rewards_factor > tranche.last_rewards_factor {
            let factor_diff = current_rewards_factor - tranche.last_rewards_factor;
            let personal_rewards = factor_diff * Numeric::from_u64(tranche.deposited_amount);
            let reward_amount = personal_rewards.to_u64();
            if reward_amount > 0 {
                let (_, vault_auth_bump) = vault_authority_pda();
                transfer_signed_with_bump(
                    vault_authority_info,
                    vault_tokens_info,
                    user_tokens_info,
                    token_program,
                    reward_amount,
                    &[VAULT_AUTHORITY_SEED],
                    vault_auth_bump,
                )?;
                tranche.claimed_rewards = tranche
                    .claimed_rewards
                    .checked_add(reward_amount)
                    .ok_or(ArkanaVaultError::MathOverflow)?;
                user_vault.total_yield_claimed = user_vault
                    .total_yield_claimed
                    .checked_add(reward_amount)
                    .ok_or(ArkanaVaultError::MathOverflow)?;
                config.total_yield_distributed = config
                    .total_yield_distributed
                    .checked_add(reward_amount)
                    .ok_or(ArkanaVaultError::MathOverflow)?;
            }
            tranche.last_rewards_factor = current_rewards_factor;
        }

        // Top-up principal
        tranche.deposited_amount = tranche
            .deposited_amount
            .checked_add(amount)
            .ok_or(ArkanaVaultError::MathOverflow)?;
    }

    // 5. Transfer ORE from user to vault authority
    transfer(
        signer_info,
        user_tokens_info,
        vault_tokens_info,
        token_program,
        amount,
    )?;

    // 6. Update aggregates
    user_vault.total_staked_ore = user_vault
        .total_staked_ore
        .checked_add(amount)
        .ok_or(ArkanaVaultError::MathOverflow)?;

    config.total_staked_ore = config
        .total_staked_ore
        .checked_add(amount)
        .ok_or(ArkanaVaultError::MathOverflow)?;

    Ok(())
}
