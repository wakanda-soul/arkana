mod claim;
mod deposit;
mod distribute;
mod harvest;
mod init;

use claim::*;
use deposit::*;
use distribute::*;
use harvest::*;
use init::*;

use arkana_ore_vault_api::instruction::*;
use steel::*;

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: &[u8],
) -> ProgramResult {
    let (ix, data) = parse_instruction(&arkana_ore_vault_api::ID, program_id, data)?;

    match ix {
        ArkanaVaultInstruction::Initialize => process_initialize(accounts, data)?,
        ArkanaVaultInstruction::DepositTranche => process_deposit_tranche(accounts, data)?,
        ArkanaVaultInstruction::ClaimTrancheYield => process_claim_tranche_yield(accounts, data)?,
        ArkanaVaultInstruction::HarvestMaturedTranche => process_harvest_matured_tranche(accounts, data)?,
        ArkanaVaultInstruction::DistributeReward => process_distribute_reward(accounts, data)?,
    }

    Ok(())
}

entrypoint!(process_instruction);
