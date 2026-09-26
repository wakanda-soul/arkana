import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  AddressLookupTableAccount,
} from '@solana/web3.js';
import {
  createTransferInstruction,
  createBurnInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountIdempotentInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import { ed25519 } from '@noble/curves/ed25519';
// @ts-ignore
import bs58 from 'bs58';
import { Buffer } from 'buffer';
import {
  SKR_MINT,
  SOLANA_MEMO_PROGRAM_ID,
  fetchRealSkrBalance,
  executeSolanaTransaction,
} from './solanaService';
import { isDevnet } from '@/constants/networkConfig';
import {
  ORE_MINT_ADDRESS,
  createDepositTrancheInstruction,
  getTargetTrancheInfo,
} from './oreVaultService';

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
export async function getLiveSolQuoteForSkr(
  amountSkr: number
): Promise<{ solAmount: number; lamports: number; quoteResponse?: any }> {
  const rawSkrNeeded = Math.round(amountSkr * 1_000_000);
  try {
    const res = await fetch(
      `https://api.jup.ag/swap/v1/quote?inputMint=So11111111111111111111111111111111111111112&outputMint=${SKR_MINT.toBase58()}&amount=${rawSkrNeeded}&swapMode=ExactOut&slippageBps=100`
    );
    if (res.ok) {
      const quote = await res.json();
      if (quote && quote.inAmount) {
        const lamports = Number(quote.inAmount);
        const solAmount = Number((lamports / 1e9).toFixed(6));
        return { solAmount, lamports, quoteResponse: quote };
      }
    }
  } catch (e) {
    console.warn('Failed to fetch live Jupiter quote, using fallback rate:', e);
  }

  // Canonical fallback rate: 1 SKR = 0.0002 SOL (1 SOL = 5,000 SKR)
  const rate = 0.0002;
  const fallbackSol = Number((amountSkr * rate).toFixed(5));
  return {
    solAmount: fallbackSol,
    lamports: Math.round(fallbackSol * 1e9),
  };
}

/**
 * Query Jupiter API for swap instructions from inputMint to outputMint.
 * Deserializes returned setup, swap, and cleanup instructions into web3.js TransactionInstruction objects.
 */
export async function fetchJupiterSwapInstructions({
  connection,
  userPublicKey,
  inputMint,
  outputMint,
  amountRaw,
  slippageBps = 300,
}: {
  connection: Connection;
  userPublicKey: PublicKey;
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountRaw: bigint;
  slippageBps?: number;
}): Promise<{
  instructions: TransactionInstruction[];
  addressLookupTableAccounts: AddressLookupTableAccount[];
  outAmount: bigint;
}> {
  const quoteUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${inputMint.toBase58()}&outputMint=${outputMint.toBase58()}&amount=${amountRaw.toString()}&slippageBps=${slippageBps}`;
  const quoteRes = await fetch(quoteUrl);
  if (!quoteRes.ok) {
    throw new Error(`DEX swap quote unavailable for ${inputMint.toBase58()} -> ${outputMint.toBase58()} (${quoteRes.status})`);
  }
  const quote = await quoteRes.json();
  if (!quote || !quote.outAmount) {
    throw new Error('DEX returned no output amount for swap.');
  }

  const swapRes = await fetch('https://api.jup.ag/swap/v1/swap-instructions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: userPublicKey.toBase58(),
      wrapAndUnwrapSol: true,
      useSharedAccounts: true,
    }),
  });

  if (!swapRes.ok) {
    throw new Error(`DEX swap instruction generation failed (${swapRes.status}).`);
  }

  const swapData = await swapRes.json();
  const instructions: TransactionInstruction[] = [];

  const deserialize = (ix: any) =>
    new TransactionInstruction({
      programId: new PublicKey(ix.programId),
      keys: ix.accounts.map((acc: any) => ({
        pubkey: new PublicKey(acc.pubkey),
        isSigner: acc.isSigner,
        isWritable: acc.isWritable,
      })),
      data: Buffer.from(ix.data, 'base64'),
    });

  if (swapData.computeBudgetInstructions) {
    for (const ix of swapData.computeBudgetInstructions) {
      instructions.push(deserialize(ix));
    }
  }
  if (swapData.setupInstructions) {
    for (const ix of swapData.setupInstructions) {
      instructions.push(deserialize(ix));
    }
  }
  if (swapData.swapInstruction) {
    instructions.push(deserialize(swapData.swapInstruction));
  }
  if (swapData.cleanupInstruction) {
    instructions.push(deserialize(swapData.cleanupInstruction));
  }

  const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
  if (swapData.addressLookupTableAddresses && Array.isArray(swapData.addressLookupTableAddresses)) {
    for (const addr of swapData.addressLookupTableAddresses) {
      try {
        const alt = await connection.getAddressLookupTable(new PublicKey(addr));
        if (alt.value) {
          addressLookupTableAccounts.push(alt.value);
        }
      } catch (e) {
        console.warn('Failed to load ALT address:', addr, e);
      }
    }
  }

  return {
    instructions,
    addressLookupTableAccounts,
    outAmount: BigInt(quote.outAmount),
  };
}

/**
 * Build SPL Token instructions for direct SKR payments:
 * - 33% burned permanently on-chain (createBurnInstruction)
 * - 33% transferred to Arkana Treasury
 * - 34% swapped directly to ORE and staked into the User's Daily Tranche PDA
 */
export async function buildSkrPaymentInstructions({
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
}): Promise<{
  instructions: TransactionInstruction[];
  addressLookupTableAccounts: AddressLookupTableAccount[];
}> {
  const payer = new PublicKey(userPublicKey.toString());
  const treasury = new PublicKey(treasuryPublicKey.toString());
  const userAta = getAssociatedTokenAddressSync(SKR_MINT, payer, true);
  const treasuryAta = getAssociatedTokenAddressSync(SKR_MINT, treasury, true);

  const instructions: TransactionInstruction[] = [];
  const addressLookupTableAccounts: AddressLookupTableAccount[] = [];

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

  // Protocol Split: 33% Burn + 33% Treasury + 34% ORE Staking Yield
  const decimalsMultiplier = isDevnet() ? 1_000_000_000 : 1_000_000;
  const totalRaw = BigInt(Math.round(amountSkr * decimalsMultiplier));
  const burnRaw = (totalRaw * 33n) / 100n;
  const treasuryRaw = (totalRaw * 33n) / 100n;
  const oreShareRaw = totalRaw - burnRaw - treasuryRaw; // Exactly 34%!

  // 2. Transfer Treasury SKR share (33%)
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

  // 3. Permanently Burn 33% of the SKR on-chain
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

  // 4. Ensure User ORE ATA exists idempotently
  const userOreAta = getAssociatedTokenAddressSync(ORE_MINT_ADDRESS, payer, true);
  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      userOreAta,
      payer,
      ORE_MINT_ADDRESS,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  // 5. Determine target daily tranche (Top-Up into today's tranche or create new)
  const { targetTrancheId } = await getTargetTrancheInfo(connection, payer);

  if (!isDevnet()) {
    // Mainnet: Live Jupiter DEX swap from SKR to ORE
    const swapData = await fetchJupiterSwapInstructions({
      connection,
      userPublicKey: payer,
      inputMint: SKR_MINT,
      outputMint: ORE_MINT_ADDRESS,
      amountRaw: oreShareRaw,
    });

    instructions.push(...swapData.instructions);
    addressLookupTableAccounts.push(...swapData.addressLookupTableAccounts);

    // Deposit the swapped ORE into user's daily tranche PDA
    const depositIx = await createDepositTrancheInstruction(
      payer,
      targetTrancheId,
      swapData.outAmount
    );
    instructions.push(depositIx);
  } else {
    // Devnet fallback simulation
    const estimatedOre = BigInt(Math.max(1, Math.round(Number(oreShareRaw) / 1000)));
    const depositIx = await createDepositTrancheInstruction(
      payer,
      targetTrancheId,
      estimatedOre
    );
    instructions.push(depositIx);
  }

  // 6. Proof Memo documenting 33% Burn + 33% Treasury + 34% ORE Staking Yield
  const memoText = `ARKANA::${actionLabel}::TOTAL=${amountSkr}_SKR::SPLIT(BURN=33%_TREASURY=33%_ORE_DAILY_TRANCHE=${targetTrancheId})::TS=${Date.now()}`;
  instructions.push(
    new TransactionInstruction({
      programId: SOLANA_MEMO_PROGRAM_ID,
      keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
      data: Buffer.from(memoText, 'utf-8'),
    })
  );

  return { instructions, addressLookupTableAccounts };
}

/**
 * Build SOL instructions for payments when paying in SOL:
 * - 33% transferred to Arkana Treasury
 * - 33% transferred to Solana Incinerator (permanently burned on-chain)
 * - 34% swapped directly to ORE and staked into the User's Daily Tranche PDA
 */
export async function buildSolPaymentInstructions({
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
}): Promise<{
  instructions: TransactionInstruction[];
  addressLookupTableAccounts: AddressLookupTableAccount[];
}> {
  const payer = new PublicKey(userPublicKey.toString());
  const treasury = new PublicKey(treasuryPublicKey.toString());
  let { lamports } = await getLiveSolQuoteForSkr(amountSkr);

  // Guard rent exemption if treasury is new
  try {
    const treasuryBalance = await connection.getBalance(treasury, 'confirmed');
    if (treasuryBalance === 0 && lamports < 650240) {
      lamports = 650240;
    }
  } catch {}

  const totalLamports = BigInt(lamports);
  const burnLamports = (totalLamports * 33n) / 100n;
  const treasuryLamports = (totalLamports * 33n) / 100n;
  const oreLamports = totalLamports - burnLamports - treasuryLamports; // Exactly 34%!

  const instructions: TransactionInstruction[] = [];
  const addressLookupTableAccounts: AddressLookupTableAccount[] = [];

  // 1. 33% SOL to Arkana Treasury
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: treasury,
      lamports: treasuryLamports,
    })
  );

  // 2. 33% SOL to Burn (Solana Incinerator - permanent deflationary burn)
  const INCINERATOR_ADDRESS = new PublicKey('1nc1nerator11111111111111111111111111111111');
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: payer,
      toPubkey: INCINERATOR_ADDRESS,
      lamports: burnLamports,
    })
  );

  // 3. Ensure User ORE ATA exists idempotently
  const userOreAta = getAssociatedTokenAddressSync(ORE_MINT_ADDRESS, payer, true);
  instructions.push(
    createAssociatedTokenAccountIdempotentInstruction(
      payer,
      userOreAta,
      payer,
      ORE_MINT_ADDRESS,
      TOKEN_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    )
  );

  const { targetTrancheId } = await getTargetTrancheInfo(connection, payer);
  const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

  if (!isDevnet()) {
    // Mainnet: Live Jupiter DEX swap from SOL to ORE
    const swapData = await fetchJupiterSwapInstructions({
      connection,
      userPublicKey: payer,
      inputMint: WSOL_MINT,
      outputMint: ORE_MINT_ADDRESS,
      amountRaw: oreLamports,
    });

    instructions.push(...swapData.instructions);
    addressLookupTableAccounts.push(...swapData.addressLookupTableAccounts);

    const depositIx = await createDepositTrancheInstruction(
      payer,
      targetTrancheId,
      swapData.outAmount
    );
    instructions.push(depositIx);
  } else {
    const estimatedOre = BigInt(Math.max(1, Math.round(Number(oreLamports) / 1000)));
    const depositIx = await createDepositTrancheInstruction(
      payer,
      targetTrancheId,
      estimatedOre
    );
    instructions.push(depositIx);
  }

  // 4. Proof Memo documenting 33% Burn + 33% Treasury + 34% ORE Staking Yield
  const memoText = `ARKANA::${actionLabel}::SOL_PAYMENT::SKR_EQUIV=${amountSkr}::LAMPORTS=${lamports}::SPLIT(BURN=33%_TREASURY=33%_ORE_DAILY_TRANCHE=${targetTrancheId})::TS=${Date.now()}`;
  instructions.push(
    new TransactionInstruction({
      programId: SOLANA_MEMO_PROGRAM_ID,
      keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
      data: Buffer.from(memoText, 'utf-8'),
    })
  );

  return { instructions, addressLookupTableAccounts };
}

export interface ExecutePaymentOrSwapParams {
  connection: Connection;
  userPublicKey: PublicKey;
  treasuryPublicKey: PublicKey;
  amountSkr: number;
  actionLabel: string;
  forceSolSwap?: boolean;
  signAndSendTransactions?: (tx: any, minContextSlot: any) => Promise<any>;
}

/**
 * Universal payment or swap executor adhering to Solana Mobile Hackathon standard:
 * - If user has sufficient SKR (and !forceSolSwap) -> 33% Burn + 33% Treasury + 34% ORE DEX Swap & Daily Tranche Staking.
 * - If user has insufficient SKR (or forceSolSwap) -> 33% SOL Burn (Incinerator) + 33% Treasury + 34% ORE DEX Swap & Daily Tranche Staking.
 */
export async function executePaymentOrSwap({
  connection,
  userPublicKey,
  treasuryPublicKey,
  amountSkr,
  actionLabel,
  forceSolSwap = false,
  signAndSendTransactions,
}: ExecutePaymentOrSwapParams): Promise<{ signature: string; paidWith: 'skr' | 'sol_swap'; costSkr: number }> {
  const payer = new PublicKey(userPublicKey.toString());
  const treasury = new PublicKey(treasuryPublicKey.toString());

  const currentSkr = await fetchRealSkrBalance(connection, payer);

  if (!forceSolSwap && currentSkr >= amountSkr) {
    // Direct on-chain SKR transaction: 33% Treasury + 33% Burn + 34% ORE Swap & Staking
    const { instructions, addressLookupTableAccounts } = await buildSkrPaymentInstructions({
      connection,
      userPublicKey: payer,
      treasuryPublicKey: treasury,
      amountSkr,
      actionLabel,
    });

    const { signature } = await executeSolanaTransaction({
      connection,
      payerKey: payer,
      instructions,
      addressLookupTableAccounts,
      signAndSendTransactions,
    });

    return { signature, paidWith: 'skr', costSkr: amountSkr };
  }

  // SOL payment: 33% Deflationary Burn (Incinerator) + 33% Treasury + 34% ORE Swap & Staking
  const { instructions, addressLookupTableAccounts } = await buildSolPaymentInstructions({
    connection,
    userPublicKey: payer,
    treasuryPublicKey: treasury,
    amountSkr,
    actionLabel,
  });

  const { signature } = await executeSolanaTransaction({
    connection,
    payerKey: payer,
    instructions,
    addressLookupTableAccounts,
    signAndSendTransactions,
  });

  return { signature, paidWith: 'sol_swap', costSkr: amountSkr };
}
