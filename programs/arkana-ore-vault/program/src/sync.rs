use arkana_ore_vault_api::prelude::*;
use steel::*;

use crate::stake::OreStakeAccounts;

/// Permissionless crank: claims pending ORE Stake yield into the vault (credited to all
/// tranches through rewards_factor) and stakes any principal that is not staked yet.
pub fn process_sync_stake(accounts: &[AccountInfo<'_>], _data: &[u8]) -> ProgramResult {
    let [signer_info, config_info, vault_authority_info, vault_tokens_info, ore_mint_info, system_program, token_program, associated_token_program, stake_info, stake_tokens_info, stake_treasury_info, stake_treasury_tokens_info, vesting_info, ore_stake_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    signer_info.is_signer()?;

    let (config_addr, _) = config_pda();
    config_info.has_address(&config_addr)?;
    let config = config_info.as_account_mut::<VaultConfig>(&arkana_ore_vault_api::ID)?;
    if config.is_initialized == 0 {
        return Err(ProgramError::UninitializedAccount);
    }
    ore_mint_info.has_address(&config.ore_mint)?.as_mint()?;

    let ore_stake = OreStakeAccounts {
        vault_authority: vault_authority_info,
        vault_tokens: vault_tokens_info,
        ore_mint: ore_mint_info,
        stake: stake_info,
        stake_tokens: stake_tokens_info,
        stake_treasury: stake_treasury_info,
        stake_treasury_tokens: stake_treasury_tokens_info,
        vesting: vesting_info,
        system_program,
        token_program,
        associated_token_program,
        ore_stake_program,
    };
    ore_stake.validate()?;
    ore_stake.sync_rewards(config)?;

    let idle_principal = config
        .total_staked_ore
        .saturating_sub(ore_stake.staked_balance()?);
    ore_stake.stake(signer_info, idle_principal)?;

    Ok(())
}
