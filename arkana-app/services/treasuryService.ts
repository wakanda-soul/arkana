import {
  Connection,
  PublicKey,
  TransactionInstruction,
  SystemProgram,
  AddressLookupTableAccount,
  ComputeBudgetProgram,
  TransactionMessage,
  VersionedTransaction,
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
import { getNetworkConfig, isDevnet } from '@/constants/networkConfig';
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

const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');

/** Compute units reserved for Arkana's own instructions (ATA, transfer, burn, vault deposit + ORE Stake CPI ~260k, memo). */
const ARKANA_BASE_COMPUTE_UNITS = 350_000;
const MAX_COMPUTE_UNITS = 1_400_000;

interface JupiterSwapResult {
  instructions: TransactionInstruction[];
  addressLookupTableAccounts: AddressLookupTableAccount[];
  /** Quoted input amount (ExactOut: expected spend). */
  inAmount: bigint;
  /** Quoted output amount (ExactIn: expected, NOT guaranteed). */
  outAmount: bigint;
  /** Guaranteed minimum output: ExactIn = otherAmountThreshold, ExactOut = exact outAmount. */
  minOutAmount: bigint;
  computeUnitLimit: number;
  computeUnitPrice: bigint;
}

/**
 * Query Jupiter API for swap instructions from inputMint to outputMint.
 * Returns setup, swap, and cleanup instructions as web3.js TransactionInstructions.
 * Jupiter's compute budget instructions are NOT included: they are returned as numbers,
 * so several swaps can share one ComputeBudget pair in a single transaction.
 */
export async function fetchJupiterSwapInstructions({
  connection,
  userPublicKey,
  inputMint,
  outputMint,
  amountRaw,
  swapMode = 'ExactIn',
  slippageBps = 300,
}: {
  connection: Connection;
  userPublicKey: PublicKey;
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountRaw: bigint;
  swapMode?: 'ExactIn' | 'ExactOut';
  slippageBps?: number;
}): Promise<JupiterSwapResult> {
  // SOL legs use direct pools and other legs cap accounts, to keep the whole payment in one transaction
  const isSolLeg = inputMint.equals(WSOL_MINT) || outputMint.equals(WSOL_MINT);
  const extraParams = isSolLeg ? '&onlyDirectRoutes=true' : '&maxAccounts=24';
  const quoteUrl = `https://api.jup.ag/swap/v1/quote?inputMint=${inputMint.toBase58()}&outputMint=${outputMint.toBase58()}&amount=${amountRaw.toString()}&swapMode=${swapMode}&slippageBps=${slippageBps}${extraParams}`;
  const quoteRes = await fetch(quoteUrl);
  if (!quoteRes.ok) {
    throw new Error(`DEX swap quote unavailable for ${inputMint.toBase58()} -> ${outputMint.toBase58()} (${quoteRes.status})`);
  }
  const quote = await quoteRes.json();
  if (!quote || !quote.outAmount || !quote.inAmount || !quote.otherAmountThreshold) {
    throw new Error('DEX returned no route for swap.');
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

  // ComputeBudget: [2, u32 LE] = SetComputeUnitLimit, [3, u64 LE] = SetComputeUnitPrice
  let computeUnitLimit = 0;
  let computeUnitPrice = 0n;
  for (const ix of swapData.computeBudgetInstructions || []) {
    const data = Buffer.from(ix.data, 'base64');
    if (data[0] === 2 && data.length >= 5) computeUnitLimit = data.readUInt32LE(1);
    if (data[0] === 3 && data.length >= 9) computeUnitPrice = data.readBigUInt64LE(1);
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

  const outAmount = BigInt(quote.outAmount);
  return {
    instructions,
    addressLookupTableAccounts,
    inAmount: BigInt(quote.inAmount),
    outAmount,
    minOutAmount: swapMode === 'ExactIn' ? BigInt(quote.otherAmountThreshold) : outAmount,
    computeUnitLimit,
    computeUnitPrice,
  };
}

/**
 * One ComputeBudget pair for the whole transaction, sized for every swap inside it.
 */
function buildComputeBudgetInstructions(swaps: JupiterSwapResult[]): TransactionInstruction[] {
  const units = Math.min(
    MAX_COMPUTE_UNITS,
    ARKANA_BASE_COMPUTE_UNITS + swaps.reduce((sum, s) => sum + (s.computeUnitLimit || 300_000), 0)
  );
  const microLamports = swaps.reduce((max, s) => (s.computeUnitPrice > max ? s.computeUnitPrice : max), 0n);

  const ixs = [ComputeBudgetProgram.setComputeUnitLimit({ units })];
  if (microLamports > 0n) {
    ixs.push(ComputeBudgetProgram.setComputeUnitPrice({ microLamports }));
  }
  return ixs;
}

/**
 * Arkana split of every payment (the result is identical for SKR and SOL payments):
 * - 33% of the price in SKR burned permanently on-chain
 * - 33% of the price in SKR transferred to the Arkana Treasury
 * - 34% of the price swapped to ORE at market rate and deposited by the user into their Daily Tranche
 */
function splitPrice(totalRaw: bigint): { burnRaw: bigint; treasuryRaw: bigint; oreShareRaw: bigint } {
  const burnRaw = (totalRaw * 33n) / 100n;
  const treasuryRaw = (totalRaw * 33n) / 100n;
  const oreShareRaw = totalRaw - burnRaw - treasuryRaw; // Exactly 34%!
  return { burnRaw, treasuryRaw, oreShareRaw };
}

/**
 * 33% SKR to the Arkana Treasury + 33% SKR burned, from the user's SKR account.
 */
async function buildBurnAndTreasuryInstructions({
  connection,
  payer,
  treasury,
  burnRaw,
  treasuryRaw,
}: {
  connection: Connection;
  payer: PublicKey;
  treasury: PublicKey;
  burnRaw: bigint;
  treasuryRaw: bigint;
}): Promise<TransactionInstruction[]> {
  const userAta = getAssociatedTokenAddressSync(SKR_MINT, payer, true);
  const treasuryAta = getAssociatedTokenAddressSync(SKR_MINT, treasury, true);
  const instructions: TransactionInstruction[] = [];

  // Ensure Treasury ATA exists (only create if not exists on-chain)
  const treasuryAtaInfo = await connection.getAccountInfo(treasuryAta, 'confirmed');
  if (!treasuryAtaInfo) {
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
  }

  // Transfer Treasury SKR share (33%)
  instructions.push(
    createTransferInstruction(userAta, treasuryAta, payer, treasuryRaw, [], TOKEN_PROGRAM_ID)
  );

  // Permanently Burn 33% of the SKR on-chain
  instructions.push(createBurnInstruction(userAta, SKR_MINT, payer, burnRaw, [], TOKEN_PROGRAM_ID));

  return instructions;
}

/**
 * 34% leg: swap inputMint -> ORE at market rate and deposit it into the user's Daily Tranche PDA.
 *
 * The deposit uses the swap's guaranteed minimum output, so the transaction never
 * depends on the quote being hit exactly. Positive slippage stays in the user's wallet.
 */
async function buildOreTrancheInstructions({
  connection,
  payer,
  inputMint,
  amountInRaw,
}: {
  connection: Connection;
  payer: PublicKey;
  inputMint: PublicKey;
  amountInRaw: bigint;
}): Promise<{
  instructions: TransactionInstruction[];
  addressLookupTableAccounts: AddressLookupTableAccount[];
  swaps: JupiterSwapResult[];
  targetTrancheId: number;
}> {
  const instructions: TransactionInstruction[] = [];

  // Ensure User ORE ATA exists (only create if not exists on-chain)
  const userOreAta = getAssociatedTokenAddressSync(ORE_MINT_ADDRESS, payer, true);
  const userOreAtaInfo = await connection.getAccountInfo(userOreAta, 'confirmed');
  if (!userOreAtaInfo) {
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
  }

  // Determine target daily tranche (Top-Up into today's tranche or create new)
  const { targetTrancheId } = await getTargetTrancheInfo(connection, payer);

  if (isDevnet()) {
    // Devnet fallback simulation
    const estimatedOre = BigInt(Math.max(1, Math.round(Number(amountInRaw) / 1000)));
    instructions.push(await createDepositTrancheInstruction(payer, targetTrancheId, estimatedOre));
    return { instructions, addressLookupTableAccounts: [], swaps: [], targetTrancheId };
  }

  // Mainnet: Live Jupiter DEX swap to ORE at market rate
  const swapData = await fetchJupiterSwapInstructions({
    connection,
    userPublicKey: payer,
    inputMint,
    outputMint: ORE_MINT_ADDRESS,
    amountRaw: amountInRaw,
  });
  instructions.push(...swapData.instructions);

  // Deposit the guaranteed swap output into user's daily tranche PDA
  instructions.push(await createDepositTrancheInstruction(payer, targetTrancheId, swapData.minOutAmount));

  return {
    instructions,
    addressLookupTableAccounts: swapData.addressLookupTableAccounts,
    swaps: [swapData],
    targetTrancheId,
  };
}

function buildMemoInstruction(payer: PublicKey, memoText: string): TransactionInstruction {
  return new TransactionInstruction({
    programId: SOLANA_MEMO_PROGRAM_ID,
    keys: [{ pubkey: payer, isSigner: true, isWritable: false }],
    data: Buffer.from(memoText, 'utf-8'),
  });
}

/** One independent half of a payment: its instructions and the swaps inside it. */
interface PaymentGroup {
  instructions: TransactionInstruction[];
  swaps: JupiterSwapResult[];
}

/**
 * A payment is two independent groups that never depend on each other's output:
 * - skrGroup: 33% SKR burn + 33% SKR to the treasury (preceded by SOL -> SKR for SOL payments) + proof memo
 * - oreGroup: 34% -> ORE swap + daily tranche deposit (staked in ORE Stake)
 * They are sent as one transaction when it fits, otherwise as two transactions
 * approved together in a single wallet prompt.
 */
export interface PaymentPlan {
  skrGroup: PaymentGroup;
  oreGroup: PaymentGroup;
  addressLookupTableAccounts: AddressLookupTableAccount[];
}

let cachedArkanaLookupTable: AddressLookupTableAccount | null = null;

/**
 * Arkana's own Address Lookup Table (maintained by arkana-server): vault, ORE Stake and
 * frequently used pool accounts, so a whole payment fits into one transaction.
 */
async function getArkanaLookupTable(connection: Connection): Promise<AddressLookupTableAccount[]> {
  const address = getNetworkConfig().arkanaLookupTable;
  if (!address) return [];
  try {
    if (!cachedArkanaLookupTable) {
      const res = await connection.getAddressLookupTable(address);
      cachedArkanaLookupTable = res.value;
    }
    return cachedArkanaLookupTable ? [cachedArkanaLookupTable] : [];
  } catch (e) {
    console.warn('Arkana lookup table unavailable:', e);
    return [];
  }
}

/**
 * Plan for direct SKR payments:
 * 33% SKR burn + 33% SKR treasury + 34% SKR -> ORE daily tranche.
 */
export async function buildSkrPaymentPlan({
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
}): Promise<PaymentPlan> {
  const payer = new PublicKey(userPublicKey.toString());
  const treasury = new PublicKey(treasuryPublicKey.toString());

  const decimalsMultiplier = isDevnet() ? 1_000_000_000 : 1_000_000;
  const totalRaw = BigInt(Math.round(amountSkr * decimalsMultiplier));
  const { burnRaw, treasuryRaw, oreShareRaw } = splitPrice(totalRaw);

  const burnAndTreasury = await buildBurnAndTreasuryInstructions({ connection, payer, treasury, burnRaw, treasuryRaw });
  const oreLeg = await buildOreTrancheInstructions({ connection, payer, inputMint: SKR_MINT, amountInRaw: oreShareRaw });

  return {
    skrGroup: {
      instructions: [
        ...burnAndTreasury,
        // Compact proof memo; the server verifies the burn + treasury transfer in this transaction
        buildMemoInstruction(payer, `ARKANA:${actionLabel}:${oreLeg.targetTrancheId}`),
      ],
      swaps: [],
    },
    oreGroup: { instructions: oreLeg.instructions, swaps: oreLeg.swaps },
    addressLookupTableAccounts: [...(await getArkanaLookupTable(connection)), ...oreLeg.addressLookupTableAccounts],
  };
}

/**
 * Plan for payments in SOL, with the same end result as an SKR payment:
 * 1. SOL -> exactly 66% of the price in SKR (Jupiter ExactOut), then 33% burned + 33% to the treasury
 * 2. SOL worth 34% of the price -> ORE (market rate), deposited into the user's daily tranche
 */
export async function buildSolPaymentPlan({
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
}): Promise<PaymentPlan> {
  if (isDevnet()) {
    throw new Error('SOL payments need a live Jupiter route and are available on mainnet only. Use tSKR on devnet.');
  }

  const payer = new PublicKey(userPublicKey.toString());
  const treasury = new PublicKey(treasuryPublicKey.toString());
  const totalRaw = BigInt(Math.round(amountSkr * 1_000_000));
  const { burnRaw, treasuryRaw, oreShareRaw } = splitPrice(totalRaw);

  // SOL value of the 34% share at the live SOL/SKR market rate
  const { lamports: priceLamports } = await getLiveSolQuoteForSkr(amountSkr);
  const oreShareLamports = (BigInt(priceLamports) * oreShareRaw) / totalRaw;

  // 1. SOL -> exactly burnRaw + treasuryRaw SKR (Jupiter setup creates the user's SKR ATA if needed)
  const solToSkr = await fetchJupiterSwapInstructions({
    connection,
    userPublicKey: payer,
    inputMint: WSOL_MINT,
    outputMint: SKR_MINT,
    amountRaw: burnRaw + treasuryRaw,
    swapMode: 'ExactOut',
    slippageBps: 100,
  });
  const burnAndTreasury = await buildBurnAndTreasuryInstructions({ connection, payer, treasury, burnRaw, treasuryRaw });

  // 2. SOL -> ORE for the 34% share, deposited into today's tranche
  const oreLeg = await buildOreTrancheInstructions({ connection, payer, inputMint: WSOL_MINT, amountInRaw: oreShareLamports });

  return {
    skrGroup: {
      instructions: [
        ...solToSkr.instructions,
        ...burnAndTreasury,
        buildMemoInstruction(payer, `ARKANA:${actionLabel}:SOL:${oreLeg.targetTrancheId}`),
      ],
      swaps: [solToSkr],
    },
    oreGroup: { instructions: oreLeg.instructions, swaps: oreLeg.swaps },
    addressLookupTableAccounts: [
      ...(await getArkanaLookupTable(connection)),
      ...solToSkr.addressLookupTableAccounts,
      ...oreLeg.addressLookupTableAccounts,
    ],
  };
}

/** Largest serialized size a Solana transaction may have. */
const MAX_TRANSACTION_BYTES = 1232;

function compileTransaction(
  payer: PublicKey,
  blockhash: string,
  instructions: TransactionInstruction[],
  addressLookupTableAccounts: AddressLookupTableAccount[]
): VersionedTransaction | null {
  try {
    const message = new TransactionMessage({ payerKey: payer, recentBlockhash: blockhash, instructions })
      .compileToV0Message(addressLookupTableAccounts);
    const tx = new VersionedTransaction(message);
    return tx.serialize().length <= MAX_TRANSACTION_BYTES ? tx : null;
  } catch {
    // web3.js throws "encoding overruns Uint8Array" when the message exceeds the packet size
    return null;
  }
}

/**
 * Turns a payment plan into transactions: one atomic transaction when it fits,
 * otherwise the two independent groups as two transactions (still one wallet approval).
 */
export function compilePaymentTransactions(
  payer: PublicKey,
  blockhash: string,
  plan: PaymentPlan
): VersionedTransaction[] {
  const { skrGroup, oreGroup, addressLookupTableAccounts } = plan;

  const single = compileTransaction(
    payer,
    blockhash,
    [
      ...buildComputeBudgetInstructions([...skrGroup.swaps, ...oreGroup.swaps]),
      ...skrGroup.instructions,
      ...oreGroup.instructions,
    ],
    addressLookupTableAccounts
  );
  if (single) return [single];

  const split = [skrGroup, oreGroup].map((group) =>
    compileTransaction(
      payer,
      blockhash,
      [...buildComputeBudgetInstructions(group.swaps), ...group.instructions],
      addressLookupTableAccounts
    )
  );
  if (split.some((tx) => !tx)) {
    throw new Error('DEX route is too large for a Solana transaction. Please try again in a moment.');
  }
  return split as VersionedTransaction[];
}

const extraPaymentSignatures = new Map<string, string[]>();

/** Other transactions of a payment that was split in two (empty for single-transaction payments). */
export function getExtraPaymentSignatures(signature?: string | null): string[] {
  return (signature && extraPaymentSignatures.get(signature)) || [];
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
 * Universal payment executor. Every payment ends the same way:
 * 33% SKR burned + 33% SKR to the Arkana Treasury + 34% ORE in the user's daily tranche (staked in ORE Stake).
 * - Enough SKR (and !forceSolSwap): paid from the user's SKR.
 * - Otherwise: SOL is swapped to 66% SKR (burn + treasury) and 34% ORE (tranche) at market rate.
 * The user always approves once: one transaction, or two transactions in the same wallet prompt.
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
  const paidWith: 'skr' | 'sol_swap' = !forceSolSwap && currentSkr >= amountSkr ? 'skr' : 'sol_swap';

  const buildPlan = paidWith === 'skr' ? buildSkrPaymentPlan : buildSolPaymentPlan;
  const plan = await buildPlan({
    connection,
    userPublicKey: payer,
    treasuryPublicKey: treasury,
    amountSkr,
    actionLabel,
  });

  const { signatures } = await executeSolanaTransaction({
    connection,
    payerKey: payer,
    buildTransactions: (blockhash) => compilePaymentTransactions(payer, blockhash, plan),
    signAndSendTransactions,
  });

  // The first transaction holds the burn, the treasury transfer and the memo; a split payment
  // has the ORE tranche deposit in a second one. The server verifies both.
  extraPaymentSignatures.set(signatures[0], signatures.slice(1));
  return { signature: signatures[0], paidWith, costSkr: amountSkr };
}
