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
import { SKR_MINT, SOLANA_MEMO_PROGRAM_ID, fetchRealSkrBalance } from './solanaService';

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
  const inputMint = 'So11111111111111111111111111111111111111112';
  const outputMint = SKR_MINT.toBase58();
  const rawSkr = Math.max(1, Math.round(amountSkr * 1_000_000));

  try {
    const url = `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${rawSkr}&swapMode=ExactOut&slippageBps=100`;
    const res = await fetch(url);
    if (res.ok) {
      const data = await res.json();
      const inLamports = Number(data.inAmount) || Math.round(amountSkr * 0.0002 * 1e9);
      return {
        solAmount: Number((inLamports / 1e9).toFixed(5)),
        lamports: inLamports,
      };
    }
  } catch (e) {
    console.warn('Jupiter quote fetch error, using fallback rate:', e);
  }

  // Fallback: 1 SKR = ~0.0002 SOL
  const fallbackSol = Number((amountSkr * 0.0002).toFixed(5));
  return {
    solAmount: fallbackSol,
    lamports: Math.round(fallbackSol * 1e9),
  };
}

/**
 * Build an SPL Token Transfer transaction for direct SKR payments:
 * - 50% transferred to Arkana Treasury
 * - 50% burned permanently on-chain (createBurnInstruction)
 */
export async function buildSkrPaymentTransaction({
  connection,
  userPublicKey,
  treasuryPublicKey,
  amountSkr,
  actionLabel = 'PAYMENT',
}: {
  connection: Connection;
  userPublicKey: PublicKey;
  treasuryPublicKey: PublicKey;
  amountSkr: number;
  actionLabel?: string;
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

  // 50% Treasury / 50% Deflationary Burn
  const totalRaw = BigInt(Math.round(amountSkr * 1_000_000));
  const treasuryRaw = totalRaw / 2n;
  const burnRaw = totalRaw - treasuryRaw;

  // 1. Transfer 50% to Treasury
  tx.add(
    createTransferInstruction(
      userAta,
      treasuryAta,
      userPublicKey,
      treasuryRaw,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // 2. Permanently Burn 50%
  tx.add(
    createBurnInstruction(
      userAta,
      SKR_MINT,
      userPublicKey,
      burnRaw,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // 3. Proof Memo
  const memoText = `ARKANA::${actionLabel}::TOTAL=${amountSkr}_SKR::TREASURY=50%::BURN=50%::TS=${Date.now()}`;
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
 * Universal payment or swap executor:
 * If user has sufficient SKR -> direct 50% Treasury + 50% Burn transaction.
 * If user has insufficient SKR -> auto-swap via Jupiter DEX or SOL Buyback transfer.
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
  signAndSendTransactions: (tx: any, minContextSlot: number) => Promise<any>;
}): Promise<{ signature: string; paidWith: 'skr' | 'sol_swap'; costSkr: number }> {
  const currentSkr = await fetchRealSkrBalance(connection, userPublicKey);

  if (currentSkr >= amountSkr) {
    // Direct on-chain SKR transaction: 50% Treasury + 50% Burn
    const tx = await buildSkrPaymentTransaction({
      connection,
      userPublicKey,
      treasuryPublicKey,
      amountSkr,
      actionLabel,
    });
    const result = await signAndSendTransactions(tx, 0);
    const signature = Array.isArray(result) ? result[0] : (typeof result === 'string' ? result : String(result));
    return { signature, paidWith: 'skr', costSkr: amountSkr };
  }

  // User has insufficient SKR -> auto-swap SOL into Treasury via Jupiter / Buyback
  const { lamports } = await getLiveSolQuoteForSkr(amountSkr);
  const treasuryAta = getAssociatedTokenAddressSync(SKR_MINT, treasuryPublicKey);

  try {
    const quoteUrl = `https://quote-api.jup.ag/v6/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${SKR_MINT.toBase58()}&amount=${lamports}&slippageBps=100`;
    const quoteRes = await fetch(quoteUrl);
    if (quoteRes.ok) {
      const quoteData = await quoteRes.json();
      const swapRes = await fetch('https://quote-api.jup.ag/v6/swap', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quoteResponse: quoteData,
          userPublicKey: userPublicKey.toBase58(),
          destinationTokenAccount: treasuryAta.toBase58(),
          wrapAndUnwrapSol: true,
        }),
      });
      if (swapRes.ok) {
        const swapData = await swapRes.json();
        const rawTxBuffer = Buffer.from(swapData.swapTransaction, 'base64');
        const { VersionedTransaction } = await import('@solana/web3.js');
        const vTx = VersionedTransaction.deserialize(new Uint8Array(rawTxBuffer));
        const result = await signAndSendTransactions(vTx, 0);
        const signature = Array.isArray(result) ? result[0] : (typeof result === 'string' ? result : String(result));
        return { signature, paidWith: 'sol_swap', costSkr: amountSkr };
      }
    }
  } catch (err) {
    console.warn('Jupiter swap assembly failed, executing fallback buyback transfer:', err);
  }

  // Fallback: Direct SOL transfer with Buyback Memo to Treasury
  const { blockhash } = await connection.getLatestBlockhash('confirmed');
  const fallbackTx = new Transaction({
    feePayer: userPublicKey,
    recentBlockhash: blockhash,
  });

  fallbackTx.add(
    SystemProgram.transfer({
      fromPubkey: userPublicKey,
      toPubkey: treasuryPublicKey,
      lamports,
    })
  );

  const memoText = `ARKANA::${actionLabel}::SKR_BUYBACK=${amountSkr}::LAMPORTS=${lamports}::TS=${Date.now()}`;
  fallbackTx.add(
    new TransactionInstruction({
      programId: SOLANA_MEMO_PROGRAM_ID,
      keys: [{ pubkey: userPublicKey, isSigner: true, isWritable: true }],
      data: Buffer.from(memoText, 'utf-8'),
    })
  );

  const result = await signAndSendTransactions(fallbackTx, 0);
  const signature = Array.isArray(result) ? result[0] : (typeof result === 'string' ? result : String(result));
  return { signature, paidWith: 'sol_swap', costSkr: amountSkr };
}
