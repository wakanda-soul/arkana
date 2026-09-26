use arkana_ore_vault_api::prelude::*;
use ore_stake_api::state::{stake_pda, treasury_pda, treasury_tokens_address, vesting_pda};
use steel::*;

/// Accounts of the ORE Stake protocol (stakecNP3...) used by the Arkana vault.
///
/// All tranche principal is staked in ORE Stake by the Vault Authority PDA, one stake
/// account for the whole vault. ORE staking yield is claimed into the vault token account
/// and spread over tranches pro-rata through `VaultConfig.rewards_factor`.
pub struct OreStakeAccounts<'a, 'info> {
    pub vault_authority: &'a AccountInfo<'info>,
    pub vault_tokens: &'a AccountInfo<'info>,
    pub ore_mint: &'a AccountInfo<'info>,
    pub stake: &'a AccountInfo<'info>,
    pub stake_tokens: &'a AccountInfo<'info>,
    pub stake_treasury: &'a AccountInfo<'info>,
    pub stake_treasury_tokens: &'a AccountInfo<'info>,
    pub vesting: &'a AccountInfo<'info>,
    pub system_program: &'a AccountInfo<'info>,
    pub token_program: &'a AccountInfo<'info>,
    pub associated_token_program: &'a AccountInfo<'info>,
    pub ore_stake_program: &'a AccountInfo<'info>,
}

impl<'a, 'info> OreStakeAccounts<'a, 'info> {
    /// Checks every ORE Stake account against its canonical address.
    pub fn validate(&self) -> ProgramResult {
        let (vault_auth_addr, _) = vault_authority_pda();
        self.vault_authority.has_address(&vault_auth_addr)?;
        self.vault_tokens
            .as_associated_token_account(&vault_auth_addr, self.ore_mint.key)?;
        self.stake.has_address(&stake_pda(vault_auth_addr).0)?;
        self.stake_tokens.has_address(
            &spl_associated_token_account::get_associated_token_address(
                &stake_pda(vault_auth_addr).0,
                self.ore_mint.key,
            ),
        )?;
        self.stake_treasury.has_address(&treasury_pda().0)?;
        self.stake_treasury_tokens.has_address(&treasury_tokens_address())?;
        self.vesting.has_address(&vesting_pda().0)?;
        self.system_program.is_program(&system_program::ID)?;
        self.token_program.is_program(&spl_token::ID)?;
        self.associated_token_program
            .is_program(&spl_associated_token_account::ID)?;
        self.ore_stake_program.is_program(&ore_stake_api::ID)?;
        Ok(())
    }

    fn vault_token_amount(&self) -> Result<u64, ProgramError> {
        Ok(self
            .vault_tokens
            .as_associated_token_account(self.vault_authority.key, self.ore_mint.key)?
            .amount())
    }

    fn infos(&self, payer: Option<&AccountInfo<'info>>) -> Vec<AccountInfo<'info>> {
        let mut infos = vec![
            self.vault_authority.clone(),
            self.vault_tokens.clone(),
            self.ore_mint.clone(),
            self.stake.clone(),
            self.stake_tokens.clone(),
            self.stake_treasury.clone(),
            self.stake_treasury_tokens.clone(),
            self.vesting.clone(),
            self.system_program.clone(),
            self.token_program.clone(),
            self.associated_token_program.clone(),
            self.ore_stake_program.clone(),
        ];
        if let Some(payer) = payer {
            infos.push(payer.clone());
        }
        infos
    }

    /// Claims all pending ORE Stake yield into the vault and credits it to tranches
    /// through `rewards_factor`. Must run before any tranche balance changes.
    pub fn sync_rewards(&self, config: &mut VaultConfig) -> Result<u64, ProgramError> {
        // Nothing is staked yet: the stake account is created by the first deposit.
        if self.stake.data_is_empty() {
            return Ok(0);
        }

        let before = self.vault_token_amount()?;
        invoke_signed(
            &ore_stake_api::sdk::claim(*self.vault_authority.key, u64::MAX),
            &self.infos(None),
            &arkana_ore_vault_api::ID,
            &[VAULT_AUTHORITY_SEED],
        )?;
        let claimed = self.vault_token_amount()?.saturating_sub(before);

        if claimed > 0 && config.total_staked_ore > 0 {
            config.rewards_factor +=
                Numeric::from_u64(claimed) / Numeric::from_u64(config.total_staked_ore);
        }
        Ok(claimed)
    }

    /// Stakes `amount` ORE from the vault token account into ORE Stake.
    /// `payer` funds the one-time creation of the vault's stake account.
    pub fn stake(&self, payer: &AccountInfo<'info>, amount: u64) -> ProgramResult {
        if amount == 0 {
            return Ok(());
        }
        invoke_signed(
            &ore_stake_api::sdk::deposit(*self.vault_authority.key, *payer.key, amount, 0, 0),
            &self.infos(Some(payer)),
            &arkana_ore_vault_api::ID,
            &[VAULT_AUTHORITY_SEED],
        )
    }

    /// Withdraws `amount` ORE from ORE Stake back into the vault token account.
    pub fn unstake(&self, amount: u64) -> ProgramResult {
        if amount == 0 {
            return Ok(());
        }
        invoke_signed(
            &ore_stake_api::sdk::withdraw(*self.vault_authority.key, amount),
            &self.infos(None),
            &arkana_ore_vault_api::ID,
            &[VAULT_AUTHORITY_SEED],
        )
    }

    /// ORE balance currently staked by the vault in ORE Stake.
    pub fn staked_balance(&self) -> Result<u64, ProgramError> {
        if self.stake.data_is_empty() {
            return Ok(0);
        }
        Ok(self
            .stake
            .as_account::<ore_stake_api::state::Stake>(&ore_stake_api::ID)?
            .balance)
    }
}
