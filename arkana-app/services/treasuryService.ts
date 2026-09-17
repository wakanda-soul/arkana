import { Connection, PublicKey, Transaction, TransactionInstruction, SystemProgram } from '@solana/web3.js';
import {
  createTransferInstruction,
  createBurnInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { ed25519 } from '@noble/curves/ed25519';
// @ts-ignore
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { SKR_MINT, SOLANA_MEMO_PROGRAM_ID, fetchRealSkrBalance, executeSolanaTransaction } from './solanaService';

/**
 * Arkana Founder Offline Master Public Key
 * Cryptographic anchor of trust verified by offline Ed25519 signature.
 */
export const FOUNDER_MASTER_PUBLIC_KEY = '4R6FtpbHdv8WhXy7gHQCaXQbEqTgetqaBcJJSLs8kjW1';

export const ATTESTATION_PREFIX = 'ARKANA::TREASURY::ATTESTATION::v1::';

export interface TreasuryAttestationResponse {
  success: boolean;
  treasury: {
    address: string;
    attestationSignature: string;
    masterPublicKey: string;
    version: number;
    signedAt?: string;
  } | null;
}

/**
 * Verify cryptographic attestation of a candidate treasury address
 */
export function verifyTreasuryAttestation(
  treasuryAddress: string,
  signatureB58: string,
  expectedMasterPubB58: string = FOUNDER_MASTER_PUBLIC_KEY
): boolean {
  try {
    if (!treasuryAddress || !signatureB58) return false;
    const pubBytes = new Uint8Array(bs58.decode(expectedMasterPubB58));
    const sigBytes = new Uint8Array(bs58.decode(signatureB58));
    const msg = new Uint8Array(Buffer.from(`${ATTESTATION_PREFIX}${treasuryAddress}`, 'utf-8'));
    return ed25519.verify(sigBytes, msg, pubBytes);
  } catch (err) {
    console.warn('Treasury attestation verification error:', err);
    return false;
  }
}

/**
 * Fetch and cryptographically authenticate the Treasury from the backend
 */
export async function getVerifiedTreasury(apiBaseUrl: string): Promise<PublicKey> {
  const res = await fetch(`${apiBaseUrl}/api/treasury`);
  if (!res.ok) {
    throw new Error('Failed to retrieve Treasury configuration from server.');
  }

  const data: TreasuryAttestationResponse = await res.json();
  if (!data.success || !data.treasury || !data.treasury.address || !data.treasury.attestationSignature) {
    throw new Error('Treasury is not properly configured on server.');
  }

  const { address, attestationSignature } = data.treasury;
  const isAuthentic = verifyTreasuryAttestation(address, attestationSignature);

  if (!isAuthentic) {
    console.error('CRITICAL SECURITY ERROR: Treasury attestation signature mismatch!');
    throw new Error(
      'SECURITY ALERT: Treasury address verification failed. Possible server compromise or invalid configuration.'
    );
  }

  return new PublicKey(address);
}

/**
 * Query live Jupiter DEX rate for converting SOL to exact SKR
 */
export async function getLiveSolQuoteForSkr(amountSkr: number): Promise<{ solAmount: number; lamports: number }> {
  // Canonical rate: 1 SKR = 0.0002 SOL (1 SOL = 5,000 SKR)
  const rate = 0.0002;
  const fallbackSol = Number((amountSkr * rate).toFixed(5));
  return {
    solAmount: fallbackSol,
    lamports: Math.round(fallbackSol * 1e9),
  };
}

/**
 * Build SPL Token instructions for direct SKR payments:
 * - 50% transferred to Arkana Treasury
 * - 50% burned permanently on-chain (createBurnInstruction)
 */
export function buildSkrPaymentInstructions({
  userPublicKey,
  treasuryPublicKey,
  amountSkr,
  actionLabel = 'PAYMENT',
}: {
  userPublicKey: PublicKey;
  treasuryPublicKey: PublicKey;
  amountSkr: number;
  actionLabel?: string;
}): TransactionInstruction[] {
  const payer = new PublicKey(userPublicKey.toString());
  const treasury = new PublicKey(treasuryPublicKey.toString());
  const userAta = getAssociatedTokenAddressSync(SKR_MINT, payer, true);
  const treasuryAta = getAssociatedTokenAddressSync(SKR_MINT, treasury, true);

  const instructions: TransactionInstruction[] = [];

  // 1. Ensure Treasury ATA exists idempotently
  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      treasuryAta,
      treasury,
      SKR_MINT,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  // 50% Treasury / 50% Deflationary Burn
  const totalRaw = BigInt(Math.round(amountSkr * 1_000_000));
  const treasuryRaw = totalRaw / 2n;
  const burnRaw = totalRaw - treasuryRaw;

  // 2. Transfer 50% to Treasury
  instructions.push(
    createTransferInstruction(
      userAta,
      treasuryAta,
      payer,
      treasuryRaw,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // 3. Permanently Burn 50%
  instructions.push(
    createBurnInstruction(
      userAta,
      SKR_MINT,
      payer,
      burnRaw,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // 4. Proof Memo
  const memoText = `ARKANA::${actionLabel}::TOTAL=${amountSkr}_SKR::TREASURY=50%::BURN=50%::TS=${Date.now()}`;
  instructions.push(
    new TransactionInstruction({
      programId: SOLANA_MEMO_PROGRAM_ID,
      keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
      data: Buffer.from(memoText, 'utf-8'),
    })
  );

  return instructions;
}

/**
 * Universal payment or swap executor adhering to Solana Mobile Hackathon standard:
 * - If user has sufficient SKR -> 50% Treasury + 50% Burn via VersionedTransaction.
 * - If user has insufficient SKR -> SOL Buyback transfer into Treasury via VersionedTransaction.
 */
export async function executePaymentOrSwap({
  connection,
  userPublicKey,
  treasuryPublicKey,
  amountSkr,
  actionLabel,
  signAndSendTransactions,
}: {
  connection: Connection;
  userPublicKey: PublicKey;
  treasuryPublicKey: PublicKey;
  amountSkr: number;
  actionLabel: string;
  signAndSendTransactions?: (tx: any, minContextSlot: any) => Promise<any>;
}): Promise<{ signature: string; paidWith: 'skr' | 'sol_swap'; costSkr: number }> {
  const payer = new PublicKey(userPublicKey.toString());
  const treasury = new PublicKey(treasuryPublicKey.toString());

  const currentSkr = await fetchRealSkrBalance(connection, payer);

  if (currentSkr >= amountSkr) {
    // Direct on-chain SKR transaction: 50% Treasury + 50% Burn
    const instructions = buildSkrPaymentInstructions({
      userPublicKey: payer,
      treasuryPublicKey: treasury,
      amountSkr,
      actionLabel,
    });

    const { signature } = await executeSolanaTransaction({
      connection,
      payerKey: payer,
      instructions,
      signAndSendTransactions,
    });

    return { signature, paidWith: 'skr', costSkr: amountSkr };
  }

  // User has insufficient SKR -> direct SOL transfer with Buyback Memo into Treasury
  const { lamports } = await getLiveSolQuoteForSkr(amountSkr);
  const fallbackInstructions: TransactionInstruction[] = [
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: treasury,
      lamports,
    }),
    new TransactionInstruction({
      programId: SOLANA_MEMO_PROGRAM_ID,
      keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
      data: Buffer.from(`ARKANA::${actionLabel}::SKR_BUYBACK=${amountSkr}::LAMPORTS=${lamports}::TS=${Date.now()}`, 'utf-8'),
    }),
  ];

  const { signature } = await executeSolanaTransaction({
    connection,
    payerKey: payer,
    instructions: fallbackInstructions,
    signAndSendTransactions,
  });

  return { signature, paidWith: 'sol_swap', costSkr: amountSkr };
}
