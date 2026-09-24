use arkana_ore_vault_api::prelude::*;
use steel::*;

/// Claims accrued ORE staking yield from an active tranche directly to user's wallet.
pub fn process_claim_tranche_yield(accounts: &[AccountInfo<'_>], data: &[u8]) -> ProgramResult {
    let args = ClaimTrancheYield::try_from_bytes(data)?;
    let tranche_id = u32::from_le_bytes(args.tranche_id);

    let [signer_info, config_info, vault_authority_info, user_vault_info, tranche_info, user_tokens_info, vault_tokens_info, ore_mint_info, token_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // Assertions
    signer_info.is_signer()?;
    token_program.is_program(&spl_token::ID)?;

    let (config_addr, _) = config_pda();
    config_info.has_address(&config_addr)?;
    let config = config_info.as_account_mut::<VaultConfig>(&arkana_ore_vault_api::ID)?;

    ore_mint_info.has_address(&config.ore_mint)?.as_mint()?;

    let (vault_auth_addr, vault_auth_bump) = vault_authority_pda();
    vault_authority_info.has_address(&vault_auth_addr)?;

    let (user_vault_addr, _) = user_vault_pda(signer_info.key);
    user_vault_info.has_address(&user_vault_addr)?;
    let user_vault = user_vault_info.as_account_mut::<UserVault>(&arkana_ore_vault_api::ID)?;

    let (tranche_addr, _) = tranche_pda(signer_info.key, tranche_id);
    tranche_info.has_address(&tranche_addr)?;
    let tranche = tranche_info.as_account_mut::<Tranche>(&arkana_ore_vault_api::ID)?;

    // Strict ownership verification
    if tranche.owner != *signer_info.key {
        return Err(ArkanaVaultError::Unauthorized.into());
    }

    user_tokens_info.as_associated_token_account(signer_info.key, &config.ore_mint)?;
    vault_tokens_info.as_associated_token_account(&vault_auth_addr, &config.ore_mint)?;

    // Read current rewards factor from VaultConfig
    let current_rewards_factor = config.rewards_factor;

    if current_rewards_factor <= tranche.last_rewards_factor {
        return Err(ArkanaVaultError::NoRewardsAvailable.into());
    }

    // Calculate accrued yield based on staked balance
    let factor_diff = current_rewards_factor - tranche.last_rewards_factor;
    let personal_rewards = factor_diff * Numeric::from_u64(tranche.deposited_amount);
    let reward_amount = personal_rewards.to_u64();

    if reward_amount == 0 {
        return Err(ArkanaVaultError::NoRewardsAvailable.into());
    }

    // Transfer rewards from vault_tokens to user_tokens signed by vault_authority PDA
    transfer_signed_with_bump(
        vault_authority_info,
        vault_tokens_info,
        user_tokens_info,
        token_program,
        reward_amount,
        &[VAULT_AUTHORITY_SEED],
        vault_auth_bump,
    )?;

    // Update records
    tranche.last_rewards_factor = current_rewards_factor;
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

    Ok(())
}
