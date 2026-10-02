import { PublicKey } from '@solana/web3.js';
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { Buffer } from 'buffer';

/**
 * Strict check of a Jupiter swap before it goes into the user's transaction. The swap API answer
 * comes through the Arkana server, so it is treated as untrusted: every instruction must be one of
 * the few shapes a plain wSOL / SPL swap needs, with the user's own accounts, the requested amount,
 * no platform fee and no more slippage than asked. Anything else throws before the wallet opens.
 *
 * Layouts are from Jupiter v6's on-chain IDL (JUP6...: anchor:idl account) and were checked against
 * live api.jup.ag/swap/v1 answers. No React Native imports here, so it can be tested in plain Node.
 */

export const JUPITER_V6_PROGRAM_ID = new PublicKey('JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4');
export const WSOL_MINT = new PublicKey('So11111111111111111111111111111111111111112');
const SYSTEM_PROGRAM = '11111111111111111111111111111111';
const TOKEN_PROGRAM = TOKEN_PROGRAM_ID.toBase58();
const ATA_PROGRAM = 'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL';
const COMPUTE_BUDGET_PROGRAM = 'ComputeBudget111111111111111111111111111111';
const JUP = JUPITER_V6_PROGRAM_ID.toBase58();
// Anchor's event-CPI authority of Jupiter v6
const JUP_EVENT_AUTHORITY = PublicKey.findProgramAddressSync([Buffer.from('__event_authority')], JUPITER_V6_PROGRAM_ID)[0].toBase58();

export interface JupiterInstructionJson {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string;
}

export interface SwapExpectation {
  user: PublicKey;
  inputMint: PublicKey;
  outputMint: PublicKey;
  amountRaw: bigint;
  swapMode: 'ExactIn' | 'ExactOut';
  /** Highest slippage the app asked for. */
  slippageBps: number;
}

export interface CheckedSwap {
  /** Most input the swap may take: ExactIn = amountRaw, ExactOut = quoted input + slippage. */
  maxInputRaw: bigint;
}

function fail(why: string): never {
  throw new Error(`DEX route rejected: ${why}. Payment cancelled before signing.`);
}

// sha256("global:<name>")[0..8]
type RouteKind = 'route' | 'exact_out_route' | 'shared_accounts_route' | 'shared_accounts_exact_out_route'
  | 'route_v2' | 'exact_out_route_v2' | 'shared_accounts_route_v2' | 'shared_accounts_exact_out_route_v2';
const ROUTE_DISCRIMINATORS: Record<string, RouteKind> = {
  'e517cb977ae3ad2a': 'route',
  'd033ef977b2bed5c': 'exact_out_route',
  'c1209b3341d69c81': 'shared_accounts_route',
  'b0d169a89a7d453e': 'shared_accounts_exact_out_route',
  'bb64facc31c4af14': 'route_v2',
  '9d8ab85215f4f324': 'exact_out_route_v2',
  'd19853937cfed8e9': 'shared_accounts_route_v2',
  '3560e5cad8bbfa18': 'shared_accounts_exact_out_route_v2',
};

/**
 * Account positions per route instruction (IDL order). Optional accounts that must be absent hold
 * the Jupiter program id (Anchor's "None").
 */
interface RouteLayout {
  tokenPrograms: number[];
  programAuthority?: number;
  programSource?: number;
  programDestination?: number;
  authority: number;
  source: number;
  destination: number;
  sourceMint?: number;
  destinationMint: number;
  mustBeNone: number[];
  eventAuthority: number;
  program: number;
  shared: boolean;
  v2: boolean;
  exactOut: boolean;
}
const LAYOUTS: Record<RouteKind, RouteLayout> = {
  // token_program, user_transfer_authority, user_source, user_destination, destination_token_account?,
  // destination_mint, platform_fee_account?, event_authority, program
  route: { tokenPrograms: [0], authority: 1, source: 2, destination: 3, destinationMint: 5, mustBeNone: [4, 6], eventAuthority: 7, program: 8, shared: false, v2: false, exactOut: false },
  // ..., destination_token_account?, source_mint, destination_mint, platform_fee_account?, token_2022_program?, event_authority, program
  exact_out_route: { tokenPrograms: [0], authority: 1, source: 2, destination: 3, sourceMint: 5, destinationMint: 6, mustBeNone: [4, 7, 8], eventAuthority: 9, program: 10, shared: false, v2: false, exactOut: true },
  // token_program, program_authority, user_transfer_authority, source, program_source, program_destination,
  // destination, source_mint, destination_mint, platform_fee_account?, token_2022_program?, event_authority, program
  shared_accounts_route: { tokenPrograms: [0], programAuthority: 1, authority: 2, source: 3, programSource: 4, programDestination: 5, destination: 6, sourceMint: 7, destinationMint: 8, mustBeNone: [9, 10], eventAuthority: 11, program: 12, shared: true, v2: false, exactOut: false },
  shared_accounts_exact_out_route: { tokenPrograms: [0], programAuthority: 1, authority: 2, source: 3, programSource: 4, programDestination: 5, destination: 6, sourceMint: 7, destinationMint: 8, mustBeNone: [9, 10], eventAuthority: 11, program: 12, shared: true, v2: false, exactOut: true },
  // user_transfer_authority, user_source, user_destination, source_mint, destination_mint,
  // source_token_program, destination_token_program, destination_token_account?, event_authority, program
  route_v2: { tokenPrograms: [5, 6], authority: 0, source: 1, destination: 2, sourceMint: 3, destinationMint: 4, mustBeNone: [7], eventAuthority: 8, program: 9, shared: false, v2: true, exactOut: false },
  exact_out_route_v2: { tokenPrograms: [5, 6], authority: 0, source: 1, destination: 2, sourceMint: 3, destinationMint: 4, mustBeNone: [7], eventAuthority: 8, program: 9, shared: false, v2: true, exactOut: true },
  // program_authority, user_transfer_authority, source, program_source, program_destination, destination,
  // source_mint, destination_mint, source_token_program, destination_token_program, event_authority, program
  shared_accounts_route_v2: { tokenPrograms: [8, 9], programAuthority: 0, authority: 1, source: 2, programSource: 3, programDestination: 4, destination: 5, sourceMint: 6, destinationMint: 7, mustBeNone: [], eventAuthority: 10, program: 11, shared: true, v2: true, exactOut: false },
  shared_accounts_exact_out_route_v2: { tokenPrograms: [8, 9], programAuthority: 0, authority: 1, source: 2, programSource: 3, programDestination: 4, destination: 5, sourceMint: 6, destinationMint: 7, mustBeNone: [], eventAuthority: 10, program: 11, shared: true, v2: true, exactOut: true },
};

/**
 * Borsh sizes of Jupiter's `Swap` enum payloads, by variant index, generated from the on-chain IDL
 * (191 variants). A number is a fixed byte count; {o} option, {v} vec, {e} enum, 's' bytes, an array
 * is a sequence. v1 route data ends with the amounts but Anchor ignores trailing bytes, so the route
 * plan has to be walked to find where the amounts really are. A newer venue than this table fails safe.
 */
type Shape = number | 's' | { o: Shape } | { v: Shape } | { e: Shape[] } | Shape[];
const SWAP_VARIANTS: Shape[] = JSON.parse(
  '[0,0,0,0,0,0,0,0,1,0,0,0,{"e":[0,0]},0,0,{"e":[0,0]},{"e":[0,0]},1,1,0,0,1,0,1,{"e":[0,0]},0,0,{"e":[0,0]},{"e":[0,0]},16,0,0,0,4,0,0,0,0,0,{"e":[0,0]},0,4,3,10,5,5,0,[1,{"o":{"v":2}}],0,0,0,0,0,0,0,0,0,0,1,0,1,1,0,0,{"e":[0,0]},0,0,0,0,0,0,2,0,0,0,{"v":2},0,0,0,0,0,8,8,0,0,{"e":[0,0]},2,9,0,{"e":[0,0]},0,0,0,0,1,1,0,0,0,0,0,0,0,[1,{"o":{"v":2}}],1,0,1,{"e":[0,0]},0,0,{"e":[0,0]},[{"v":{"e":[9,{"e":[0,0]},9,0,0,1,0,1,1,1,[1,{"o":{"v":2}}],0,1,0,{"e":[0,0]},57,65,81]}},{"o":1}],0,0,0,0,{"e":[0,0]},1,9,1,[{"e":[0,0]},"s"],1,16,48,0,{"e":[0,0]},[{"e":[0,0]},8,8],1,0,1,0,0,{"e":[0,0,0,0,0,0,0,0]},0,0,10,1,0,0,0,0,1,0,0,0,1,[{"v":[{"e":[9,{"e":[0,0]},9,0,0,1,0,1,1,1,[1,{"o":{"v":2}}],0,1,0,{"e":[0,0]},57,65,81]},4]},1,1],0,0,0,0,1,1,1,0,[{"e":[0,0]},1],0,9,0,8,1,[{"e":[0,0]},4],1,0,1,1,1,2,1,0,1,{"e":[0,0,0]},{"e":[0,0,0,0,0,0,0,0]},0,{"e":[0,0]},0,0,1,{"e":[0,0]},0,0,1,{"e":[0,0]},[{"e":[0,0]},{"o":1}],1,57,65,2,0,1,81]'
);

/** Returns the offset after a value of `shape` starting at `at`. */
function skipShape(data: Buffer, at: number, shape: Shape): number {
  const need = (n: number) => {
    if (at + n > data.length) fail('malformed route data');
  };
  if (typeof shape === 'number') {
    need(shape);
    return at + shape;
  }
  if (shape === 's') {
    need(4);
    const len = data.readUInt32LE(at);
    need(4 + len);
    return at + 4 + len;
  }
  if (Array.isArray(shape)) return shape.reduce((pos: number, s) => skipShape(data, pos, s), at);
  if ('o' in shape) {
    need(1);
    if (data[at] > 1) fail('malformed route data');
    return data[at] === 1 ? skipShape(data, at + 1, shape.o) : at + 1;
  }
  if ('v' in shape) {
    need(4);
    const count = data.readUInt32LE(at);
    if (count > 64) fail('malformed route data');
    let pos = at + 4;
    for (let i = 0; i < count; i++) pos = skipShape(data, pos, shape.v);
    return pos;
  }
  need(1);
  const variant = shape.e[data[at]];
  if (variant === undefined) fail('unknown route step');
  return skipShape(data, at + 1, variant);
}

interface RouteAmounts {
  amount: bigint;
  quoted: bigint;
  slippageBps: number;
  platformFeeBps: number;
  positiveSlippageBps: number;
}

function parseRouteAmounts(data: Buffer, layout: RouteLayout): RouteAmounts {
  let pos = 8 + (layout.shared ? 1 : 0);
  if (layout.v2) {
    // v2: fixed fields first, then the route plan
    if (data.length < pos + 22) fail('malformed route data');
    return {
      amount: data.readBigUInt64LE(pos),
      quoted: data.readBigUInt64LE(pos + 8),
      slippageBps: data.readUInt16LE(pos + 16),
      platformFeeBps: data.readUInt16LE(pos + 18),
      positiveSlippageBps: data.readUInt16LE(pos + 20),
    };
  }
  if (data.length < pos + 4) fail('malformed route data');
  const steps = data.readUInt32LE(pos);
  if (steps === 0 || steps > 16) fail('unexpected route length');
  pos += 4;
  for (let i = 0; i < steps; i++) {
    if (pos >= data.length) fail('malformed route data');
    const variant = SWAP_VARIANTS[data[pos]];
    if (variant === undefined) fail('route uses a venue this app version does not know');
    // + percent, input_index, output_index
    pos = skipShape(data, pos + 1, variant) + 3;
  }
  // amount u64, quoted u64, slippage_bps u16, platform_fee_bps u8, and nothing after
  if (data.length !== pos + 19) fail('malformed route data');
  return {
    amount: data.readBigUInt64LE(pos),
    quoted: data.readBigUInt64LE(pos + 8),
    slippageBps: data.readUInt16LE(pos + 16),
    platformFeeBps: data[pos + 18],
    positiveSlippageBps: 0,
  };
}

/**
 * Hex of the first `n` bytes. Written out by hand: on Hermes (the app's JS engine) subarray() returns a
 * plain Uint8Array, whose toString ignores 'hex', so every route looked unknown.
 */
function hexPrefix(bytes: ArrayLike<number>, n: number): string {
  let out = '';
  for (let i = 0; i < n && i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
}

const ata = (owner: PublicKey, mint: PublicKey) => getAssociatedTokenAddressSync(mint, owner, true).toBase58();

/** The quote must be for exactly this swap, with no platform fee and no extra slippage. */
export function checkJupiterQuote(quote: any, exp: SwapExpectation): void {
  if (!quote || quote.inputMint !== exp.inputMint.toBase58() || quote.outputMint !== exp.outputMint.toBase58()) {
    fail('quote is for other tokens');
  }
  if (quote.swapMode !== exp.swapMode) fail('quote has the wrong swap mode');
  const fixed = exp.swapMode === 'ExactIn' ? quote.inAmount : quote.outAmount;
  if (String(fixed) !== exp.amountRaw.toString()) fail('quote amount differs from the payment');
  if (!(Number(quote.slippageBps) >= 0 && Number(quote.slippageBps) <= exp.slippageBps)) fail('quote slippage too high');
  if (quote.platformFee && BigInt(quote.platformFee.amount || 0) > 0n) fail('quote carries a platform fee');
}

/** Reads Jupiter's compute budget suggestion; these are never put into the transaction as-is. */
export function readComputeBudget(list: JupiterInstructionJson[] | undefined): { units: number; microLamports: bigint } {
  let units = 0;
  let microLamports = 0n;
  for (const ix of list || []) {
    if (ix?.programId !== COMPUTE_BUDGET_PROGRAM) fail('unexpected compute budget program');
    const data = Buffer.from(ix.data, 'base64');
    // [2, u32 LE] = SetComputeUnitLimit, [3, u64 LE] = SetComputeUnitPrice
    if (data[0] === 2 && data.length >= 5) units = data.readUInt32LE(1);
    if (data[0] === 3 && data.length >= 9) microLamports = data.readBigUInt64LE(1);
  }
  return { units, microLamports };
}

/**
 * Checks every setup / swap / cleanup instruction of a /swap-instructions answer. Throws on anything
 * that is not exactly the expected swap for the user.
 */
export function checkJupiterSwapInstructions(swapData: any, quote: any, exp: SwapExpectation): CheckedSwap {
  const user = exp.user.toBase58();
  const wsolInvolved = exp.inputMint.equals(WSOL_MINT) || exp.outputMint.equals(WSOL_MINT);
  const wsolAta = ata(exp.user, WSOL_MINT);
  const userSource = ata(exp.user, exp.inputMint);
  const userDestination = ata(exp.user, exp.outputMint);

  const keysOf = (ix: JupiterInstructionJson): string[] => {
    if (!ix || typeof ix.programId !== 'string' || !Array.isArray(ix.accounts) || typeof ix.data !== 'string') {
      fail('malformed instruction');
    }
    // No signer other than the user, anywhere
    if (ix.accounts.some((a) => a.isSigner && a.pubkey !== user)) fail('unexpected signer');
    return ix.accounts.map((a) => String(a.pubkey));
  };

  // --- Swap instruction: one Jupiter route, user accounts, exact amount, no fee ---
  const swapIx: JupiterInstructionJson = swapData?.swapInstruction;
  const sk = keysOf(swapIx);
  if (swapIx.programId !== JUP) fail('swap is not a Jupiter v6 route');
  const data = Buffer.from(swapIx.data, 'base64');
  const kind = ROUTE_DISCRIMINATORS[hexPrefix(data, 8)];
  if (!kind) fail('swap is not a route instruction');
  const L = LAYOUTS[kind];
  if (L.exactOut !== (exp.swapMode === 'ExactOut')) fail('route has the wrong swap mode');
  if (sk.length <= L.program) fail('route has too few accounts');
  if (sk[L.authority] !== user || !swapIx.accounts[L.authority].isSigner) fail('route authority is not the wallet');
  if (sk[L.source] !== userSource) fail('route takes tokens from another account');
  if (sk[L.destination] !== userDestination) fail('route sends tokens to another account');
  if (L.sourceMint !== undefined && sk[L.sourceMint] !== exp.inputMint.toBase58()) fail('route input token differs');
  if (sk[L.destinationMint] !== exp.outputMint.toBase58()) fail('route output token differs');
  // Platform fee account, alternative destination and Token-2022 must all be absent
  if (L.mustBeNone.some((i) => sk[i] !== JUP)) fail('route has a fee or extra destination account');
  if (L.tokenPrograms.some((i) => sk[i] !== TOKEN_PROGRAM)) fail('route uses an unexpected token program');
  if (sk[L.eventAuthority] !== JUP_EVENT_AUTHORITY || sk[L.program] !== JUP) fail('route accounts are malformed');
  if (L.shared) {
    const id = data[8];
    const authority = PublicKey.findProgramAddressSync([Buffer.from('authority'), Buffer.from([id])], JUPITER_V6_PROGRAM_ID)[0];
    if (sk[L.programAuthority!] !== authority.toBase58()) fail('route program authority is wrong');
    if (sk[L.programSource!] !== ata(authority, exp.inputMint) || sk[L.programDestination!] !== ata(authority, exp.outputMint)) {
      fail('route program accounts are wrong');
    }
  }

  const amounts = parseRouteAmounts(data, L);
  if (amounts.amount !== exp.amountRaw) fail('route amount differs from the payment');
  if (amounts.slippageBps > exp.slippageBps) fail('route slippage is higher than requested');
  if (amounts.platformFeeBps !== 0 || amounts.positiveSlippageBps !== 0) fail('route charges a platform fee');
  // The route's quoted side must match the quote the price was taken from
  const quotedSide = exp.swapMode === 'ExactIn' ? quote?.outAmount : quote?.inAmount;
  if (String(quotedSide) !== amounts.quoted.toString()) fail('route quote differs from the quote');

  // ExactOut may spend up to the quoted input plus slippage (rounded up, as Jupiter's threshold)
  const maxInputRaw = exp.swapMode === 'ExactIn'
    ? exp.amountRaw
    : (amounts.quoted * BigInt(10_000 + amounts.slippageBps) + 9_999n) / 10_000n;
  if (exp.swapMode === 'ExactOut' && BigInt(quote?.otherAmountThreshold ?? 0) > maxInputRaw) {
    fail('quote input limit is above the route limit');
  }

  // --- Setup: create the user's own token accounts, wrap SOL into the user's wSOL account ---
  let wraps = 0;
  for (const ix of swapData?.setupInstructions || []) {
    const k = keysOf(ix);
    const d = Buffer.from(ix.data, 'base64');
    if (ix.programId === ATA_PROGRAM) {
      // Create (empty or 0) / CreateIdempotent (1): payer, ata, wallet, mint, system, token program
      if (!(d.length === 0 || (d.length === 1 && (d[0] === 0 || d[0] === 1)))) fail('unexpected token account instruction');
      if (k.length !== 6 || k[0] !== user || k[2] !== user || k[4] !== SYSTEM_PROGRAM || k[5] !== TOKEN_PROGRAM) {
        fail('token account is created for someone else');
      }
      if (k[3] !== exp.inputMint.toBase58() && k[3] !== exp.outputMint.toBase58()) fail('token account for an unexpected token');
      if (k[1] !== ata(exp.user, new PublicKey(k[3]))) fail('token account address is wrong');
    } else if (ix.programId === SYSTEM_PROGRAM) {
      // Transfer (2): lamports from the user into the user's wSOL account, once, within the input limit
      if (!exp.inputMint.equals(WSOL_MINT) || d.length !== 12 || d.readUInt32LE(0) !== 2) fail('unexpected System instruction');
      if (k.length !== 2 || k[0] !== user || k[1] !== wsolAta) fail('SOL is sent to another account');
      if (d.readBigUInt64LE(4) > maxInputRaw) fail('SOL wrap is larger than the swap');
      if (++wraps > 1) fail('more than one SOL wrap');
    } else if (ix.programId === TOKEN_PROGRAM) {
      // SyncNative (17) on the user's wSOL account only
      if (!wsolInvolved || d.length !== 1 || d[0] !== 17 || k.length !== 1 || k[0] !== wsolAta) fail('unexpected token instruction');
    } else {
      fail(`unexpected program ${ix.programId}`);
    }
  }

  // --- Cleanup: only closing the user's wSOL account back to the user ---
  const cleanup = swapData?.cleanupInstruction;
  if (cleanup) {
    const k = keysOf(cleanup);
    const d = Buffer.from(cleanup.data, 'base64');
    if (cleanup.programId !== TOKEN_PROGRAM || !wsolInvolved || d.length !== 1 || d[0] !== 9) fail('unexpected cleanup instruction');
    if (k.length !== 3 || k[0] !== wsolAta || k[1] !== user || k[2] !== user) fail('cleanup sends funds to another account');
  }

  return { maxInputRaw };
}
