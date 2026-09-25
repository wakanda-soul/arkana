use solana_program::{pubkey, pubkey::Pubkey};

/// Hardcoded Immutable Arkana Treasury Address (Verified Founder Vault)
pub const ARKANA_TREASURY_ADDRESS: Pubkey = pubkey!("4v3d1itZVjLtDQEqGLFLtfr1riffAEcqnNtumEumJgny");

/// Official Mainnet ORE Token Mint Address
pub const ORE_MINT_ADDRESS: Pubkey = pubkey!("oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp");

/// Duration of staking lock: exactly 365 standard days in seconds.
pub const TRANCHE_LOCK_DURATION_SECONDS: i64 = 365 * 24 * 60 * 60; // 31,536,000 seconds

/// PDA Seed for the global protocol Config account.
pub const CONFIG_SEED: &[u8] = b"arkana_config";

/// PDA Seed for the central Vault Authority account (holds the ORE tokens and signs CPIs).
pub const VAULT_AUTHORITY_SEED: &[u8] = b"arkana_vault_auth";

/// PDA Seed for individual user vaults (aggregating their tranche counts).
pub const USER_VAULT_SEED: &[u8] = b"arkana_user_vault";

/// PDA Seed for individual staking tranches.
pub const TRANCHE_SEED: &[u8] = b"arkana_tranche";
