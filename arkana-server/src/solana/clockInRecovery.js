/**
 * Clock-In recovery from chain.
 *
 * The wallet sometimes sends the Daily Consensus memo but its reply never reaches the app (the MWA
 * session drops while switching back), so the app never posts /api/clock-in. The memo itself is
 * proof: when a wallet that has not clocked in today asks for its status, look for today's
 * ARKANA::CONSENSUS memo signed by that wallet and record it.
 */
const RPC_URL = process.env.SOLANA_RPC_URL || "https://solana-rpc.publicnode.com";
const MEMO_RE = /ARKANA::CONSENSUS::v1::CARD=(\d{1,2})::ORIENTATION=(UPRIGHT|REVERSED)::DATE=(\d{4}-\d{2}-\d{2})/;
const CHECK_INTERVAL_MS = 10_000;

const lastCheck = new Map();

async function rpc(method, params) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || "RPC error");
  return data.result;
}

/** Returns { cardNo, orientation, signature, slot } for today's signed Clock-In memo, or null. */
async function findTodayClockIn(wallet) {
  const now = Date.now();
  if (now - (lastCheck.get(wallet) || 0) < CHECK_INTERVAL_MS) return null;
  lastCheck.set(wallet, now);
  if (lastCheck.size > 50000) lastCheck.clear();

  const today = new Date().toISOString().slice(0, 10);
  const sigs = await rpc("getSignaturesForAddress", [wallet, { limit: 15, commitment: "confirmed" }]);
  for (const s of sigs || []) {
    if (s.err || !s.memo || !s.blockTime) continue;
    if (new Date(s.blockTime * 1000).toISOString().slice(0, 10) !== today) continue;
    const m = MEMO_RE.exec(s.memo);
    if (!m || m[3] !== today) continue;

    // The memo lists the wallet as a signer; make sure it really signed this transaction
    const tx = await rpc("getTransaction", [s.signature, { encoding: "jsonParsed", commitment: "confirmed", maxSupportedTransactionVersion: 0 }]);
    const keys = tx?.transaction?.message?.accountKeys || [];
    const signedByWallet = keys.some((k) => k.pubkey === wallet && k.signer);
    if (!tx || tx.meta?.err || !signedByWallet) continue;

    return { cardNo: m[1].padStart(2, "0"), orientation: m[2].toLowerCase(), signature: s.signature, slot: s.slot };
  }
  return null;
}

module.exports = { findTodayClockIn };
