use arkana_ore_vault_api::prelude::*;
use steel::*;

use crate::stake::OreStakeAccounts;

/// Harvests a matured tranche (>= 365 days).
///
/// Economics:
/// - Principal ORE is unstaked from ORE Stake and goes permanently to the Arkana Treasury.
/// - All unclaimed yield goes back to the tranche owner.
/// - The tranche account is closed and its rent SOL is refunded to the tranche owner.
///
/// Security:
/// - Strictly requires clock.unix_timestamp >= tranche.expires_at
/// - Treasury recipient must be the hardcoded Arkana Treasury
/// - Only the tranche owner or the Arkana Treasury (keeper) can invoke harvest
/// - Yield and rent always go to the tranche owner, never to the caller
/// - The tranche account is closed, so it cannot be harvested twice
pub fn process_harvest_matured_tranche(
    accounts: &[AccountInfo<'_>],
    data: &[u8],
) -> ProgramResult {
    let args = HarvestMaturedTranche::try_from_bytes(data)?;
    let tranche_id = u32::from_le_bytes(args.tranche_id);

    let clock = Clock::get()?;
    let [signer_info, config_info, vault_authority_info, user_vault_info, tranche_info, owner_info, owner_tokens_info, treasury_info, treasury_tokens_info, vault_tokens_info, ore_mint_info, system_program, token_program, associated_token_program, stake_info, stake_tokens_info, stake_treasury_info, stake_treasury_tokens_info, vesting_info, ore_stake_program] =
        accounts
    else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };

    // Assertions
    signer_info.is_signer()?;
    owner_info.is_writable()?;
    system_program.is_program(&system_program::ID)?;
    token_program.is_program(&spl_token::ID)?;
    associated_token_program.is_program(&spl_associated_token_account::ID)?;

    let (config_addr, _) = config_pda();
    config_info.has_address(&config_addr)?;
    let config = config_info.as_account_mut::<VaultConfig>(&arkana_ore_vault_api::ID)?;

    ore_mint_info.has_address(&config.ore_mint)?.as_mint()?;

    // Strict Treasury Address Validation: must match verified treasury in Config and ARKANA_TREASURY_ADDRESS
    treasury_info.has_address(&config.treasury)?;
    treasury_info.has_address(&ARKANA_TREASURY_ADDRESS)?;

    let (vault_auth_addr, vault_auth_bump) = vault_authority_pda();
    vault_authority_info.has_address(&vault_auth_addr)?;

    // 1. Verify PDAs belong to the tranche owner
    let (user_vault_addr, _) = user_vault_pda(owner_info.key);
    user_vault_info.has_address(&user_vault_addr)?;
    let (tranche_addr, _) = tranche_pda(owner_info.key, tranche_id);
    tranche_info.has_address(&tranche_addr)?;

    let user_vault = user_vault_info.as_account_mut::<UserVault>(&arkana_ore_vault_api::ID)?;
    let tranche = tranche_info.as_account_mut::<Tranche>(&arkana_ore_vault_api::ID)?;

    if tranche.owner != *owner_info.key || tranche.tranche_id != tranche_id {
        return Err(ProgramError::InvalidAccountData);
    }

    // 2. Caller must be the tranche owner or the Arkana Treasury
    if *signer_info.key != tranche.owner && *signer_info.key != ARKANA_TREASURY_ADDRESS {
        return Err(ArkanaVaultError::Unauthorized.into());
    }

    // 3. Strict 365-day Locking Period Check
    if clock.unix_timestamp < tranche.expires_at {
        return Err(ArkanaVaultError::TrancheNotMatured.into());
    }

    // Legacy tranches harvested by the previous program version stay open with
    // is_matured = 1 and no principal: only refund their rent to the owner.
    if tranche.is_matured == 0 && tranche.deposited_amount > 0 {
        vault_tokens_info.as_associated_token_account(&vault_auth_addr, &config.ore_mint)?;
        let principal = tranche.deposited_amount;

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

        // Principal not staked yet (pre ORE Stake tranches) is already in the vault token account
        let idle_principal = config
            .total_staked_ore
            .saturating_sub(ore_stake.staked_balance()?);
        ore_stake.unstake(principal.saturating_sub(idle_principal))?;

        // 4. Settle all unclaimed yield to the tranche owner
        let mut reward_amount = 0u64;
        if config.rewards_factor > tranche.last_rewards_factor {
            let factor_diff = config.rewards_factor - tranche.last_rewards_factor;
            reward_amount = (factor_diff * Numeric::from_u64(principal)).to_u64();
            tranche.last_rewards_factor = config.rewards_factor;
        }

        if reward_amount > 0 {
            if owner_tokens_info.data_is_empty() {
                create_associated_token_account(
                    signer_info,
                    owner_info,
                    owner_tokens_info,
                    ore_mint_info,
                    system_program,
                    token_program,
                    associated_token_program,
                )?;
            } else {
                owner_tokens_info.as_associated_token_account(owner_info.key, &config.ore_mint)?;
            }

            transfer_signed_with_bump(
                vault_authority_info,
                vault_tokens_info,
                owner_tokens_info,
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

        // 5. Ensure Treasury ATA exists and belongs to the Arkana Treasury
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
            treasury_tokens_info.as_associated_token_account(treasury_info.key, &config.ore_mint)?;
        }

        // 6. Transfer principal ORE into Arkana Treasury ATA
        transfer_signed_with_bump(
            vault_authority_info,
            vault_tokens_info,
            treasury_tokens_info,
            token_program,
            principal,
            &[VAULT_AUTHORITY_SEED],
            vault_auth_bump,
        )?;

        user_vault.total_staked_ore = user_vault.total_staked_ore.saturating_sub(principal);
        config.total_staked_ore = config.total_staked_ore.saturating_sub(principal);
        config.total_matured_ore = config
            .total_matured_ore
            .checked_add(principal)
            .ok_or(ArkanaVaultError::MathOverflow)?;
    }

    // 7. Close the tranche account: rent SOL goes back to the tranche owner
    tranche_info.close(owner_info)?;

    Ok(())
}
