use steel::*;

#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq, TryFromPrimitive)]
pub enum ArkanaVaultInstruction {
    /// Initialize global vault config (can only be run once by Arkana Treasury).
    Initialize = 0,

    /// Deposit ORE into the user's daily 365-day tranche and stake it in ORE Stake.
    DepositTranche = 1,

    /// Claim accrued staking yield from an active tranche.
    ClaimTrancheYield = 2,

    /// Harvest a matured tranche (>= 365 days): principal to the Arkana Treasury,
    /// unclaimed yield and tranche rent back to the owner.
    HarvestMaturedTranche = 3,

    /// Distribute reward ORE into the staking pool.
    DistributeReward = 4,

    /// Permissionless crank: claim ORE Stake yield into the vault and stake idle principal.
    SyncStake = 5,
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct Initialize {}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct DepositTranche {
    /// Indivisible units of ORE to deposit.
    pub amount: [u8; 8],
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct ClaimTrancheYield {
    /// The unique tranche ID belonging to this user.
    pub tranche_id: [u8; 4],
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct HarvestMaturedTranche {
    /// The unique tranche ID belonging to this user.
    pub tranche_id: [u8; 4],
}

#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct DistributeReward {
    /// Indivisible units of ORE to distribute to active stakers.
    pub amount: [u8; 8],
}

instruction!(ArkanaVaultInstruction, Initialize);
instruction!(ArkanaVaultInstruction, DepositTranche);
instruction!(ArkanaVaultInstruction, ClaimTrancheYield);
instruction!(ArkanaVaultInstruction, HarvestMaturedTranche);
#[repr(C)]
#[derive(Clone, Copy, Debug, Pod, Zeroable)]
pub struct SyncStake {}

instruction!(ArkanaVaultInstruction, DistributeReward);
instruction!(ArkanaVaultInstruction, SyncStake);
