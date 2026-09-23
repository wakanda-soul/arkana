use arkana_ore_vault_api::prelude::*;
use ore_mint_api::consts::MINT_ADDRESS;
use steel::*;

/// Harvests a matured tranche (>= 365 days) and transfers the principal ORE
/// permanently to the Arkana Treasury.
///
/// Security:
/// - Strictly requires clock.unix_timestamp >= tranche.expires_at
/// - Strictly requires recipient to be the hardcoded Arkana Treasury ATA
/// - Cannot be called twice on the same tranche
pub fn process_harvest_matured_tranche(
    accounts: &[AccountInfo<'_>],
    data: &[u8],
) -> ProgramResult {
    let args = HarvestMaturedTranche::try_from_bytes(data)?;
    let tranche_id = u32::from_le_bytes(args.tranche_id);

    let clock = Clock::get()?;
    let [signer_info, config_info, vault_authority_info, user_vault_info, tranche_info, treasury_info, treasury_tokens_info, vault_tokens_info, ore_mint_info, ore_stake_program, ore_stake_treasury_info, ore_stake_info, ore_stake_tokens_info, ore_stake_vesting_info, system_program, token_program, associated_token_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // Assertions
    signer_info.is_signer()?;
    ore_mint_info.has_address(&MINT_ADDRESS)?.as_mint()?;
    system_program.is_program(&system_program::ID)?;
    token_program.is_program(&spl_token::ID)?;
    associated_token_program.is_program(&spl_associated_token_account::ID)?;
    ore_stake_program.is_program(&ore_stake_api::ID)?;

    let (config_addr, _) = config_pda();
    config_info.has_address(&config_addr)?;
    let config = config_info.as_account_mut::<VaultConfig>(&arkana_ore_vault_api::ID)?;

    // Strict Treasury Address Validation: must match verified treasury in Config and ARKANA_TREASURY_ADDRESS
    treasury_info.has_address(&config.treasury)?;
    treasury_info.has_address(&ARKANA_TREASURY_ADDRESS)?;

    let (vault_auth_addr, vault_auth_bump) = vault_authority_pda();
    vault_authority_info.has_address(&vault_auth_addr)?;

    let user_vault = user_vault_info.as_account_mut::<UserVault>(&arkana_ore_vault_api::ID)?;
    let tranche = tranche_info.as_account_mut::<Tranche>(&arkana_ore_vault_api::ID)?;

    // 1. Verify Tranche ID & Status
    if tranche.tranche_id != tranche_id {
        return Err(ProgramError::InvalidAccountData);
    }
    if tranche.is_matured != 0 {
        return Err(ArkanaVaultError::TrancheAlreadyMatured.into());
    }

    // 2. Strict 365-day Locking Period Check
    if clock.unix_timestamp < tranche.expires_at {
        return Err(ArkanaVaultError::TrancheNotMatured.into());
    }

    // 3. Ensure Treasury ATA exists and belongs to the Arkana Treasury
    if treasury_tokens_info.data_is_empty() {
        create_associated_token_account(
            signer_info,
            treasury_info,
            treasury_tokens_info,
            ore_mint_info,
            system_program,
            token_program,
            associated_token_program,
        )?;
    } else {
        treasury_tokens_info.as_associated_token_account(treasury_info.key, &MINT_ADDRESS)?;
    }

    vault_tokens_info.as_associated_token_account(&vault_auth_addr, &MINT_ADDRESS)?;

    let amount = tranche.deposited_amount;

    // 4. Withdraw principal from native ore-stake to vault_tokens via CPI
    invoke_signed(
        &ore_stake_api::sdk::withdraw(vault_auth_addr, amount),
        &[
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

    // 5. Transfer principal ORE directly into Arkana Treasury ATA
    transfer_signed(
        vault_authority_info,
        vault_tokens_info,
        treasury_tokens_info,
        token_program,
        amount,
        &[VAULT_AUTHORITY_SEED, &[vault_auth_bump]],
    )?;

    // 6. Mark Tranche as matured and update aggregates
    tranche.is_matured = 1;

    user_vault.total_staked_ore = user_vault.total_staked_ore.saturating_sub(amount);
    config.total_staked_ore = config.total_staked_ore.saturating_sub(amount);
    config.total_matured_ore = config
        .total_matured_ore
        .checked_add(amount)
        .ok_or(ArkanaVaultError::MathOverflow)?;

    Ok(())
}
