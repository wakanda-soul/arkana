import { Connection, PublicKey, Transaction, TransactionInstruction } from '@solana/web3.js';
import {
  createTransferInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token';
import { ed25519 } from '@noble/curves/ed25519';
// @ts-ignore
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import { SKR_MINT, SOLANA_MEMO_PROGRAM_ID } from './solanaService';

/**
 * Arkana Founder Offline Master Public Key
 * This public key is the cryptographic anchor of trust.
 * Only messages signed by the corresponding offline secret key (never stored on server)
 * are accepted as authentic Treasury destinations by the client.
 */
export const FOUNDER_MASTER_PUBLIC_KEY = '6NJHiiXPHzHSLQYbyiet93WNSfEDayiPL6b6j9zfdyDz';

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
 * Build an SPL Token Transfer transaction for direct SKR payments
 */
export async function buildSkrPaymentTransaction({
  connection,
  userPublicKey,
  treasuryPublicKey,
  amountSkr,
}: {
  connection: Connection;
  userPublicKey: PublicKey;
  treasuryPublicKey: PublicKey;
  amountSkr: number;
}): Promise<Transaction> {
  const userAta = getAssociatedTokenAddressSync(SKR_MINT, userPublicKey);
  const treasuryAta = getAssociatedTokenAddressSync(SKR_MINT, treasuryPublicKey);

  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const tx = new Transaction({
    feePayer: userPublicKey,
    recentBlockhash: blockhash,
  });

  // Ensure Treasury ATA exists idempotently
  tx.add(
    createAssociatedTokenAccountIdempotentInstruction(
      userPublicKey,
      treasuryAta,
      treasuryPublicKey,
      SKR_MINT,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  // Transfer SKR: 6 decimals
  const rawAmount = BigInt(Math.round(amountSkr * 1_000_000));
  tx.add(
    createTransferInstruction(
      userAta,
      treasuryAta,
      userPublicKey,
      rawAmount,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // Add Proof Memo
  const memoText = `ARKANA::PAYMENT::SKR::${amountSkr}::TS=${Date.now()}`;
  tx.add(
    new TransactionInstruction({
      programId: SOLANA_MEMO_PROGRAM_ID,
      keys: [{ pubkey: userPublicKey, isSigner: true, isWritable: true }],
      data: Buffer.from(memoText, 'utf-8'),
    })
  );

  return tx;
}

/**
 * Build a Jupiter Swap transaction to swap SOL -> SKR directly into the Treasury
 */
export async function buildSolSwapToSkrPayment({
  connection,
  userPublicKey,
  treasuryPublicKey,
  amountLamports = 1_000_000, // 0.001 SOL
}: {
  connection: Connection;
  userPublicKey: PublicKey;
  treasuryPublicKey: PublicKey;
  amountLamports?: number;
}): Promise<{ swapTransaction: string | null; fallbackTx?: Transaction }> {
  const treasuryAta = getAssociatedTokenAddressSync(SKR_MINT, treasuryPublicKey);
  const inputMint = 'So11111111111111111111111111111111111111112';
  const outputMint = SKR_MINT.toBase58();

  try {
    // 1. Fetch Quote from Jupiter API
    const quoteUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${amountLamports}&slippageBps=100`;
    const quoteRes = await fetch(quoteUrl);
    if (!quoteRes.ok) {
      throw new Error(`Jupiter quote failed with status ${quoteRes.status}`);
    }
    const quoteData = await quoteRes.json();

    // 2. Request Swap Transaction from Jupiter API
    const swapRes = await fetch('https://api.jup.ag/swap/v1/swap', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quoteResponse: quoteData,
        userPublicKey: userPublicKey.toBase58(),
        destinationTokenAccount: treasuryAta.toBase58(),
        wrapAndUnwrapSol: true,
      }),
    });

    if (!swapRes.ok) {
      throw new Error(`Jupiter swap assembly failed with status ${swapRes.status}`);
    }

    const swapData = await swapRes.json();
    return { swapTransaction: swapData.swapTransaction };
  } catch (err) {
    console.warn('Jupiter Swap build error, fallback to direct SOL transfer with Buyback Memo:', err);
    // Fallback: direct SOL transfer to treasury with on-chain Buyback Memo
    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    const fallbackTx = new Transaction({
      feePayer: userPublicKey,
      recentBlockhash: blockhash,
    });

    // Native SOL transfer
    const { SystemProgram } = await import('@solana/web3.js');
    fallbackTx.add(
      SystemProgram.transfer({
        fromPubkey: userPublicKey,
        toPubkey: treasuryPublicKey,
        lamports: amountLamports,
      })
    );

    // Buyback Memo
    const memoText = `ARKANA::PAYMENT::SOL_BUYBACK::LAMPORTS=${amountLamports}::TS=${Date.now()}`;
    fallbackTx.add(
      new TransactionInstruction({
        programId: SOLANA_MEMO_PROGRAM_ID,
        keys: [{ pubkey: userPublicKey, isSigner: true, isWritable: true }],
        data: Buffer.from(memoText, 'utf-8'),
      })
    );

    return { swapTransaction: null, fallbackTx };
  }
}
