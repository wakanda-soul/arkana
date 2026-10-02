import { savePendingPayment } from '@/services/pendingPayments';
import { secureRandomHex } from '@/utils/secureRandom';
import {
  Connection,
  PublicKey,
  TransactionInstruction,
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
import { netFetch } from './netFetch';
import { authedFetch } from './sessionService';
import { getSkrSolEstimate } from './oracleApi';
import { WSOL_MINT, checkJupiterQuote, checkJupiterSwapInstructions, readComputeBudget } from './jupiterGuard';
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
let verifiedTreasury: PublicKey | null = null;

export async function getVerifiedTreasury(apiBaseUrl: string): Promise<PublicKey> {
  // Verified once per app run: the attestation and the built-in address do not change
  if (verifiedTreasury) return verifiedTreasury;
  const res = await netFetch(`${apiBaseUrl}/api/treasury`);
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

  // The vault program only ever sends principal to this hardcoded treasury: payments must use the same
  // one, so a validly signed but different address (e.g. an old attestation) is refused too
  const treasury = new PublicKey(address);
  if (!treasury.equals(getNetworkConfig().treasuryAddress)) {
    throw new Error('SECURITY ALERT: Treasury address does not match the one built into the app.');
  }
  verifiedTreasury = treasury;
  return treasury;
}

/** Highest price the app will ever sign for, whatever the server says (the Oracle Pass is 333). */
export const MAX_PAYMENT_SKR = 333;


/**
 * Highest SOL a payment may spend on its swaps, whatever the quotes say: 0.5 SOL. 333 SKR (the most
 * the app pays, MAX_PAYMENT_SKR) cost about 0.05 SOL at October 2026 prices, so this leaves ~10x
 * room for SKR to rise while a broken or hostile quote can never take more.
 */
export const MAX_PAYMENT_LAMPORTS = 500_000_000n;
/** A SOL payment may cost at most this much more than the price shown to the user. */
const SOL_ESTIMATE_TOLERANCE = 1.3;
/** Priority fee ceiling for a whole payment (compute unit price x limit): 0.002 SOL. */
const MAX_PRIORITY_FEE_LAMPORTS = 2_000_000n;

/**
 * fetch() for the Jupiter proxy, with the wallet session (the proxy serves signed-in wallets only).
 * Bursts are rate-limited (HTTP 429), and one payment makes several calls in a row, so retry a few
 * times with a growing pause.
 */
async function jupiterFetch(url: string, init?: RequestInit): Promise<Response> {
  let res = await authedFetch(url, init);
  // Wait 1, 2, 4 s on a 429
  for (let attempt = 1; res.status === 429 && attempt <= 3; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** attempt));
    res = await authedFetch(url, init);
  }
  return res;
}

/**
 * Jupiter through the Arkana server, which adds the project's Jupiter API key (it never ships in the
 * app). The server passes only SOL/SKR/ORE swaps, and every instruction it returns is still checked
 * here before signing (jupiterGuard).
 */
const JUPITER_API = 'https://arkana.icu/api/jup';

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
  /** Most input the swap can take (ExactOut: quoted input + slippage). */
  maxInAmount: bigint;
  computeUnitLimit: number;
  computeUnitPrice: bigint;
}

/** Account cap for Jupiter routes, and the lower one used to rebuild a payment that did not fit one transaction. */
const DEFAULT_MAX_ACCOUNTS = 24;
const REDUCED_MAX_ACCOUNTS = 18; // 14 finds no SKR route at all; 18 still trims most of a long route

/**
 * One Jupiter quote. SOL <-> ORE first tries a direct pool (short route, fits one transaction);
 * SKR routes have no direct SOL pool, so they go straight to a capped multi-hop route. A rebuild with
 * a lowered account cap skips the direct try and caps every leg.
 */
async function fetchJupiterQuote({
  inputMint,
  outputMint,
  amountRaw,
  swapMode = 'ExactIn',
  slippageBps = 300,
  maxAccounts = DEFAULT_MAX_ACCOUNTS,
}: {
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountRaw: bigint;
  swapMode?: 'ExactIn' | 'ExactOut';
  slippageBps?: number;
  maxAccounts?: number;
}): Promise<any> {
  // Liquid intermediate tokens only: fewer failed routes (Jupiter's recommendation)
  const base = `${JUPITER_API}/quote?inputMint=${inputMint.toBase58()}&outputMint=${outputMint.toBase58()}&amount=${amountRaw.toString()}&swapMode=${swapMode}&slippageBps=${slippageBps}&restrictIntermediateTokens=true`;
  const capped = `${base}&maxAccounts=${maxAccounts}`;
  const touchesSkr = inputMint.equals(SKR_MINT) || outputMint.equals(SKR_MINT);
  const isSolLeg = inputMint.equals(WSOL_MINT) || outputMint.equals(WSOL_MINT);
  const tryDirect = isSolLeg && !touchesSkr && maxAccounts >= DEFAULT_MAX_ACCOUNTS;
  let res = await jupiterFetch(tryDirect ? `${base}&onlyDirectRoutes=true` : capped);
  if (!res.ok && tryDirect) res = await jupiterFetch(capped);
  if (!res.ok) {
    throw new Error(`DEX swap quote unavailable for ${inputMint.toBase58()} -> ${outputMint.toBase58()} (${res.status})`);
  }
  return res.json();
}

export async function fetchJupiterSwapInstructions({
  connection,
  userPublicKey,
  inputMint,
  outputMint,
  amountRaw,
  swapMode = 'ExactIn',
  slippageBps = 300,
  quote: readyQuote,
  maxAccounts = DEFAULT_MAX_ACCOUNTS,
}: {
  connection: Connection;
  userPublicKey: PublicKey;
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountRaw: bigint;
  swapMode?: 'ExactIn' | 'ExactOut';
  slippageBps?: number;
  /** A quote already fetched for this exact swap: saves a Jupiter request */
  quote?: any;
  maxAccounts?: number;
}): Promise<JupiterSwapResult> {
  // SOL legs use direct pools and other legs cap accounts, to keep the whole payment in one transaction
  const quote = readyQuote ?? (await fetchJupiterQuote({ inputMint, outputMint, amountRaw, swapMode, slippageBps, maxAccounts }));
  if (!quote || !quote.outAmount || !quote.inAmount || !quote.otherAmountThreshold) {
    throw new Error('DEX returned no route for swap.');
  }
  const expectation = { user: userPublicKey, inputMint, outputMint, amountRaw, swapMode, slippageBps };
  checkJupiterQuote(quote, expectation);

  const swapRes = await jupiterFetch(`${JUPITER_API}/swap-instructions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey: userPublicKey.toBase58(),
      wrapAndUnwrapSol: true,
    }),
  });

  if (!swapRes.ok) {
    throw new Error(`DEX swap instruction generation failed (${swapRes.status}).`);
  }

  const swapData = await swapRes.json();
  if (!swapData?.swapInstruction) {
    throw new Error('DEX returned no swap instruction.');
  }
  // The swap API's answer goes into the user's transaction: every instruction must be exactly the
  // requested swap for the user (accounts, amount, fee, slippage), or the payment stops here
  const { maxInputRaw } = checkJupiterSwapInstructions(swapData, quote, expectation);
  // Only Jupiter's numbers are used; the transaction gets the app's own ComputeBudget pair
  const { units: computeUnitLimit, microLamports: computeUnitPrice } = readComputeBudget(swapData.computeBudgetInstructions);

  const instructions: TransactionInstruction[] = [];
  const deserialize = (ix: any) =>
    new TransactionInstruction({
      programId: new PublicKey(ix.programId),
      keys: ix.accounts.map((acc: any) => ({
        pubkey: new PublicKey(acc.pubkey),
        isSigner: Boolean(acc.isSigner),
        isWritable: Boolean(acc.isWritable),
      })),
      data: Buffer.from(ix.data, 'base64'),
    });

  if (swapData.setupInstructions) {
    for (const ix of swapData.setupInstructions) {
      instructions.push(deserialize(ix));
    }
  }
  instructions.push(deserialize(swapData.swapInstruction));
  if (swapData.cleanupInstruction) {
    instructions.push(deserialize(swapData.cleanupInstruction));
  }

  const addressLookupTableAccounts: AddressLookupTableAccount[] = [];
  if (swapData.addressLookupTableAddresses && Array.isArray(swapData.addressLookupTableAddresses)) {
    // Loaded in parallel; a missing table would silently bloat the transaction past the size limit
    const load = async (addr: string) => {
      let alt = await connection.getAddressLookupTable(new PublicKey(addr)).catch(() => null);
      if (!alt?.value) alt = await connection.getAddressLookupTable(new PublicKey(addr)).catch(() => null);
      if (!alt?.value) throw new Error('DEX route data could not be loaded. Please try again in a moment.');
      return alt.value;
    };
    addressLookupTableAccounts.push(...(await Promise.all(swapData.addressLookupTableAddresses.map(load))));
  }

  const outAmount = BigInt(quote.outAmount);
  return {
    instructions,
    addressLookupTableAccounts,
    inAmount: BigInt(quote.inAmount),
    outAmount,
    minOutAmount: swapMode === 'ExactIn' ? BigInt(quote.otherAmountThreshold) : outAmount,
    maxInAmount: maxInputRaw,
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
  // Jupiter suggests the unit price; it is capped so the priority fee stays under MAX_PRIORITY_FEE_LAMPORTS
  const suggested = swaps.reduce((max, s) => (s.computeUnitPrice > max ? s.computeUnitPrice : max), 0n);
  const ceiling = (MAX_PRIORITY_FEE_LAMPORTS * 1_000_000n) / BigInt(units);
  const microLamports = suggested > ceiling ? ceiling : suggested;

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
  maxAccounts,
}: {
  connection: Connection;
  payer: PublicKey;
  inputMint: PublicKey;
  amountInRaw: bigint;
  maxAccounts: number;
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
    // Devnet builds only (test mints, no DEX): deposits a test amount. Mainnet builds never reach this
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
    maxAccounts,
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

/** One part of a payment: its instructions and the swaps inside it. */
interface PaymentGroup {
  instructions: TransactionInstruction[];
  swaps: JupiterSwapResult[];
}

/**
 * A payment is two groups that never depend on each other's output, always compiled into ONE
 * atomic transaction (compilePaymentTransactions):
 * - skrGroup: 33% SKR burn + 33% SKR to the treasury (preceded by SOL -> SKR for SOL payments) + proof memo
 * - oreGroup: 34% -> ORE swap + daily tranche deposit (staked in ORE Stake)
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
export async function getArkanaLookupTable(connection: Connection): Promise<AddressLookupTableAccount[]> {
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
  memoNonce,
  maxAccounts = DEFAULT_MAX_ACCOUNTS,
}: {
  connection: Connection;
  userPublicKey: PublicKey;
  treasuryPublicKey: PublicKey;
  amountSkr: number;
  actionLabel?: string;
  /** Random per payment: lets the app find exactly this payment on chain if the wallet reply is lost */
  memoNonce: string;
  /** Jupiter account cap for every swap leg (lowered when a rebuilt payment must be smaller) */
  maxAccounts?: number;
}): Promise<PaymentPlan> {
  const payer = new PublicKey(userPublicKey.toString());
  const treasury = new PublicKey(treasuryPublicKey.toString());

  const decimalsMultiplier = isDevnet() ? 1_000_000_000 : 1_000_000;
  const totalRaw = BigInt(Math.round(amountSkr * decimalsMultiplier));
  const { burnRaw, treasuryRaw, oreShareRaw } = splitPrice(totalRaw);

  // Independent network work runs in parallel: the wallet opens sooner
  const [burnAndTreasury, oreLeg, arkanaTable] = await Promise.all([
    buildBurnAndTreasuryInstructions({ connection, payer, treasury, burnRaw, treasuryRaw }),
    buildOreTrancheInstructions({ connection, payer, inputMint: SKR_MINT, amountInRaw: oreShareRaw, maxAccounts }),
    getArkanaLookupTable(connection),
  ]);

  return {
    skrGroup: {
      instructions: [
        ...burnAndTreasury,
        // Compact proof memo; the server verifies the burn + treasury transfer in this transaction
        buildMemoInstruction(payer, `ARKANA:${actionLabel}:${oreLeg.targetTrancheId}:N=${memoNonce}`),
      ],
      swaps: [],
    },
    oreGroup: { instructions: oreLeg.instructions, swaps: oreLeg.swaps },
    addressLookupTableAccounts: [...arkanaTable, ...oreLeg.addressLookupTableAccounts],
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
  memoNonce,
  maxAccounts = DEFAULT_MAX_ACCOUNTS,
}: {
  connection: Connection;
  userPublicKey: PublicKey;
  treasuryPublicKey: PublicKey;
  amountSkr: number;
  actionLabel?: string;
  /** Random per payment: lets the app find exactly this payment on chain if the wallet reply is lost */
  memoNonce: string;
  /** Jupiter account cap for every swap leg (lowered when a rebuilt payment must be smaller) */
  maxAccounts?: number;
}): Promise<PaymentPlan> {
  if (isDevnet()) {
    throw new Error('SOL payments need a live Jupiter route and are available on mainnet only. Use tSKR on devnet.');
  }

  const payer = new PublicKey(userPublicKey.toString());
  const treasury = new PublicKey(treasuryPublicKey.toString());
  const totalRaw = BigInt(Math.round(amountSkr * 1_000_000));
  const { burnRaw, treasuryRaw, oreShareRaw } = splitPrice(totalRaw);

  // One live quote for SOL -> the 66% SKR share: it sets the SOL price AND is the route that gets
  // signed (never a display rate). Jupiter's free tier allows few requests, so none is wasted.
  const skrQuote = await fetchJupiterQuote({
    inputMint: WSOL_MINT,
    outputMint: SKR_MINT,
    amountRaw: burnRaw + treasuryRaw,
    swapMode: 'ExactOut',
    slippageBps: 100,
    maxAccounts,
  });
  if (!skrQuote?.inAmount) throw new Error('DEX swap quote unavailable for SOL -> SKR. Please try again in a moment.');
  // SOL for the 34% share at the same rate: inAmount buys 66% of the price
  const oreShareLamports = (BigInt(skrQuote.inAmount) * oreShareRaw) / (burnRaw + treasuryRaw);

  // Both swap legs, the treasury check and the lookup table load in parallel: the wallet opens sooner
  const [solToSkr, burnAndTreasury, oreLeg, arkanaTable, shownSol] = await Promise.all([
    // 1. SOL -> exactly burnRaw + treasuryRaw SKR (Jupiter setup creates the user's SKR ATA if needed)
    fetchJupiterSwapInstructions({
      connection,
      userPublicKey: payer,
      inputMint: WSOL_MINT,
      outputMint: SKR_MINT,
      amountRaw: burnRaw + treasuryRaw,
      swapMode: 'ExactOut',
      slippageBps: 100,
      quote: skrQuote,
      maxAccounts,
    }),
    buildBurnAndTreasuryInstructions({ connection, payer, treasury, burnRaw, treasuryRaw }),
    // 2. SOL -> ORE for the 34% share, deposited into today's tranche
    buildOreTrancheInstructions({ connection, payer, inputMint: WSOL_MINT, amountInRaw: oreShareLamports, maxAccounts }),
    getArkanaLookupTable(connection),
    // The SOL price the user was shown (server's live rate), or null when unavailable
    getSkrSolEstimate(amountSkr),
  ]);

  // Hard ceiling on the SOL this payment can spend: the SKR leg at its slippage limit plus the ORE leg
  const solSpend = solToSkr.maxInAmount + oreLeg.swaps.reduce((sum, s) => sum + s.maxInAmount, 0n);
  if (solSpend > MAX_PAYMENT_LAMPORTS) {
    throw new Error(`Refusing a SOL payment of ${Number(solSpend) / 1e9} SOL: above the app's limit.`);
  }
  // Also never far above the price the user was shown, when it is known
  if (shownSol && Number(solSpend) / 1e9 > shownSol * SOL_ESTIMATE_TOLERANCE) {
    throw new Error(`DEX price ${Number(solSpend) / 1e9} SOL is far above the shown ~${shownSol} SOL. Please try again in a moment.`);
  }

  return {
    skrGroup: {
      instructions: [
        ...solToSkr.instructions,
        ...burnAndTreasury,
        buildMemoInstruction(payer, `ARKANA:${actionLabel}:SOL:${oreLeg.targetTrancheId}:N=${memoNonce}`),
      ],
      swaps: [solToSkr],
    },
    oreGroup: { instructions: oreLeg.instructions, swaps: oreLeg.swaps },
    addressLookupTableAccounts: [
      ...arkanaTable,
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
 * Turns a payment plan into ONE atomic transaction. A payment is never split: if only part of a
 * split payment landed, the user would lose the burn and treasury share with nothing credited.
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
  if (!single) throw new Error(ROUTE_TOO_LARGE);
  return [single];
}

const ROUTE_TOO_LARGE = 'DEX route is too large for a Solana transaction. Please try again in a moment.';
// Any valid blockhash gives the same size: used to check a plan fits before asking the wallet
const SIZE_CHECK_BLOCKHASH = PublicKey.default.toBase58();

function planFits(payer: PublicKey, plan: PaymentPlan): boolean {
  try {
    compilePaymentTransactions(payer, SIZE_CHECK_BLOCKHASH, plan);
    return true;
  } catch {
    return false;
  }
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
 * The user approves once: always one atomic transaction.
 * Building the plan runs its independent network calls in parallel, so the wallet opens quickly.
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

  // An unknown balance must never send the user down the SOL path: retry once, then stop
  let currentSkr = await fetchRealSkrBalance(connection, payer);
  if (currentSkr === null) {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    currentSkr = await fetchRealSkrBalance(connection, payer);
  }
  if (currentSkr === null) {
    throw new Error('SKR balance could not be read. Check your connection and try again.');
  }
  if (!(amountSkr > 0) || amountSkr > MAX_PAYMENT_SKR) {
    throw new Error(`Refusing an unexpected price of ${amountSkr} SKR.`);
  }
  const paidWith: 'skr' | 'sol_swap' = !forceSolSwap && currentSkr >= amountSkr ? 'skr' : 'sol_swap';

  const buildPlan = paidWith === 'skr' ? buildSkrPaymentPlan : buildSolPaymentPlan;
  const memoNonce = secureRandomHex(8);
  const planArgs = { connection, userPublicKey: payer, treasuryPublicKey: treasury, amountSkr, actionLabel, memoNonce };
  let plan = await buildPlan(planArgs);
  if (!planFits(payer, plan)) {
    // Ask Jupiter for shorter routes once; if it still does not fit, stop before anything is signed
    plan = await buildPlan({ ...planArgs, maxAccounts: REDUCED_MAX_ACCOUNTS });
    if (!planFits(payer, plan)) throw new Error(ROUTE_TOO_LARGE);
  }

  const { signatures } = await executeSolanaTransaction({
    connection,
    payerKey: payer,
    buildTransactions: (blockhash) => compilePaymentTransactions(payer, blockhash, plan),
    signAndSendTransactions,
    // Only this payment's own random nonce: a memo someone else sends to the wallet never matches
    recoverMemo: `:N=${memoNonce}`,
    // Stored the moment the wallet answers: if the request never reaches the server, the next app
    // start sends the signature to /api/payment/credit and the payment is credited anyway
    onSigned: async (sigs) =>
      savePendingPayment(payer.toBase58(), {
        kind: 'unsubmitted',
        signature: sigs[0],
        body: { wallet: payer.toBase58(), txSignature: sigs[0], actionLabel },
        createdAt: Date.now(),
      }),
  });

  // One transaction: burn, treasury transfer, ORE tranche deposit and memo. The server verifies it.
  return { signature: signatures[0], paidWith, costSkr: amountSkr };
}
