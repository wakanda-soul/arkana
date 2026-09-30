/**
 * On-chain verification of paid actions.
 *
 * The app pays on-chain and then tells the server "I paid, here is the signature".
 * The server never trusts that claim: it loads the transaction and checks that the
 * wallet itself signed it, that 33% of the price in SKR was burned and 33% reached the
 * Arkana treasury, that the memo names the action, that it is recent, and that the
 * signature was never used before.
 */
const path = require("path");
const { Connection, PublicKey } = require("@solana/web3.js");
const { readJson, writeJsonAtomic } = require("../storage/jsonStore");

const RPC_URL = process.env.SOLANA_RPC_URL || "https://solana-rpc.publicnode.com";
const USED_FILE = path.join(__dirname, "..", "..", "data", "used_payments.json");

const bs58 = require("bs58").default || require("bs58");

const SKR_MINT = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";
const ORE_MINT = "oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp";
const ARKANA_VAULT_PROGRAM = "B49g3obWUCPQzP9kdcRiCPJDurufWhJhszpQsK5eeV8C";
/** The tranche deposit is the swap's guaranteed minimum (up to 3% slippage) at a slightly older quote. */
const ORE_SHARE_TOLERANCE_PCT = 85n;
const SKR_DECIMALS = 6;
const TREASURY = "4v3d1itZVjLtDQEqGLFLtfr1riffAEcqnNtumEumJgny";
const TOKEN_PROGRAMS = new Set([
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
]);
const MAX_TX_AGE_SECONDS = 30 * 60;
// Each verification may hold an RPC slot for several seconds; beyond this many the caller answers 503
const MAX_CONCURRENT_VERIFICATIONS = 8;
const FETCH_ATTEMPTS = 5;
const FETCH_RETRY_MS = 2500;
const SIGNATURE_RE = /^[1-9A-HJ-NP-Za-km-z]{86,90}$/;

const SGT_MINT_AUTHORITY = "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4";
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const SEEKER_CACHE_MS = 60 * 60 * 1000;

const connection = new Connection(RPC_URL, "confirmed");
const inFlight = new Set();
let activeVerifications = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** A base58 transaction signature (64 bytes); checked before any RPC call. */
function isValidTxSignature(signature) {
  return typeof signature === "string" && SIGNATURE_RE.test(signature);
}

// Throws on a corrupt file: treating it as {} would make every old payment reusable
function loadUsed() {
  return readJson(USED_FILE);
}

function markUsed(signature, record) {
  const used = loadUsed();
  used[signature] = record;
  writeJsonAtomic(USED_FILE, used);
}

/** The app calls right after sending: give the transaction time to confirm (about 10 s at most). */
async function fetchTransaction(signature) {
  for (let attempt = 0; attempt < FETCH_ATTEMPTS; attempt++) {
    try {
      const tx = await connection.getParsedTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (tx) return tx;
    } catch {}
    if (attempt < FETCH_ATTEMPTS - 1) await sleep(FETCH_RETRY_MS);
  }
  return null;
}

function allParsedInstructions(tx) {
  const top = tx.transaction.message.instructions || [];
  const inner = (tx.meta.innerInstructions || []).flatMap((i) => i.instructions || []);
  return [...top, ...inner];
}

function toRaw(amountSkr) {
  return BigInt(Math.round(Number(amountSkr) * 10 ** SKR_DECIMALS));
}

/**
 * Verifies that `signature` is a real Arkana payment of `amountSkr` by `wallet` for `actionLabel`.
 * Marks the signature as used on success. Returns { ok: true } or { ok: false, error }.
 */
/**
 * `signature` is the transaction with the burn, the treasury transfer and the memo.
 * `extraSignatures` holds the ORE tranche transaction when the app had to split the payment in two.
 */
async function verifyPayment({ wallet, signature, extraSignatures = [], amountSkr, actionLabel }) {
  if (!wallet || !signature || !amountSkr || !actionLabel) {
    return { ok: false, error: "Payment signature is required." };
  }
  if (!isValidTxSignature(signature)) return { ok: false, error: "Invalid payment signature." };
  // Unique extras only: a repeated tranche signature must not count its ORE deposit twice
  const extras = [...new Set(Array.isArray(extraSignatures) ? extraSignatures : [])]
    .filter((s) => s !== signature)
    .slice(0, 2);
  if (!extras.every(isValidTxSignature)) return { ok: false, error: "Invalid payment signature." };
  const all = [signature, ...extras];
  // Reserve the signatures synchronously: parallel requests with one payment must not all pass
  const used = loadUsed();
  if (all.some((s) => used[s] || inFlight.has(s))) {
    return { ok: false, error: "This payment was already used." };
  }
  if (activeVerifications >= MAX_CONCURRENT_VERIFICATIONS) {
    return { ok: false, busy: true, error: "The server is busy verifying payments. Please retry in a moment." };
  }
  activeVerifications++;
  all.forEach((s) => inFlight.add(s));
  try {
    return await verifyReserved({ wallet, signature, extras, amountSkr, actionLabel });
  } finally {
    activeVerifications--;
    all.forEach((s) => inFlight.delete(s));
  }
}

/** Loads a payment transaction and checks it succeeded, is recent and was signed by `wallet`. */
async function loadPaymentTx(signature, wallet) {
  const tx = await fetchTransaction(signature);
  if (!tx) return { error: "Payment transaction not found on-chain yet. Try again in a minute." };
  if (tx.meta?.err) return { error: "Payment transaction failed on-chain." };
  if (!tx.blockTime || Date.now() / 1000 - tx.blockTime > MAX_TX_AGE_SECONDS) {
    return { error: "Payment transaction is too old." };
  }
  const signers = tx.transaction.message.accountKeys.filter((k) => k.signer).map((k) => k.pubkey.toBase58());
  if (!signers.includes(wallet)) return { error: "Payment was not signed by this wallet." };
  return { tx };
}

/** ORE deposited by `wallet` into its Arkana tranche (DepositTranche = instruction 1). */
function oreDeposited(tx, wallet) {
  let total = 0n;
  for (const ix of tx.transaction.message.instructions) {
    const programId = ix.programId?.toBase58?.() || ix.programId;
    if (programId !== ARKANA_VAULT_PROGRAM || !ix.data) continue;
    const data = Buffer.from(bs58.decode(ix.data));
    const signer = ix.accounts?.[0]?.toBase58?.() || ix.accounts?.[0];
    if (data.length >= 9 && data[0] === 1 && signer === wallet) total += data.readBigUInt64LE(1);
  }
  return total;
}

/** ORE the 34% share of `amountSkr` buys at market right now (Jupiter quote), or null. */
async function oreForSkrShare(amountSkr) {
  try {
    const shareRaw = toRaw(amountSkr) - 2n * ((toRaw(amountSkr) * 33n) / 100n);
    const res = await fetch(
      `https://api.jup.ag/swap/v1/quote?inputMint=${SKR_MINT}&outputMint=${ORE_MINT}&amount=${shareRaw}&slippageBps=300&maxAccounts=24`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!res.ok) return null;
    return BigInt((await res.json()).outAmount);
  } catch {
    return null;
  }
}

async function verifyReserved({ wallet, signature, extras, amountSkr, actionLabel }) {
  const primary = await loadPaymentTx(signature, wallet);
  if (primary.error) return { ok: false, error: primary.error };
  const tx = primary.tx;

  const logs = (tx.meta.logMessages || []).join("\n");
  if (!logs.includes(`ARKANA:${actionLabel}:`)) {
    return { ok: false, error: "Payment memo does not match this action." };
  }

  const shareRaw = (toRaw(amountSkr) * 33n) / 100n;
  // 33% SKR burned by the wallet
  let burnedRaw = 0n;
  for (const ix of allParsedInstructions(tx)) {
    if (!TOKEN_PROGRAMS.has(ix.programId?.toBase58?.() || ix.programId)) continue;
    const parsed = ix.parsed;
    if (!parsed || (parsed.type !== "burn" && parsed.type !== "burnChecked")) continue;
    const info = parsed.info;
    if (info.mint !== SKR_MINT || info.authority !== wallet) continue;
    burnedRaw += BigInt(info.amount ?? info.tokenAmount?.amount ?? 0);
  }
  if (burnedRaw < shareRaw) {
    return { ok: false, error: "Payment did not burn the required SKR." };
  }

  // 33% SKR received by the treasury
  const treasuryBalance = (list) =>
    (list || [])
      .filter((b) => b.mint === SKR_MINT && b.owner === TREASURY)
      .reduce((sum, b) => sum + BigInt(b.uiTokenAmount.amount), 0n);
  const receivedRaw = treasuryBalance(tx.meta.postTokenBalances) - treasuryBalance(tx.meta.preTokenBalances);
  if (receivedRaw < shareRaw) {
    return { ok: false, error: "Payment did not reach the Arkana treasury." };
  }

  // 34% of the price must have gone to ORE in the user's tranche
  let deposited = oreDeposited(tx, wallet);
  for (const extra of extras) {
    const loaded = await loadPaymentTx(extra, wallet);
    if (loaded.error) return { ok: false, error: loaded.error };
    deposited += oreDeposited(loaded.tx, wallet);
  }
  if (deposited === 0n) {
    return { ok: false, error: "Payment did not deposit the 34% ORE share." };
  }
  // Without a market quote the deposit cannot be judged, so the payment is not accepted yet
  const expected = await oreForSkrShare(amountSkr);
  if (!expected) {
    return { ok: false, error: "Could not verify the ORE share right now. Please retry in a minute." };
  }
  if (deposited * 100n < expected * ORE_SHARE_TOLERANCE_PCT) {
    return { ok: false, error: "Payment deposited too little ORE." };
  }

  for (const extra of extras) {
    markUsed(extra, { wallet, actionLabel, amountSkr, partOf: signature, verifiedAt: new Date().toISOString() });
  }
  markUsed(signature, { wallet, actionLabel, amountSkr, blockTime: tx.blockTime, verifiedAt: new Date().toISOString() });
  return { ok: true };
}

const seekerCache = new Map();

/** Seeker Genesis Token check: a Token-2022 token whose mint authority is the SGT authority. */
/** true / false from chain, or null when the RPC failed and nothing is cached. */
async function isSeekerHolderOnChain(wallet) {
  const cached = seekerCache.get(wallet);
  if (cached && Date.now() - cached.at < SEEKER_CACHE_MS) return cached.value;

  let value = false;
  try {
    const accounts = await connection.getParsedTokenAccountsByOwner(new PublicKey(wallet), {
      programId: TOKEN_2022_PROGRAM,
    });
    for (const item of accounts.value) {
      const info = item.account.data.parsed?.info;
      if (!info || !(Number(info.tokenAmount?.amount) > 0)) continue;
      const mint = await connection.getParsedAccountInfo(new PublicKey(info.mint));
      if (mint.value?.data?.parsed?.info?.mintAuthority === SGT_MINT_AUTHORITY) {
        value = true;
        break;
      }
    }
  } catch (err) {
    // RPC failure: keep the previous answer if we have one; otherwise the answer is unknown (null),
    // which the caller must never treat as "not a holder" or "holder"
    if (cached) return cached.value;
    return null;
  }
  seekerCache.set(wallet, { value, at: Date.now() });
  return value;
}

module.exports = { verifyPayment, isSeekerHolderOnChain, isValidTxSignature };
