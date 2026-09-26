/**
 * Wallet sessions: proves that a request really comes from the wallet it names.
 *
 * 1. POST /api/auth/nonce   { wallet }                       -> { message }
 * 2. the app asks the wallet to sign `message` (free, no transaction)
 * 3. POST /api/auth/verify  { wallet, message, signature }    -> { token, expiresAt }
 * 4. requests that spend a wallet's quota send `Authorization: Bearer <token>`
 */
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { PublicKey } = require("@solana/web3.js");

const SESSIONS_FILE = path.join(__dirname, "..", "..", "data", "sessions.json");
const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
// DER prefix of an Ed25519 SubjectPublicKeyInfo; the raw 32-byte key follows
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

const nonces = new Map();

function loadSessions() {
  try {
    return JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf8"));
  } catch {
    return {};
  }
}

function saveSessions(sessions) {
  const now = Date.now();
  for (const [token, s] of Object.entries(sessions)) if (s.expiresAt < now) delete sessions[token];
  fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
}

function isWallet(wallet) {
  try {
    return typeof wallet === "string" && PublicKey.isOnCurve(new PublicKey(wallet).toBytes());
  } catch {
    return false;
  }
}

function createNonce(wallet) {
  if (!isWallet(wallet)) return null;
  const nonce = crypto.randomBytes(16).toString("hex");
  const message =
    `Arkana sign-in\n\n` +
    `Sign to prove this wallet is yours. This is not a transaction and costs nothing.\n\n` +
    `Wallet: ${wallet}\nNonce: ${nonce}\nIssued: ${new Date().toISOString()}`;
  nonces.set(nonce, { wallet, message, expiresAt: Date.now() + NONCE_TTL_MS });
  if (nonces.size > 10000) {
    const now = Date.now();
    for (const [k, v] of nonces) if (v.expiresAt < now) nonces.delete(k);
  }
  return message;
}

function verifyEd25519(wallet, message, signature) {
  const key = crypto.createPublicKey({
    key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(new PublicKey(wallet).toBytes())]),
    format: "der",
    type: "spki",
  });
  return crypto.verify(null, message, key, signature);
}

/**
 * `signature` is base64. Wallets return either the 64-byte signature or the signed payload
 * (message with the signature attached), so both shapes are accepted.
 */
function verifySignIn({ wallet, message, signature }) {
  const nonceMatch = typeof message === "string" && message.match(/Nonce: ([0-9a-f]{32})/);
  const pending = nonceMatch && nonces.get(nonceMatch[1]);
  if (!pending || pending.wallet !== wallet || pending.message !== message || pending.expiresAt < Date.now()) {
    return { ok: false, error: "Sign-in request expired. Please try again." };
  }

  const msg = Buffer.from(message, "utf8");
  const raw = Buffer.from(String(signature || ""), "base64");
  const candidates = [];
  if (raw.length === 64) candidates.push(raw);
  if (raw.length === msg.length + 64) candidates.push(raw.subarray(raw.length - 64), raw.subarray(0, 64));

  const valid = candidates.some((sig) => {
    try {
      return verifyEd25519(wallet, msg, sig);
    } catch {
      return false;
    }
  });
  if (!valid) return { ok: false, error: "Signature does not match this wallet." };

  nonces.delete(nonceMatch[1]);
  const token = crypto.randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const sessions = loadSessions();
  sessions[token] = { wallet, expiresAt };
  saveSessions(sessions);
  return { ok: true, token, expiresAt };
}

function sessionWallet(req) {
  const header = req.get("authorization") || "";
  if (!header.startsWith("Bearer ")) return null;
  const session = loadSessions()[header.slice(7)];
  return session && session.expiresAt > Date.now() ? session.wallet : null;
}

/**
 * True when the request carries a session of `wallet`.
 * ARKANA_REQUIRE_SESSION=off keeps 1.0.x apps (no sessions) working until they are retired.
 */
function hasWalletSession(req, wallet) {
  if (process.env.ARKANA_REQUIRE_SESSION === "off") return true;
  return Boolean(wallet) && sessionWallet(req) === wallet;
}

module.exports = { createNonce, verifySignIn, hasWalletSession };
