/**
 * Clock-In proof from chain.
 *
 * A Clock-In counts only when the wallet signed today's Daily Consensus memo on chain.
 * verifyClockInTx() checks one transaction; POST /api/clock-in uses it for the signature the app
 * sends, and findTodayClockIn() uses it for recovery.
 *
 * Recovery: the wallet sometimes sends the memo but its reply never reaches the app (the MWA
 * session drops while switching back), so the app never posts /api/clock-in. When a wallet that has
 * not clocked in today asks for its status, look for today's ARKANA::CONSENSUS memo signed by that
 * wallet and record it.
 */
const RPC_URL = process.env.SOLANA_RPC_URL || "https://solana-rpc.publicnode.com";
const MEMO_RE = /ARKANA::CONSENSUS::v1::CARD=(\d{1,2})::ORIENTATION=(UPRIGHT|REVERSED)::DATE=(\d{4}-\d{2}-\d{2})/;
const MEMO_PROGRAMS = new Set([
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
  "Memo1UhkJRfHyvLMcVucJwxXeuD728EqVDDwQDxFMNo",
]);
const CHECK_INTERVAL_MS = 10_000;
const RPC_TIMEOUT_MS = 8000;
// The app posts right after sending: the transaction may need a few seconds to be visible
const FETCH_ATTEMPTS = 5;
const FETCH_RETRY_MS = 2500;

const lastCheck = new Map();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(RPC_TIMEOUT_MS),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "RPC error");
  return data.result;
}

const utcDay = (ms) => new Date(ms).toISOString().slice(0, 10);

async function getTransaction(signature, attempts) {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const tx = await rpc("getTransaction", [signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]);
      if (tx) return tx;
    } catch {}
    if (attempt < attempts - 1) await sleep(FETCH_RETRY_MS);
  }
  return null;
}

/** Memo texts of a jsonParsed transaction (top-level and inner memo instructions). */
function memoTexts(tx) {
  const top = tx.transaction?.message?.instructions || [];
  const inner = (tx.meta?.innerInstructions || []).flatMap((i) => i.instructions || []);
  return [...top, ...inner]
    .filter((ix) => (ix.program === "spl-memo" || MEMO_PROGRAMS.has(ix.programId)) && typeof ix.parsed === "string")
    .map((ix) => ix.parsed);
}

/**
 * Checks that `signature` is a successful transaction signed by `wallet`, made today (UTC), with
 * today's Clock-In memo. Returns { cardNo: "07", orientation: "upright", signature, slot } or { error }.
 * `attempts` > 1 waits for a transaction that is not visible yet.
 */
async function verifyClockInTx(signature, wallet, { attempts = FETCH_ATTEMPTS } = {}) {
  const tx = await getTransaction(signature, attempts);
  if (!tx) return { error: "Clock-In transaction not found on-chain yet. Try again in a minute." };
  if (tx.meta?.err) return { error: "Clock-In transaction failed on-chain." };

  const today = utcDay(Date.now());
  if (!tx.blockTime || utcDay(tx.blockTime * 1000) !== today) {
    return { error: "Clock-In transaction is not from today." };
  }
  const keys = tx.transaction?.message?.accountKeys || [];
  if (!keys.some((k) => k.pubkey === wallet && k.signer)) {
    return { error: "Clock-In transaction was not signed by this wallet." };
  }

  for (const text of memoTexts(tx)) {
    const m = MEMO_RE.exec(text);
    if (!m || m[3] !== today) continue;
    const cardNo = m[1].padStart(2, "0");
    return { cardNo, orientation: m[2].toLowerCase(), signature, slot: tx.slot };
  }
  return { error: "Clock-In transaction has no Daily Consensus memo for today." };
}

/** Returns { cardNo, orientation, signature, slot } for today's signed Clock-In memo, or null. */
async function findTodayClockIn(wallet) {
  const now = Date.now();
  if (now - (lastCheck.get(wallet) || 0) < CHECK_INTERVAL_MS) return null;
  lastCheck.set(wallet, now);
  if (lastCheck.size > 50000) {
    for (const [k, at] of lastCheck) if (now - at >= CHECK_INTERVAL_MS) lastCheck.delete(k);
  }

  const today = utcDay(now);
  const sigs = await rpc("getSignaturesForAddress", [wallet, { limit: 15, commitment: "confirmed" }]);
  for (const s of sigs || []) {
    if (s.err || !s.memo || !s.blockTime) continue;
    if (utcDay(s.blockTime * 1000) !== today) continue;
    const m = MEMO_RE.exec(s.memo);
    if (!m || m[3] !== today) continue;

    // The listed memo is only a hint; the transaction itself must pass the same checks as a posted Clock-In
    const found = await verifyClockInTx(s.signature, wallet, { attempts: 1 });
    if (!found.error) return found;
  }
  return null;
}

module.exports = { findTodayClockIn, verifyClockInTx };
