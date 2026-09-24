use arkana_ore_vault_api::prelude::*;
use steel::*;

/// Swaps SKR from user into the vault pool and opens a new 365-day ORE staking tranche.
/// All fees and rent are paid by the user.
pub fn process_swap_and_deposit_tranche(accounts: &[AccountInfo<'_>], data: &[u8]) -> ProgramResult {
    let args = SwapAndDepositTranche::try_from_bytes(data)?;
    let skr_amount = u64::from_le_bytes(args.skr_amount);
    if skr_amount == 0 {
        return Err(ArkanaVaultError::ZeroDeposit.into());
    }

    let clock = Clock::get()?;
    let [
        signer_info,
        config_info,
        vault_authority_info,
        user_vault_info,
        tranche_info,
        user_skr_info,
        vault_skr_info,
        vault_tokens_info,
        skr_mint_info,
        ore_mint_info,
        system_program,
        token_program,
        associated_token_program,
    ] = accounts
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

    let (vault_auth_addr, _) = vault_authority_pda();
    vault_authority_info.has_address(&vault_auth_addr)?;

    ore_mint_info.has_address(&config.ore_mint)?.as_mint()?;

    user_skr_info.as_associated_token_account(signer_info.key, skr_mint_info.key)?;
    vault_skr_info.as_associated_token_account(&vault_auth_addr, skr_mint_info.key)?;
    vault_tokens_info.as_associated_token_account(&vault_auth_addr, &config.ore_mint)?;

    // Rate: 1 SKR (9 dec = 1_000_000_000) = 1 ORE (11 dec = 100_000_000_000)
    // Ratio: ore_amount = skr_amount * 100
    let ore_amount = skr_amount
        .checked_mul(100)
        .ok_or(ArkanaVaultError::MathOverflow)?;

    // 1. Transfer SKR from user to vault pool
    transfer(
        signer_info,
        user_skr_info,
        vault_skr_info,
        token_program,
        skr_amount,
    )?;

    // 2. Initialize or load UserVault
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
        user_vault.total_staked_ore = 0;
        user_vault.total_yield_claimed = 0;
    }

    let user_vault =
        user_vault_info.as_account_mut::<UserVault>(&arkana_ore_vault_api::ID)?;
    let next_tranche_id = user_vault
        .tranche_count
        .checked_add(1)
        .ok_or(ArkanaVaultError::MathOverflow)?;

    // 3. Create the new Tranche PDA
    let (tranche_addr, _) = tranche_pda(signer_info.key, next_tranche_id);
    tranche_info.has_address(&tranche_addr)?;

    create_program_account::<Tranche>(
        tranche_info,
        system_program,
        signer_info,
        &arkana_ore_vault_api::ID,
        &[
            TRANCHE_SEED,
            signer_info.key.as_ref(),
            &next_tranche_id.to_le_bytes(),
        ],
    )?;

    // 4. Baseline rewards factor from VaultConfig
    let current_rewards_factor = config.rewards_factor;

    // 5. Populate Tranche State
    let tranche = tranche_info.as_account_mut::<Tranche>(&arkana_ore_vault_api::ID)?;
    tranche.owner = *signer_info.key;
    tranche.tranche_id = next_tranche_id;
    tranche.is_matured = 0;
    tranche.deposited_amount = ore_amount;
    tranche.deposited_at = clock.unix_timestamp;
    tranche.expires_at = clock
        .unix_timestamp
        .checked_add(TRANCHE_LOCK_DURATION_SECONDS)
        .ok_or(ArkanaVaultError::MathOverflow)?;
    tranche.rewards_factor_at_deposit = current_rewards_factor;
    tranche.last_rewards_factor = current_rewards_factor;
    tranche.claimed_rewards = 0;

    // 6. Update aggregates
    user_vault.tranche_count = next_tranche_id;
    user_vault.total_staked_ore = user_vault
        .total_staked_ore
        .checked_add(ore_amount)
        .ok_or(ArkanaVaultError::MathOverflow)?;

    config.total_staked_ore = config
        .total_staked_ore
        .checked_add(ore_amount)
        .ok_or(ArkanaVaultError::MathOverflow)?;
    config.total_tranches_count = config
        .total_tranches_count
        .checked_add(1)
        .ok_or(ArkanaVaultError::MathOverflow)?;

    Ok(())
}
