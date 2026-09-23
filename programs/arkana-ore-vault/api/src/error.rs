use steel::*;

#[derive(Debug, Error, Clone, Copy, PartialEq, Eq, IntoPrimitive)]
#[repr(u32)]
pub enum ArkanaVaultError {
    #[error("Program configuration is already initialized")]
    AlreadyInitialized = 0,

    #[error("Unauthorized: signer is not the legitimate owner of this tranche")]
    Unauthorized = 1,

    #[error("Tranche is still active: 365-day locking period has not elapsed yet")]
    TrancheNotMatured = 2,

    #[error("Tranche has already matured and transferred to treasury")]
    TrancheAlreadyMatured = 3,

    #[error("Deposit amount must be greater than zero")]
    ZeroDeposit = 4,

    #[error("Invalid treasury address: must match hardcoded Arkana Treasury")]
    InvalidTreasury = 5,

    #[error("Invalid mint: must match official ORE token mint")]
    InvalidMint = 6,

    #[error("No rewards available to claim")]
    NoRewardsAvailable = 7,

    #[error("Mathematical overflow during calculation")]
    MathOverflow = 8,
}

error!(ArkanaVaultError);
