import {
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  Connection
} from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddress
} from '@solana/spl-token';
import { getNetworkConfig } from '@/constants/networkConfig';

// ============================================================================
// CONSTANTS & PUBLIC KEYS (Derived dynamically from active network config)
// ============================================================================

/** Arkana ORE Sacred Vault Program ID */
export const ARKANA_VAULT_PROGRAM_ID = getNetworkConfig().arkanaVaultProgramId;

/** Official Solana ORE Token Mint */
export const ORE_MINT_ADDRESS = getNetworkConfig().oreMint;

/** Official ORE Staking Program */
export const ORE_STAKE_PROGRAM_ID = getNetworkConfig().oreStakeProgramId;

/** Verified Immutable Arkana Treasury Address */
export const ARKANA_TREASURY_ADDRESS = getNetworkConfig().treasuryAddress;

/** 365 Standard Days in seconds */
export const TRANCHE_LOCK_DURATION_SECONDS = 365 * 24 * 60 * 60;

// PDA Seeds
const CONFIG_SEED = Buffer.from('arkana_config', 'utf-8');
const VAULT_AUTHORITY_SEED = Buffer.from('arkana_vault_auth', 'utf-8');
const USER_VAULT_SEED = Buffer.from('arkana_user_vault', 'utf-8');
const TRANCHE_SEED = Buffer.from('arkana_tranche', 'utf-8');

// ORE Stake Native Seeds
const ORE_STAKE_SEED = Buffer.from('stake', 'utf-8');
const ORE_TREASURY_SEED = Buffer.from('treasury', 'utf-8');
const ORE_VESTING_SEED = Buffer.from('vesting', 'utf-8');

// ============================================================================
// PDA DERIVATION HELPERS
// ============================================================================

export function getConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([CONFIG_SEED], ARKANA_VAULT_PROGRAM_ID);
}

export function getVaultAuthorityPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync([VAULT_AUTHORITY_SEED], ARKANA_VAULT_PROGRAM_ID);
}

export function getUserVaultPda(userPubkey: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [USER_VAULT_SEED, userPubkey.toBuffer()],
    ARKANA_VAULT_PROGRAM_ID
  );
}

export function getTranchePda(userPubkey: PublicKey, trancheId: number): [PublicKey, number] {
  const trancheIdBuf = Buffer.alloc(4);
  trancheIdBuf.writeUInt32LE(trancheId, 0);
  return PublicKey.findProgramAddressSync(
    [TRANCHE_SEED, userPubkey.toBuffer(), trancheIdBuf],
    ARKANA_VAULT_PROGRAM_ID
  );
}

export function getOreStakePda(authority: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ORE_STAKE_SEED, authority.toBuffer()],
    ORE_STAKE_PROGRAM_ID
  );
}

export function getOreTreasuryPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ORE_TREASURY_SEED],
    ORE_STAKE_PROGRAM_ID
  );
}

export function getOreVestingPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [ORE_VESTING_SEED],
    ORE_STAKE_PROGRAM_ID
  );
}

// ============================================================================
// TYPES & DATA STRUCTURES
// ============================================================================

export interface UserVaultData {
  owner: string;
  trancheCount: number;
  totalStakedOre: number; // in indivisible units
  totalYieldClaimed: number;
}

export interface TrancheData {
  owner: string;
  trancheId: number;
  isMatured: boolean;
  depositedAmount: number; // in indivisible units
  depositedAt: number; // unix timestamp in seconds
  expiresAt: number; // unix timestamp in seconds
  claimedRewards: number;
  // Computed helpers for UI
  daysRemaining: number;
  isExpired: boolean;
  canHarvest: boolean;
}

// ============================================================================
// INSTRUCTION BUILDERS
// ============================================================================

/**
 * Creates the DepositTranche instruction.
 * Deposits `amount` ORE into a new 365-day tranche.
 */
export async function createDepositTrancheInstruction(
  userPubkey: PublicKey,
  trancheId: number,
  amountOreUnits: bigint
): Promise<TransactionInstruction> {
  const [configPda] = getConfigPda();
  const [vaultAuthorityPda] = getVaultAuthorityPda();
  const [userVaultPda] = getUserVaultPda(userPubkey);
  const [tranchePda] = getTranchePda(userPubkey, trancheId);

  const userTokensAta = await getAssociatedTokenAddress(ORE_MINT_ADDRESS, userPubkey);
  const vaultTokensAta = await getAssociatedTokenAddress(ORE_MINT_ADDRESS, vaultAuthorityPda, true);

  const data = Buffer.alloc(9);
  data.writeUInt8(1, 0); // Instruction::DepositTranche
  data.writeBigUInt64LE(amountOreUnits, 1);

  return new TransactionInstruction({
    programId: ARKANA_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
      { pubkey: userVaultPda, isSigner: false, isWritable: true },
      { pubkey: tranchePda, isSigner: false, isWritable: true },
      { pubkey: userTokensAta, isSigner: false, isWritable: true },
      { pubkey: vaultTokensAta, isSigner: false, isWritable: true },
      { pubkey: ORE_MINT_ADDRESS, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
    ],
    data
  });
}

/**
 * Creates the ClaimTrancheYield instruction.
 * User claims all accrued ORE yield on their tranche directly to their wallet.
 */
export async function createClaimTrancheYieldInstruction(
  userPubkey: PublicKey,
  trancheId: number
): Promise<TransactionInstruction> {
  const [configPda] = getConfigPda();
  const [vaultAuthorityPda] = getVaultAuthorityPda();
  const [userVaultPda] = getUserVaultPda(userPubkey);
  const [tranchePda] = getTranchePda(userPubkey, trancheId);

  const userTokensAta = await getAssociatedTokenAddress(ORE_MINT_ADDRESS, userPubkey);
  const vaultTokensAta = await getAssociatedTokenAddress(ORE_MINT_ADDRESS, vaultAuthorityPda, true);

  const data = Buffer.alloc(5);
  data.writeUInt8(2, 0); // Instruction::ClaimTrancheYield
  data.writeUInt32LE(trancheId, 1);

  return new TransactionInstruction({
    programId: ARKANA_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: userPubkey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
      { pubkey: userVaultPda, isSigner: false, isWritable: true },
      { pubkey: tranchePda, isSigner: false, isWritable: true },
      { pubkey: userTokensAta, isSigner: false, isWritable: true },
      { pubkey: vaultTokensAta, isSigner: false, isWritable: true },
      { pubkey: ORE_MINT_ADDRESS, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
    ],
    data
  });
}

/**
 * Creates the HarvestMaturedTranche instruction.
 * After 365 days, transitions the principal ORE into the Arkana Treasury.
 */
export async function createHarvestMaturedTrancheInstruction(
  callerPubkey: PublicKey,
  userPubkey: PublicKey,
  trancheId: number
): Promise<TransactionInstruction> {
  const [configPda] = getConfigPda();
  const [vaultAuthorityPda] = getVaultAuthorityPda();
  const [userVaultPda] = getUserVaultPda(userPubkey);
  const [tranchePda] = getTranchePda(userPubkey, trancheId);

  const treasuryTokensAta = await getAssociatedTokenAddress(ORE_MINT_ADDRESS, ARKANA_TREASURY_ADDRESS);
  const vaultTokensAta = await getAssociatedTokenAddress(ORE_MINT_ADDRESS, vaultAuthorityPda, true);

  const data = Buffer.alloc(5);
  data.writeUInt8(3, 0); // Instruction::HarvestMaturedTranche
  data.writeUInt32LE(trancheId, 1);

  return new TransactionInstruction({
    programId: ARKANA_VAULT_PROGRAM_ID,
    keys: [
      { pubkey: callerPubkey, isSigner: true, isWritable: true },
      { pubkey: configPda, isSigner: false, isWritable: true },
      { pubkey: vaultAuthorityPda, isSigner: false, isWritable: false },
      { pubkey: userVaultPda, isSigner: false, isWritable: true },
      { pubkey: tranchePda, isSigner: false, isWritable: true },
      { pubkey: ARKANA_TREASURY_ADDRESS, isSigner: false, isWritable: false },
      { pubkey: treasuryTokensAta, isSigner: false, isWritable: true },
      { pubkey: vaultTokensAta, isSigner: false, isWritable: true },
      { pubkey: ORE_MINT_ADDRESS, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false }
    ],
    data
  });
}

/**
 * Fetches real on-chain ORE token balance for any wallet
 */
export async function fetchRealOreBalance(
  connection: Connection,
  walletPublicKey: PublicKey
): Promise<number> {
  try {
    const userTokensAta = await getAssociatedTokenAddress(ORE_MINT_ADDRESS, walletPublicKey);
    const balance = await connection.getTokenAccountBalance(userTokensAta, 'confirmed');
    return balance.value.uiAmount || 0;
  } catch (err) {
    return 0;
  }
}
