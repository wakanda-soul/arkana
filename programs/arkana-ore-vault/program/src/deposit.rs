use arkana_ore_vault_api::prelude::*;
use ore_mint_api::consts::MINT_ADDRESS;
use ore_stake_api::state::Treasury as OreStakeTreasury;
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
    let [signer_info, config_info, vault_authority_info, user_vault_info, tranche_info, user_tokens_info, vault_tokens_info, ore_mint_info, ore_stake_program, ore_stake_treasury_info, ore_stake_info, ore_stake_tokens_info, ore_stake_vesting_info, system_program, token_program, associated_token_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // Security & Address assertions
    signer_info.is_signer()?;
    ore_mint_info.has_address(&MINT_ADDRESS)?.as_mint()?;
    system_program.is_program(&system_program::ID)?;
    token_program.is_program(&spl_token::ID)?;
    associated_token_program.is_program(&spl_associated_token_account::ID)?;
    ore_stake_program.is_program(&ore_stake_api::ID)?;

    let (config_addr, _) = config_pda();
    config_info.has_address(&config_addr)?;
    let config = config_info.as_account_mut::<VaultConfig>(&arkana_ore_vault_api::ID)?;
    if config.is_initialized == 0 {
        return Err(ProgramError::UninitializedAccount);
    }

    let (vault_auth_addr, vault_auth_bump) = vault_authority_pda();
    vault_authority_info.has_address(&vault_auth_addr)?;

    user_tokens_info.as_associated_token_account(signer_info.key, &MINT_ADDRESS)?;
    vault_tokens_info.as_associated_token_account(&vault_auth_addr, &MINT_ADDRESS)?;

    // 1. Initialize or load UserVault
    let (user_vault_addr, user_vault_bump) = user_vault_pda(signer_info.key);
    user_vault_info.has_address(&user_vault_addr)?;

    if user_vault_info.data_is_empty() {
        create_program_account::<UserVault>(
            user_vault_info,
            system_program,
            signer_info,
            &arkana_ore_vault_api::ID,
            &[USER_VAULT_SEED, signer_info.key.as_ref(), &[user_vault_bump]],
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
    let next_tranche_id = user_vault.tranche_count.checked_add(1).ok_or(ArkanaVaultError::MathOverflow)?;

    // 2. Create the new Tranche PDA
    let (tranche_addr, tranche_bump) = tranche_pda(signer_info.key, next_tranche_id);
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
            &[tranche_bump],
        ],
    )?;

    // 3. Query native ORE Staking rewards factor to set as baseline
    let ore_treasury = ore_stake_treasury_info
        .has_address(&ore_stake_api::state::treasury_pda().0)?
        .as_account::<OreStakeTreasury>(&ore_stake_api::ID)?;
    let current_rewards_factor = ore_treasury.rewards_factor;

    // 4. Populate Tranche State
    let tranche = tranche_info.as_account_mut::<Tranche>(&arkana_ore_vault_api::ID)?;
    tranche.owner = *signer_info.key;
    tranche.tranche_id = next_tranche_id;
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

    // 5. Transfer ORE from user to vault
    transfer(
        signer_info,
        user_tokens_info,
        vault_tokens_info,
        token_program,
        amount,
    )?;

    // 6. Deposit into native ore-stake on behalf of vault_authority
    // CPI call to ore-stake program
    invoke_signed(
        &ore_stake_api::sdk::deposit(vault_auth_addr, vault_auth_addr, amount, 0, 0),
        &[
            vault_authority_info.clone(),
            vault_authority_info.clone(),
            ore_mint_info.clone(),
            vault_tokens_info.clone(),
            ore_stake_info.clone(),
            ore_stake_tokens_info.clone(),
            ore_stake_treasury_info.clone(),
            ore_stake_vesting_info.clone(),
            system_program.clone(),
            token_program.clone(),
            associated_token_program.clone(),
            ore_stake_program.clone(),
        ],
        &arkana_ore_vault_api::ID,
        &[VAULT_AUTHORITY_SEED, &[vault_auth_bump]],
    )?;

    // 7. Update aggregates
    user_vault.tranche_count = next_tranche_id;
    user_vault.total_staked_ore = user_vault
        .total_staked_ore
        .checked_add(amount)
        .ok_or(ArkanaVaultError::MathOverflow)?;

    config.total_staked_ore = config
        .total_staked_ore
        .checked_add(amount)
        .ok_or(ArkanaVaultError::MathOverflow)?;
    config.total_tranches_count = config
        .total_tranches_count
        .checked_add(1)
        .ok_or(ArkanaVaultError::MathOverflow)?;

    Ok(())
}
