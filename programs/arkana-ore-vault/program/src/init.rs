use arkana_ore_vault_api::prelude::*;
use steel::*;

/// Initializes the global vault configuration.
/// Can only be called once. Treasury address is strictly immutable.
pub fn process_initialize(accounts: &[AccountInfo<'_>], _data: &[u8]) -> ProgramResult {
    let [signer_info, config_info, vault_authority_info, vault_tokens_info, ore_mint_info, system_program, token_program, associated_token_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // Verify signers and addresses
    signer_info.is_signer()?;
    ore_mint_info.as_mint()?;
    system_program.is_program(&system_program::ID)?;
    token_program.is_program(&spl_token::ID)?;
    associated_token_program.is_program(&spl_associated_token_account::ID)?;

    let (config_addr, _bump) = config_pda();
    config_info.has_address(&config_addr)?;

    let (vault_auth_addr, auth_bump) = vault_authority_pda();
    vault_authority_info.has_address(&vault_auth_addr)?;

    // Prevent re-initialization
    if !config_info.data_is_empty() {
        return Err(ArkanaVaultError::AlreadyInitialized.into());
    }

    // Allocate and initialize Config account
    create_program_account::<VaultConfig>(
        config_info,
        system_program,
        signer_info,
        &arkana_ore_vault_api::ID,
        &[CONFIG_SEED],
    )?;

    let config = config_info.as_account_mut::<VaultConfig>(&arkana_ore_vault_api::ID)?;
    config.treasury = ARKANA_TREASURY_ADDRESS; // Hardcoded, untamperable
    config.ore_mint = *ore_mint_info.key;
    config.vault_authority_bump = auth_bump;
    config.is_initialized = 1;
    config.rewards_factor = Numeric::ZERO;
    config.total_staked_ore = 0;
    config.total_yield_distributed = 0;
    config.total_matured_ore = 0;
    config.total_tranches_count = 0;

    // Create the vault ATA if it doesn't already exist
    if vault_tokens_info.data_is_empty() {
        create_associated_token_account(
            signer_info,
            vault_authority_info,
            vault_tokens_info,
            ore_mint_info,
            system_program,
            token_program,
            associated_token_program,
        )?;
    } else {
        vault_tokens_info.as_associated_token_account(&vault_auth_addr, ore_mint_info.key)?;
    }

    Ok(())
}
