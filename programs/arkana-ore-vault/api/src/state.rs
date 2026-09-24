use serde::{Deserialize, Serialize};
use steel::*;

use crate::consts::*;

#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq, IntoPrimitive, TryFromPrimitive)]
pub enum ArkanaAccount {
    VaultConfig = 10,
    UserVault = 11,
    Tranche = 12,
}

/// Global Protocol Configuration
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Pod, Zeroable, Serialize, Deserialize)]
pub struct VaultConfig {
    /// Official Arkana Treasury (Immutable recipient of matured tranches)
    pub treasury: Pubkey,

    /// Official ORE Mint Address
    pub ore_mint: Pubkey,

    /// Bump seed for the central vault authority PDA
    pub vault_authority_bump: u8,

    /// Initialization flag: 1 = Initialized, 0 = Uninitialized
    pub is_initialized: u8,

    /// Reserved padding for memory alignment
    pub _padding1: [u8; 6],

    /// Current global rewards factor (accumulated rewards per staked unit)
    pub rewards_factor: Numeric,

    /// Total cumulative ORE currently staked across active tranches
    pub total_staked_ore: u64,

    /// Total cumulative ORE yield distributed to users
    pub total_yield_distributed: u64,

    /// Total cumulative ORE matured and transitioned to the treasury
    pub total_matured_ore: u64,

    /// Total lifetime tranches created across all users
    pub total_tranches_count: u64,
}

account!(ArkanaAccount, VaultConfig);

/// Individual User Vault Aggregator
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Pod, Zeroable, Serialize, Deserialize)]
pub struct UserVault {
    /// Owner wallet address
    pub owner: Pubkey,

    /// Number of tranches opened by this user
    pub tranche_count: u32,

    /// Alignment padding
    pub _padding: [u8; 4],

    /// Total active ORE staked across all active tranches for this user
    pub total_staked_ore: u64,

    /// Total lifetime ORE yield claimed by this user
    pub total_yield_claimed: u64,
}

account!(ArkanaAccount, UserVault);

/// Individual 365-day Staking Tranche
#[repr(C)]
#[derive(Clone, Copy, Debug, PartialEq, Pod, Zeroable, Serialize, Deserialize)]
pub struct Tranche {
    /// Owner wallet address who deposited and has rights to yield
    pub owner: Pubkey,

    /// Sequential tranche ID for this user (1, 2, 3...)
    pub tranche_id: u32,

    /// 0 = Active (generating yield for user), 1 = Matured (principal transferred to Treasury)
    pub is_matured: u8,

    /// Alignment padding
    pub _padding: [u8; 3],

    /// Staked principal in indivisible ORE units (1 ORE = 10^11 units)
    pub deposited_amount: u64,

    /// Timestamp of initial deposit
    pub deposited_at: i64,

    /// Expiration timestamp: deposited_at + 365 days
    pub expires_at: i64,

    /// Snapshot of the ORE staking rewards factor when tranche was created
    pub rewards_factor_at_deposit: Numeric,

    /// Last processed rewards factor for this tranche
    pub last_rewards_factor: Numeric,

    /// Cumulative yield claimed so far on this tranche
    pub claimed_rewards: u64,
}

impl Tranche {
    /// Checks whether the 365-day locking period has elapsed.
    pub fn is_lock_expired(&self, current_timestamp: i64) -> bool {
        current_timestamp >= self.expires_at
    }

    /// Calculates accrued yield up to the current rewards factor.
    pub fn calculate_pending_yield(&self, current_factor: Numeric) -> u64 {
        if current_factor <= self.last_rewards_factor {
            return 0;
        }
        let diff = current_factor - self.last_rewards_factor;
        let earned = diff * Numeric::from_u64(self.deposited_amount);
        earned.to_u64()
    }
}

account!(ArkanaAccount, Tranche);

// PDA derivation helpers

pub fn config_pda() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[CONFIG_SEED], &crate::ID)
}

pub fn vault_authority_pda() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[VAULT_AUTHORITY_SEED], &crate::ID)
}

pub fn user_vault_pda(user: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(&[USER_VAULT_SEED, user.as_ref()], &crate::ID)
}

pub fn tranche_pda(user: &Pubkey, tranche_id: u32) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[TRANCHE_SEED, user.as_ref(), &tranche_id.to_le_bytes()],
        &crate::ID,
    )
}

#[cfg(test)]
mod tests {
    use super::*;
    use solana_program::pubkey;

    #[test]
    fn test_treasury_constant_matches_verified_founder_address() {
        let expected = pubkey!("4v3d1itZVjLtDQEqGLFLtfr1riffAEcqnNtumEumJgny");
        assert_eq!(ARKANA_TREASURY_ADDRESS, expected);
    }

    #[test]
    fn test_tranche_lock_duration_exactly_365_days() {
        assert_eq!(TRANCHE_LOCK_DURATION_SECONDS, 365 * 86400);
        let start_time = 1_700_000_000i64;
        let expiry = start_time + TRANCHE_LOCK_DURATION_SECONDS;

        let tranche = Tranche {
            owner: Pubkey::new_unique(),
            tranche_id: 1,
            is_matured: 0,
            _padding: [0; 3],
            deposited_amount: 10_000_000_000, // 0.1 ORE
            deposited_at: start_time,
            expires_at: expiry,
            rewards_factor_at_deposit: Numeric::ZERO,
            last_rewards_factor: Numeric::ZERO,
            claimed_rewards: 0,
        };

        // 364 days, 23 hours, 59 minutes: MUST NOT expire
        let before_expiry = expiry - 60;
        assert!(!tranche.is_lock_expired(before_expiry));

        // Exact 365 days: MUST expire
        assert!(tranche.is_lock_expired(expiry));

        // After 365 days: MUST expire
        assert!(tranche.is_lock_expired(expiry + 1000));
    }

    #[test]
    fn test_pda_isolation_across_users_and_tranches() {
        let user1 = Pubkey::new_unique();
        let user2 = Pubkey::new_unique();

        let (pda_u1_t1, _) = tranche_pda(&user1, 1);
        let (pda_u1_t2, _) = tranche_pda(&user1, 2);
        let (pda_u2_t1, _) = tranche_pda(&user2, 1);

        assert_ne!(pda_u1_t1, pda_u1_t2, "Same user, different tranche IDs must have distinct PDAs");
        assert_ne!(pda_u1_t1, pda_u2_t1, "Different users, same tranche ID must have distinct PDAs");
        assert_ne!(pda_u1_t2, pda_u2_t1, "Different users and tranches must have distinct PDAs");
    }

    #[test]
    fn test_yield_calculation_accuracy() {
        let deposit = 100_000_000_000u64; // 1 ORE
        let factor_start = Numeric::from_fraction(10, 100);
        let factor_now = Numeric::from_fraction(15, 100); // +0.05 per unit

        let tranche = Tranche {
            owner: Pubkey::new_unique(),
            tranche_id: 1,
            is_matured: 0,
            _padding: [0; 3],
            deposited_amount: deposit,
            deposited_at: 0,
            expires_at: TRANCHE_LOCK_DURATION_SECONDS,
            rewards_factor_at_deposit: factor_start,
            last_rewards_factor: factor_start,
            claimed_rewards: 0,
        };

        let pending = tranche.calculate_pending_yield(factor_now);
        // 0.05 * 100_000_000_000 = 5_000_000_000
        assert_eq!(pending, 5_000_000_000);

        // If factor did not increase, pending yield is 0
        let zero_pending = tranche.calculate_pending_yield(factor_start);
        assert_eq!(zero_pending, 0);
    }
}

