use steel::*;

#[repr(u8)]
#[derive(Clone, Copy, Debug, Eq, PartialEq, TryFromPrimitive)]
pub enum ArkanaVaultInstruction {
    /// Initialize global vault config (can only be run once by Arkana Treasury).
    Initialize = 0,

    /// Deposit ORE into a new 365-day staking tranche.
    DepositTranche = 1,

    /// Claim accrued staking yield from an active tranche.
    ClaimTrancheYield = 2,

    /// Harvest a matured tranche (>= 365 days) permanently into the Arkana Treasury.
    HarvestMaturedTranche = 3,

    /// Distribute reward ORE into the staking pool.
    DistributeReward = 4,
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
instruction!(ArkanaVaultInstruction, DistributeReward);
