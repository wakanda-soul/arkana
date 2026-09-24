use arkana_ore_vault_api::prelude::*;
use steel::*;

/// Injects reward ORE into the staking pool, increasing rewards_factor for all active stakers.
pub fn process_distribute_reward(accounts: &[AccountInfo<'_>], data: &[u8]) -> ProgramResult {
    let args = DistributeReward::try_from_bytes(data)?;
    let amount = u64::from_le_bytes(args.amount);
    if amount == 0 {
        return Err(ProgramError::InvalidArgument);
    }

    let [signer_info, config_info, vault_authority_info, vault_tokens_info, user_tokens_info, ore_mint_info, token_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    signer_info.is_signer()?;
    token_program.is_program(&spl_token::ID)?;

    let (config_addr, _) = config_pda();
    config_info.has_address(&config_addr)?;
    let config = config_info.as_account_mut::<VaultConfig>(&arkana_ore_vault_api::ID)?;

    ore_mint_info.has_address(&config.ore_mint)?.as_mint()?;

    let (vault_auth_addr, _) = vault_authority_pda();
    vault_authority_info.has_address(&vault_auth_addr)?;

    user_tokens_info.as_associated_token_account(signer_info.key, &config.ore_mint)?;
    vault_tokens_info.as_associated_token_account(&vault_auth_addr, &config.ore_mint)?;

    // 1. Transfer reward ORE from payer to vault_tokens
    transfer(
        signer_info,
        user_tokens_info,
        vault_tokens_info,
        token_program,
        amount,
    )?;

    // 2. Increase rewards_factor proportionally to total staked ORE
    if config.total_staked_ore > 0 {
        let delta = Numeric::from_u64(amount) / Numeric::from_u64(config.total_staked_ore);
        config.rewards_factor += delta;
    }

    Ok(())
}
