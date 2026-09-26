/**
 * On-chain verification of paid actions.
 *
 * The app pays on-chain and then tells the server "I paid, here is the signature".
 * The server never trusts that claim: it loads the transaction and checks that the
 * wallet itself signed it, that 33% of the price in SKR was burned and 33% reached the
 * Arkana treasury, that the memo names the action, that it is recent, and that the
 * signature was never used before.
 */
const fs = require("fs");
const path = require("path");
const { Connection, PublicKey } = require("@solana/web3.js");

const RPC_URL = process.env.SOLANA_RPC_URL || "https://solana-rpc.publicnode.com";
const USED_FILE = path.join(__dirname, "..", "..", "data", "used_payments.json");

const SKR_MINT = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";
const SKR_DECIMALS = 6;
const TREASURY = "4v3d1itZVjLtDQEqGLFLtfr1riffAEcqnNtumEumJgny";
const TOKEN_PROGRAMS = new Set([
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
  "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb",
]);
const MAX_TX_AGE_SECONDS = 30 * 60;

const SGT_MINT_AUTHORITY = "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4";
const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");
const SEEKER_CACHE_MS = 60 * 60 * 1000;

const connection = new Connection(RPC_URL, "confirmed");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function loadUsed() {
  try {
    return JSON.parse(fs.readFileSync(USED_FILE, "utf8"));
  } catch {
    return {};
  }
}

function markUsed(signature, record) {
  const used = loadUsed();
  used[signature] = record;
  fs.writeFileSync(USED_FILE, JSON.stringify(used, null, 2));
}

/** The app calls right after sending: give the transaction time to confirm. */
async function fetchTransaction(signature) {
  for (let attempt = 0; attempt < 8; attempt++) {
    try {
      const tx = await connection.getParsedTransaction(signature, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      if (tx) return tx;
    } catch {}
    await sleep(4000);
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
async function verifyPayment({ wallet, signature, amountSkr, actionLabel }) {
  if (!wallet || !signature || !amountSkr || !actionLabel) {
    return { ok: false, error: "Payment signature is required." };
  }
  if (loadUsed()[signature]) {
    return { ok: false, error: "This payment was already used." };
  }

  const tx = await fetchTransaction(signature);
  if (!tx) return { ok: false, error: "Payment transaction not found on-chain yet. Try again in a minute." };
  if (tx.meta?.err) return { ok: false, error: "Payment transaction failed on-chain." };
  if (!tx.blockTime || Date.now() / 1000 - tx.blockTime > MAX_TX_AGE_SECONDS) {
    return { ok: false, error: "Payment transaction is too old." };
  }

  const signers = tx.transaction.message.accountKeys.filter((k) => k.signer).map((k) => k.pubkey.toBase58());
  if (!signers.includes(wallet)) {
    return { ok: false, error: "Payment was not signed by this wallet." };
  }

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

  markUsed(signature, { wallet, actionLabel, amountSkr, blockTime: tx.blockTime, verifiedAt: new Date().toISOString() });
  return { ok: true };
}

const seekerCache = new Map();

/** Seeker Genesis Token check: a Token-2022 token whose mint authority is the SGT authority. */
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
    // RPC failure: keep the previous answer if we have one, never grant on error
    if (cached) return cached.value;
    return false;
  }
  seekerCache.set(wallet, { value, at: Date.now() });
  return value;
}

module.exports = { verifyPayment, isSeekerHolderOnChain };
