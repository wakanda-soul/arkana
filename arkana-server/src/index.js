const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const { SPREADS, getDeck, getReading } = require("./engine/oracleEngine");
const {
  generateReadingProse,
  generateOracleChatReply,
  evaluateSafetyFilter,
  refundNote,
  fallbackRefundNote
} = require("./ai/oracleService");
const {
  logDialogue,
  queryLogs,
  getLogStats,
  LOG_FILE
} = require("./logging/dialogueLogger");
const {
  getClockInStatus,
  isClockInSignatureUsed,
  refreshSeekerHolderStatus,
  recordClockIn,
  consumeSpread,
  repairStreak,
  recordOffering,
  recordSubscription,
  creditBonusSpreads,
  loadEconomyConfig,
  updateEconomyConfig
} = require("./solana/skrService");
const { startLookupTableKeeper, getLookupTableAddress } = require("./solana/lookupTable");
const { startSyncKeeper } = require("./solana/syncKeeper");
const { startSkrPriceRefresher } = require("./solana/skrPrice");
const { verifyPayment, isSeekerHolderOnChain, isValidTxSignature, paymentActionLabel } = require("./solana/paymentVerifier");
const { createNonce, createSiwsNonce, verifySignIn, hasWalletSession, endSession } = require("./auth/session");

const SESSION_REQUIRED = { success: false, sessionRequired: true, error: "Please sign in with your wallet again." };
const PAYMENT_BUSY = { success: false, busy: true, error: "The server is busy verifying payments. Please retry in a moment." };

/** 500 without internals: the details go to the server log only. */
function serverError(res, err, where) {
  console.error(`[${where}]`, err && err.message ? err.message : err);
  if (!res.headersSent) res.status(500).json({ success: false, error: "Internal server error. Please try again." });
}

/**
 * Checks the payment signature shape before any RPC call. `required` demands txSignature;
 * txSignatures (extra tranche transactions) is optional but must be an array of valid signatures.
 * Returns an error message or null.
 */
function paymentSignatureError(body, required) {
  const { txSignature, txSignatures } = body || {};
  if (txSignature === undefined || txSignature === null || txSignature === "") {
    return required ? "Payment signature is required." : null;
  }
  if (!isValidTxSignature(txSignature)) return "Invalid payment signature.";
  if (txSignatures !== undefined && txSignatures !== null) {
    if (!Array.isArray(txSignatures) || txSignatures.length > 4 || !txSignatures.every(isValidTxSignature)) {
      return "Invalid payment signature.";
    }
  }
  return null;
}

/**
 * Uses a free / streak spread when available. Otherwise charges only if the request carries a
 * payment signature that verifies on-chain for this wallet, action and price.
 */
async function consumeWithVerifiedPayment(wallet, { type, txSignature, txSignatures }) {
  const free = consumeSpread(wallet, { type });
  if (free.allowed || !txSignature) return free;

  const config = loadEconomyConfig();
  const amountSkr = type === "chat" ? (config.askCostSkr || 1) : (config.extraSpreadCostSkr || 5);
  const payment = await verifyPayment({
    wallet,
    signature: txSignature,
    extraSignatures: txSignatures,
    amountSkr,
    actionLabel: type === "chat" ? "ORACLE_ASK" : "EXTRA_SPREAD",
  });
  // The payment's own error is what the client sees: "not found on-chain yet" tells the app to keep
  // the payment and retry, a quota message would make it drop a real payment
  if (!payment.ok) return { ...free, allowed: false, busy: Boolean(payment.busy), reason: payment.error, error: payment.error };
  return consumeSpread(wallet, { type, txSignature, paymentVerified: true });
}

const app = express();
const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || "127.0.0.1";

app.disable("x-powered-by");
// The mobile app (React Native fetch) sends no Origin; browsers may call only from arkana.icu itself
const CORS_ORIGINS = new Set(["https://arkana.icu"]);
app.use(cors({ origin: (origin, cb) => cb(null, !origin || CORS_ORIGINS.has(origin)) }));

// One line per API call (method, path, status, time, short wallet); chain proxy noise is skipped
const QUIET_API = new Set(["/api/solana-rpc", "/api/lookup-table", "/api/health", "/api/version", "/api/treasury"]);
app.use("/api", (req, res, next) => {
  const started = Date.now();
  res.on("finish", () => {
    if (QUIET_API.has(req.originalUrl.split("?")[0]) && res.statusCode < 400) return;
    const wallet = (req.body && req.body.wallet) || (req.query && req.query.wallet) || "";
    const who = typeof wallet === "string" && wallet ? ` ${wallet.slice(0, 4)}…${wallet.slice(-4)}` : "";
    console.log(`[api] ${req.method} ${req.originalUrl.split("?")[0]} ${res.statusCode} ${Date.now() - started}ms${who}`);
  });
  next();
});

app.use(express.json({ limit: "16kb" }));

// Never let one bad request take the whole server down
process.on("unhandledRejection", (err) => console.error("[unhandledRejection]", err));

const { PublicKey } = require("@solana/web3.js");
function isValidWallet(wallet) {
  try {
    return typeof wallet === "string" && wallet.length <= 44 && PublicKey.isOnCurve(new PublicKey(wallet).toBytes());
  } catch {
    return false;
  }
}

// Any wallet the client names must be a real Solana address (also blocks "__proto__" style keys)
app.use("/api", (req, res, next) => {
  const wallet = (req.body && req.body.wallet) ?? (req.query && req.query.wallet);
  if (wallet !== undefined && wallet !== null && wallet !== "" && wallet !== "anonymous" && !isValidWallet(wallet)) {
    return res.status(400).json({ success: false, error: "Invalid wallet address" });
  }
  next();
});

/**
 * Real client IP. Caddy sets X-Real-IP (Cloudflare's CF-Connecting-IP for the domain, the TCP peer
 * for direct IP access); only trusted when the request comes from the local proxy.
 */
function clientIp(req) {
  const peer = req.socket.remoteAddress || "";
  const fromProxy = peer === "127.0.0.1" || peer === "::1" || peer === "::ffff:127.0.0.1";
  return (fromProxy && req.get("x-real-ip")) || req.ip || peer || "unknown";
}

// Simple per-IP rate limit for endpoints that call the AI model or hit the chain.
// Keyed by a fixed name per limiter (not req.path, which would give every /:wallet its own bucket).
const rateBuckets = new Map();
let lastPrune = 0;
function pruneRateBuckets(now) {
  if (now - lastPrune < 60 * 1000) return;
  lastPrune = now;
  for (const [key, b] of rateBuckets) if (now - b.start > b.windowMs) rateBuckets.delete(key);
}
// IPv6 clients get a whole /64 from their provider: count them per /64, not per address
function rateKeyIp(ip) {
  const v6 = String(ip).replace(/^::ffff:/, "");
  if (!v6.includes(":")) return v6;
  const [head] = v6.split("::");
  const groups = v6.includes("::") ? head.split(":") : v6.split(":");
  return `${groups.slice(0, 4).join(":")}::/64`;
}
function rateLimit(name, max, windowMs) {
  return (req, res, next) => {
    const key = `${name}|${rateKeyIp(clientIp(req))}`;
    const now = Date.now();
    pruneRateBuckets(now);
    const bucket = rateBuckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      rateBuckets.set(key, { start: now, count: 1, windowMs });
      return next();
    }
    if (++bucket.count > max) {
      return res.status(429).json({ success: false, error: "Too many requests. Please slow down." });
    }
    next();
  };
}
const MINUTE = 60 * 1000;
app.use("/api/chat", rateLimit("chat", 20, MINUTE));
app.use("/api/reading", rateLimit("reading", 20, MINUTE));
app.post("/api/clock-in", rateLimit("clock-in", 10, MINUTE));
app.get("/api/clock-in/:wallet", rateLimit("clock-in-status", 30, MINUTE));
app.use("/api/auth/nonce", rateLimit("auth-nonce", 20, MINUTE));
app.use("/api/auth/verify", rateLimit("auth-verify", 20, MINUTE));
app.use("/api/auth/logout", rateLimit("auth-logout", 20, MINUTE));
app.use("/api/seeker/status", rateLimit("seeker-status", 30, MINUTE));
app.use("/api/solana-rpc", rateLimit("solana-rpc", 60, MINUTE));
app.use("/api/offering", rateLimit("offering", 10, MINUTE));
app.use("/api/subscription/activate", rateLimit("subscription", 10, MINUTE));
app.use("/api/streak/repair", rateLimit("streak-repair", 10, MINUTE));
app.use("/api/payment/credit", rateLimit("payment-credit", 10, MINUTE));

// Serve static files (card images, logos, APKs)
// Only public assets are served. Card art, design files, admin pages and program binaries stay
// on the server (the app ships its own card images).
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use("/landing", express.static(path.join(PUBLIC_DIR, "landing")));
app.use("/images", express.static(path.join(PUBLIC_DIR, "images")));
// /arkana.apk always points at the current build: it redirects (never cached) to the versioned file,
// and a versioned file never changes, so browsers and Cloudflare may keep it forever.
const NO_STORE = "no-store, no-cache, must-revalidate, max-age=0";
app.get("/arkana.apk", (req, res) => {
  let version = null;
  try {
    version = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, "version.json"), "utf-8")).version;
  } catch {}
  res.set("Cache-Control", NO_STORE);
  if (version && fs.existsSync(path.join(PUBLIC_DIR, `arkana-v${version}.apk`))) {
    return res.redirect(302, `/arkana-v${version}.apk`);
  }
  res.sendFile(path.join(PUBLIC_DIR, "arkana.apk"), (err) => err && res.status(404).end());
});
app.get("/version.json", (req, res) => {
  res.set("Cache-Control", NO_STORE);
  res.sendFile(path.join(PUBLIC_DIR, "version.json"), (err) => err && res.status(404).end());
});
app.get(/^\/arkana-v\d+\.\d+\.\d+\.apk$/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, req.path.slice(1)), { maxAge: "365d", immutable: true }, (err) => err && res.status(404).end());
});


// Dynamic Build Metadata Reader
function getBuildInfo() {
  const vPath = path.join(__dirname, "..", "public", "version.json");
  if (fs.existsSync(vPath)) {
    try {
      return JSON.parse(fs.readFileSync(vPath, "utf8"));
    } catch {}
  }
  return {
    version: "1.0.61",
    buildNumber: 61,
    commitSha: "3836a65",
    updatedAt: "2026-09-17"
  };
}

// Mobile APK Download Landing Page
// Landing page (Obsidian Ritual design); the install page lives at /download
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "..", "public", "landing.html"));
});

app.get("/download", (req, res) => {
  const apkPath = path.join(__dirname, "..", "public", "arkana.apk");
  const apkSize = fs.existsSync(apkPath) ? (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(0) + " MB" : "";
  const build = getBuildInfo();
  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Download Arkana</title>
<meta name="theme-color" content="#08070B">
<link rel="icon" href="/images/logo-512.png">
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,300&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root { --void:#08070B; --surface:#120E1A; --gold:#C8A24A; --violet:#7C4DFF; --text:#EDE7DC; --body:rgba(237,231,220,.82); --secondary:rgba(237,231,220,.55); --label:rgba(237,231,220,.42); --hairline:rgba(237,231,220,.12); }
  * { box-sizing: border-box; }
  html { background:#08070B; }
  body { margin:0; min-height:100vh; background:radial-gradient(circle at 50% 18%, rgba(124,77,255,.22), transparent 55%), var(--void); color:var(--text); font-family:"Cormorant Garamond", Georgia, serif; font-weight:300; font-size:19px; line-height:1.55; display:flex; align-items:center; justify-content:center; padding:32px 24px calc(32px + env(safe-area-inset-bottom, 0px)); }
  main { width:100%; max-width:520px; text-align:center; }
  img { width:112px; height:112px; border-radius:50%; border:1px solid rgba(200,162,74,.4); box-shadow:0 0 30px rgba(124,77,255,.45); }
  .label { font-family:"IBM Plex Mono", monospace; font-size:11px; letter-spacing:.24em; text-transform:uppercase; color:var(--label); }
  h1 { font-weight:300; font-size:48px; line-height:1.1; margin:20px 0 8px; }
  h1 i { color:var(--gold); }
  p { color:var(--body); margin:0 0 28px; }
  .btn { display:flex; align-items:center; justify-content:center; min-height:52px; border-radius:12px; font-family:"IBM Plex Mono", monospace; font-size:12px; letter-spacing:.16em; text-transform:uppercase; text-decoration:none; background:var(--gold); color:var(--void); font-weight:500; }
  .meta { font-family:"IBM Plex Mono", monospace; font-size:13px; color:var(--secondary); margin:14px 0 36px; }
  ol { text-align:left; margin:0 0 32px; padding:24px 24px 24px 44px; border:1px solid rgba(237,231,220,.10); border-radius:14px; background:rgba(237,231,220,.04); color:var(--body); font-size:18px; }
  li + li { margin-top:8px; }
  a.link { color:var(--secondary); font-family:"IBM Plex Mono", monospace; font-size:11px; letter-spacing:.16em; text-transform:uppercase; text-decoration:none; }
</style>
</head>
<body>
<main>
  <img src="/images/logo-512.png" alt="Arkana">
  <h1>Arkana <i>for Android</i></h1>
  <p>The crypto tarot for Seeker. Best on Seeker, works on Android 10 and newer.</p>
  <a class="btn" href="/arkana.apk">Download APK</a>
  <div class="meta">v${build.version}${apkSize ? " · " + apkSize : ""}</div>
  <ol>
    <li>Open the downloaded file.</li>
    <li>If Android asks, allow installs from this source.</li>
    <li>Open Arkana, pick your language and connect your wallet.</li>
  </ol>
  <a class="link" href="/">Back to arkana.icu</a>
</main>
</body>
</html>`);
});

// Wallet sign-in: the wallet signs a one-time message, the server issues a session token
app.post("/api/auth/nonce", (req, res) => {
  if (!req.body || !req.body.wallet) return res.json({ success: true, siws: createSiwsNonce() });
  const message = createNonce(req.body.wallet);
  if (!message) return res.status(400).json({ success: false, error: "Invalid wallet address" });
  res.json({ success: true, message });
});

app.post("/api/auth/verify", (req, res) => {
  const { wallet, message, signature } = req.body || {};
  const result = verifySignIn({ wallet, message, signature });
  if (!result.ok) return res.status(401).json({ success: false, error: result.error });
  res.json({ success: true, token: result.token, expiresAt: result.expiresAt });
});

// Ends the session sent as Authorization: Bearer <token>
app.post("/api/auth/logout", (req, res) => {
  try {
    const ended = endSession(req);
    res.json({ success: true, loggedOut: ended });
  } catch (err) {
    serverError(res, err, "auth/logout");
  }
});

// Health check
app.get("/api/health", (req, res) => {
  const build = getBuildInfo();
  res.json({
    status: "ok",
    app: "Arkana - The Solana Oracle API",
    version: build.version,
    buildNumber: build.buildNumber,
    commitSha: build.commitSha,
    hackathon: "Clock In: A Solana Mobile Hackathon",
    network: "Solana Mobile / Seeker"
  });
});

// App version & build info
app.get("/api/version", (req, res) => {
  res.json(getBuildInfo());
});

// Read-only RPC proxy for the vault admin pages. The upstream URL (with its API key) stays on the server.
const RPC_PROXY_METHODS = new Set([
  "getAccountInfo",
  "getBalance",
  "getLatestBlockhash",
  "getSignatureStatuses",
  "getSignaturesForAddress",
  "getBlockHeight",
  "getSlot",
]);
app.post("/api/solana-rpc", async (req, res) => {
  const body = req.body;
  if (!body || Array.isArray(body) || !RPC_PROXY_METHODS.has(body.method)) {
    return res.status(403).json({ jsonrpc: "2.0", error: { code: -32601, message: "Method not allowed" }, id: body?.id ?? null });
  }
  if (body.params !== undefined && !Array.isArray(body.params)) {
    return res.status(400).json({ jsonrpc: "2.0", error: { code: -32602, message: "Invalid params" }, id: body.id ?? null });
  }
  let params = body.params;
  if (body.method === "getSignaturesForAddress") {
    // The upstream default is 1000 signatures per call; the admin pages never need more than 20
    const opts = params && params[1] && typeof params[1] === "object" && !Array.isArray(params[1]) ? params[1] : {};
    const limit = Math.min(Math.max(1, Number(opts.limit) || 20), 20);
    params = [params ? params[0] : undefined, { ...opts, limit }];
  }
  try {
    const upstreamRes = await fetch(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 1, method: body.method, params }),
      signal: AbortSignal.timeout(10000),
    });
    res.json(await upstreamRes.json());
  } catch {
    res.status(502).json({ jsonrpc: "2.0", error: { code: -32603, message: "RPC unavailable" }, id: body.id ?? null });
  }
});

// List all 78 cards
app.get("/api/deck", (req, res) => {
  try {
    const deck = getDeck();
    res.json({ count: deck.length, deck });
  } catch (err) {
    serverError(res, err, "deck");
  }
});

// List available spreads
app.get("/api/spreads", (req, res) => {
  res.json(SPREADS);
});

const clockInsInFlight = new Set();
const { findTodayClockIn, verifyClockInTx } = require("./solana/clockInRecovery");

// Get Clock-In status for a wallet
app.get("/api/clock-in/:wallet", async (req, res) => {
  try {
    const walletParam = req.params.wallet;
    const wallet = (walletParam === "status" && req.query.wallet) ? req.query.wallet : walletParam;
    if (!isValidWallet(wallet)) return res.status(400).json({ error: "Invalid wallet address" });
    let status = getClockInStatus(wallet);
    if (status.canClockIn && !clockInsInFlight.has(wallet)) {
      // The wallet may have signed today's memo without the app ever posting it
      try {
        const found = await findTodayClockIn(wallet);
        const card = found && getDeck().find((c) => c.card_no === found.cardNo);
        if (card && getClockInStatus(wallet).canClockIn && !clockInsInFlight.has(wallet) && !isClockInSignatureUsed(wallet, found.signature)) {
          recordClockIn(wallet, { ...card, orientation: found.orientation }, found.signature, found.slot);
          console.log(`[clock-in] recovered from chain ${wallet.slice(0, 4)}…${wallet.slice(-4)} card ${found.cardNo}`);
          status = getClockInStatus(wallet);
        }
      } catch (err) {
        console.warn("[clock-in] chain recovery failed:", err.message);
      }
    }
    if (hasWalletSession(req, wallet)) return res.json(status);
    // Without the owner's session, hide payment signatures, offerings and history. Today's card stays:
    // the app reads it without a session, and it is public on chain in the Clock-In memo anyway.
    const { subscription, totalOfferedSkr, lastOffering, txSignature, history, ...publicStatus } = status;
    res.json({ ...publicStatus, isSubscribed: Boolean(subscription && subscription.active) });
  } catch (err) {
    serverError(res, err, "clock-in status");
  }
});

// Consume one free / streak spread (paid spreads go through /api/reading with a verified payment)
// Update or verify Seeker Genesis SBT status
app.post("/api/seeker/status", async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: "Wallet address is required" });
    // Verified on-chain; the client's own claim is not trusted
    const status = await refreshSeekerHolderStatus(wallet, isSeekerHolderOnChain);
    res.json({ success: true, wallet, isSeekerHolder: status });
  } catch (err) {
    serverError(res, err, "seeker/status");
  }
});

// Perform Daily Clock In (1 card draw). Counts only with an on-chain proof: today's Daily Consensus
// memo signed by the wallet. The card comes from that memo, never from the request alone.
app.post("/api/clock-in", async (req, res) => {
  try {
    const { wallet, language = "en", cardNo, orientation, txSignature } = req.body;
    if (!wallet) {
      return res.status(401).json({ success: false, error: "Connect your wallet first." });
    }
    if (!hasWalletSession(req, wallet)) return res.status(401).json(SESSION_REQUIRED);
    if (!isValidTxSignature(txSignature)) {
      return res.status(400).json({ success: false, error: "A signed Clock-In transaction is required." });
    }
    if (clockInsInFlight.has(wallet) || !getClockInStatus(wallet).canClockIn) {
      return res.status(409).json({ success: false, alreadyClockedIn: true, error: "Already clocked in today." });
    }
    if (isClockInSignatureUsed(wallet, txSignature)) {
      return res.status(409).json({ success: false, error: "This Clock-In transaction was already used." });
    }
    clockInsInFlight.add(wallet);
    res.on("close", () => clockInsInFlight.delete(wallet));

    const proof = await verifyClockInTx(txSignature, wallet);
    if (proof.error) return res.status(400).json({ success: false, error: proof.error });
    // The request must describe the card the wallet actually signed
    const bodyCard = cardNo !== undefined && cardNo !== null && cardNo !== "" ? String(cardNo).padStart(2, "0") : null;
    const bodyOrientation = orientation ? String(orientation).toLowerCase() : null;
    if ((bodyCard && bodyCard !== proof.cardNo) || (bodyOrientation && bodyOrientation !== proof.orientation)) {
      return res.status(400).json({ success: false, error: "Card does not match the signed Clock-In memo." });
    }
    const match = getDeck().find((c) => c.card_no === proof.cardNo);
    if (!match) return res.status(400).json({ success: false, error: "Unknown card in the Clock-In memo." });

    const normOrientation = proof.orientation;
    const reading = {
      spread_name: "Daily Consensus Clock-In",
      spread_key: "daily-block",
      category: "crypto",
      cards: [{
        position: "Consensus Block",
        position_hint: "Primary archetype governing today's currents",
        card_no: match.card_no,
        crypto_name: match.crypto_name,
        classic: match.classic,
        suit: match.suit,
        arcana: match.arcana,
        orientation: normOrientation,
        image: match.image,
        keywords: match.keywords || [],
        energy: match.energy || null,
        oriented_meaning: normOrientation === "reversed" ? match.reversed_full : match.upright_full,
        symbolism: match.symbolism,
        advice: match.advice,
        shadow: match.shadow
      }],
      majors_count: match.arcana === "major" ? 1 : 0,
      structural: true,
      arcana_note: match.arcana === "major" ? "Genesis card" : "Suit card",
      dominant_suit: match.suit,
      dominant_energy: null
    };

    const slot = proof.slot || null;
    // Record before generating prose, so a slow model never delays or loses the Clock-In
    const clockInResult = recordClockIn(wallet, reading.cards[0], txSignature, slot);
    if (!clockInResult.success) return res.status(409).json(clockInResult);

    const prose = await generateReadingProse(reading, "Daily Consensus Clock-In", language);

    logDialogue({
      type: "clock-in",
      wallet,
      user_message: "Daily Consensus Clock-In",
      oracle_reply: reading.cards[0].crypto_name,
      status: "success",
      latency_ms: 0,
      client_ip: clientIp(req)
    });

    res.json({
      success: true,
      txSignature,
      slot,
      clockIn: clockInResult,
      reading,
      prose: prose.beats
    });
  } catch (err) {
    serverError(res, err, "clock-in");
  }
});

// Run a full oracle reading (network-scan, validator-cross, crypto-compass)
app.post("/api/reading", async (req, res) => {
  try {
    const {
      spread = "network-scan",
      category = "crypto",
      question = "",
      wallet = null,
      language = "en",
      cards = null,
      seed = null
    } = req.body;

    // Check & consume quota if wallet provided
    let quotaResult = null;
    // Every reading needs a connected wallet: free spreads come only from Seeker / streak / pass quotas
    if (!wallet) {
      return res.status(401).json({ success: false, error: "Connect your wallet first." });
    }
    if (!hasWalletSession(req, wallet)) return res.status(401).json(SESSION_REQUIRED);
    const signatureError = paymentSignatureError(req.body, false);
    if (signatureError) return res.status(400).json({ success: false, error: signatureError });
    if (typeof question !== "string") return res.status(400).json({ success: false, error: "Invalid question." });
    if (typeof spread !== "string" || !Object.hasOwn(SPREADS, spread)) return res.status(400).json({ success: false, error: "Unknown spread." });

    // Same pre-generation safety check as chat, before any quota or payment is spent
    const questionSafety = question ? evaluateSafetyFilter(question, language) : { blocked: false };
    if (questionSafety.blocked) {
      logDialogue({
        type: "reading",
        wallet,
        user_message: question,
        oracle_reply: questionSafety.reply,
        is_injection_attempt: questionSafety.reason === "injection",
        is_code_attempt: questionSafety.reason === "coding",
        blocked_by_safety: true,
        safety_reason: questionSafety.reason,
        status: "blocked",
        latency_ms: 0,
        client_ip: clientIp(req)
      });
      return res.status(400).json({ success: false, blocked: true, reason: questionSafety.reason, error: questionSafety.reply });
    }
    {
      quotaResult = await consumeWithVerifiedPayment(wallet, {
        type: "spread",
        txSignature: req.body.txSignature || null,
        txSignatures: req.body.txSignatures
      });
      if (quotaResult.busy) return res.status(503).json(PAYMENT_BUSY);
      if (!quotaResult.allowed) {
        return res.status(402).json({
          success: false,
          error: quotaResult.error,
          quota: quotaResult
        });
      }
    }

    // Cards are always drawn on the server with a secure RNG; client "cards" / "seed" are ignored
    const reading = getReading({
      spread: typeof spread === "string" ? spread : "network-scan",
      category: typeof category === "string" ? category : "crypto",
      allowReversed: true
    });

    const prose = await generateReadingProse(reading, question, language);

    logDialogue({
      type: "reading",
      wallet,
      user_message: question || `spread:${spread}`,
      oracle_reply: prose.beats ? prose.beats.story : "",
      is_injection_attempt: false,
      is_code_attempt: false,
      blocked_by_safety: false,
      safety_reason: null,
      status: "success",
      latency_ms: 0,
      client_ip: clientIp(req)
    });

    res.json({
      success: true,
      question,
      spread_name: reading.spread_name,
      spread_key: reading.spread_key,
      category: reading.category,
      quota: quotaResult,
      engine_metrics: {
        majors_count: reading.majors_count,
        structural: reading.structural,
        arcana_note: reading.arcana_note,
        dominant_suit: reading.dominant_suit,
        dominant_energy: reading.dominant_energy
      },
      cards: reading.cards,
      combinations: reading.combinations,
      prose: prose.beats
    });
  } catch (err) {
    serverError(res, err, "reading");
  }
});

// Interactive Oracle chat follow-up (Oracle AI via agy)
app.post("/api/chat", async (req, res) => {
  const startTime = Date.now();
  const ip = clientIp(req);
  const { wallet = "anonymous", txSignature = null } = req.body;
  const message = typeof req.body.message === "string" ? req.body.message.slice(0, 1000) : "";
  const language = typeof req.body.language === "string" ? req.body.language.slice(0, 8) : "en";
  const history = Array.isArray(req.body.history)
    ? req.body.history
        .slice(-10)
        .filter((h) => h && typeof h.text === "string")
        .map((h) => ({ sender: h.sender === "user" ? "user" : "oracle", text: h.text.slice(0, 1000) }))
    : [];

  if (!message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  // Shared daily quota; beyond it each question needs a verified SKR payment
  let quotaResult = null;
  // Every question needs a connected wallet
  if (!wallet || wallet === "anonymous") {
    return res.status(401).json({ success: false, error: "Connect your wallet first." });
  }
  try {
    if (!hasWalletSession(req, wallet)) return res.status(401).json(SESSION_REQUIRED);
    const signatureError = paymentSignatureError(req.body, false);
    if (signatureError) return res.status(400).json({ success: false, error: signatureError });

    // Safety check of the question AND every history turn before any quota or payment is spent:
    // history text is client-controlled and reaches the model prompt too
    const blockedBy = [message, ...history.map((h) => h.text)]
      .map((text) => evaluateSafetyFilter(text, language))
      .find((check) => check.blocked);
    if (blockedBy) {
      logDialogue({
        type: "chat",
        wallet,
        user_message: message.trim(),
        oracle_reply: blockedBy.reply,
        is_injection_attempt: blockedBy.reason === "injection",
        is_code_attempt: blockedBy.reason === "coding",
        blocked_by_safety: true,
        safety_reason: blockedBy.reason,
        status: "blocked",
        latency_ms: 0,
        client_ip: ip
      });
      return res.json({ reply: blockedBy.reply, card: null, blocked: true, reason: blockedBy.reason, quota: null, timestamp: new Date().toISOString() });
    }

    quotaResult = await consumeWithVerifiedPayment(wallet, { type: "chat", txSignature, txSignatures: req.body.txSignatures });
    if (quotaResult.busy) return res.status(503).json(PAYMENT_BUSY);

    if (!quotaResult.allowed) {
      return res.status(402).json({
        success: false,
        error: quotaResult.error,
        quota: quotaResult
      });
    }
  } catch (err) {
    return serverError(res, err, "chat quota");
  }

  try {
    // Call live Oracle AI agent proxy
    const chatResult = await generateOracleChatReply(message.trim(), history, language);
    const reply = typeof chatResult === "string" ? chatResult : chatResult.reply;
    const safety = (chatResult && chatResult.safety) || {};
    // Only a PAID question that Arkana refused comes back, as one banked free question. Both must
    // hold: the payment was verified on chain for this request (and is now marked used, so one
    // payment can be given back at most once) AND the model or the output check refused.
    const paidQuestion = Boolean(quotaResult && quotaResult.allowed && quotaResult.isFree === false && quotaResult.txSignature);
    // Also given back: a PAID question the model did not answer, read by the built-in engine instead
    const refusal = Boolean(safety.refused || safety.blocked);
    const engineAnswer = safety.reason === "fallback";
    let refunded = false;
    if (paidQuestion && (refusal || engineAnswer)) {
      quotaResult = { ...quotaResult, streakBonusSpreads: creditBonusSpreads(wallet, 1) };
      refunded = true;
    }
    const note = !refunded ? "" : refusal ? refundNote(message, language) : fallbackRefundNote(message, language);
    const finalReply = refunded ? `${reply}\n\n${note}` : reply;

    // Audit log dialogue interaction
    logDialogue({
      type: "chat",
      wallet,
      user_message: message.trim(),
      oracle_reply: finalReply,
      is_injection_attempt: Boolean(safety.is_injection_attempt),
      is_code_attempt: Boolean(safety.is_code_attempt),
      blocked_by_safety: Boolean(safety.blocked || safety.refused),
      safety_reason: safety.reason || null,
      status: refunded ? "refunded" : "success",
      latency_ms: Date.now() - startTime,
      client_ip: ip
    });

    res.json({
      reply: finalReply,
      // A refusal is not a reading: no card, whether the question was paid or free
      card: safety.refused || safety.blocked ? null : chatResult.card || null,
      refunded,
      quota: quotaResult,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    logDialogue({
      type: "chat",
      wallet,
      user_message: message.trim(),
      oracle_reply: "",
      is_injection_attempt: false,
      is_code_attempt: false,
      blocked_by_safety: false,
      safety_reason: null,
      status: "error",
      error: err.message,
      latency_ms: Date.now() - startTime,
      client_ip: ip
    });
    serverError(res, err, "chat");
  }
});

// Arkana Address Lookup Table used by the app to fit payments into one transaction
app.get("/api/lookup-table", (req, res) => {
  res.json({ success: true, address: getLookupTableAddress() });
});

app.get("/api/treasury", (req, res) => {
  const config = loadEconomyConfig();
  res.json({
    success: true,
    treasury: config.treasury || null
  });
});

// Record Altar Offering (33% burn + 33% treasury + 34% ORE tranche), verified on-chain
app.post("/api/offering", async (req, res) => {
  try {
    const { wallet, txSignature, amountSkr, message } = req.body;
    if (!wallet) {
      return res.status(400).json({ error: "Wallet address is required" });
    }
    if (!hasWalletSession(req, wallet)) return res.status(401).json(SESSION_REQUIRED);
    const signatureError = paymentSignatureError(req.body, true);
    if (signatureError) return res.status(400).json({ success: false, error: signatureError });
    const amount = Number(amountSkr);
    if (![1, 5, 15, 50].includes(amount)) {
      return res.status(400).json({ success: false, error: "Unknown offering amount" });
    }
    const payment = await verifyPayment({ wallet, signature: txSignature, extraSignatures: req.body.txSignatures, amountSkr: amount, actionLabel: "ALTAR_OFFERING" });
    if (payment.busy) return res.status(503).json(PAYMENT_BUSY);
    if (!payment.ok) {
      // busy: temporary (verification slots, quote unavailable); the app keeps the payment and retries
      return res.status(payment.busy ? 503 : 402).json({ success: false, busy: Boolean(payment.busy), error: payment.error });
    }
    const result = recordOffering(wallet, { txSignature, amountSkr: amount, message: typeof message === "string" ? message : undefined });
    res.json(result);
  } catch (err) {
    serverError(res, err, "offering");
  }
});

// Activate Seeker Oracle Pass (Subscription 333 SKR / 30 Days)
app.post("/api/subscription/activate", async (req, res) => {
  try {
    const { wallet, txSignature } = req.body;
    if (!wallet) {
      return res.status(400).json({ error: "Wallet address is required" });
    }
    if (!hasWalletSession(req, wallet)) return res.status(401).json(SESSION_REQUIRED);
    const signatureError = paymentSignatureError(req.body, true);
    if (signatureError) return res.status(400).json({ success: false, error: signatureError });
    const payment = await verifyPayment({
      wallet,
      signature: txSignature,
      extraSignatures: req.body.txSignatures,
      amountSkr: 333,
      actionLabel: "SUBSCRIPTION_PASS",
    });
    if (payment.busy) return res.status(503).json(PAYMENT_BUSY);
    if (!payment.ok) {
      // busy: temporary (verification slots, quote unavailable); the app keeps the payment and retries
      return res.status(payment.busy ? 503 : 402).json({ success: false, busy: Boolean(payment.busy), error: payment.error });
    }
    // Duration is fixed by the server: one paid pass = 30 days
    const result = recordSubscription(wallet, { txSignature, durationDays: 30 });
    res.json(result);
  } catch (err) {
    serverError(res, err, "subscription/activate");
  }
});

// Admin Economy Config Endpoints
// Admin endpoints (economy config, dialogue logs) require ARKANA_ADMIN_TOKEN.
// Without the token configured they are disabled entirely.
// A short or placeholder token disables the admin API instead of protecting it weakly.
const ADMIN_TOKEN = (() => {
  const token = process.env.ARKANA_ADMIN_TOKEN || "";
  if (!token) return null;
  if (token.length < 32 || token.startsWith("change-me")) {
    console.warn("[admin] ARKANA_ADMIN_TOKEN is shorter than 32 characters or a placeholder: admin API disabled");
    return null;
  }
  return token;
})();
const sha256 = (value) => require("crypto").createHash("sha256").update(String(value)).digest();
function requireAdmin(req, res, next) {
  const header = req.get("authorization") || "";
  const provided = req.get("x-admin-token") || (header.startsWith("Bearer ") ? header.slice(7) : "");
  // Equal-length digests: the comparison reveals neither the token nor its length
  const ok = Boolean(ADMIN_TOKEN && provided) && require("crypto").timingSafeEqual(sha256(provided), sha256(ADMIN_TOKEN));
  if (!ok) return res.status(404).json({ success: false, error: "Not found" });
  next();
}
app.use("/api/admin", requireAdmin);

app.get("/api/admin/config", (req, res) => {
  const config = loadEconomyConfig();
  res.json({ success: true, config });
});

app.post("/api/admin/config", (req, res) => {
  try {
    const updated = updateEconomyConfig(req.body);
    res.json({ success: true, config: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// ORE usage for the ORE prize progress reports: vault tranches, staked ORE, claimed yield, payments
const { getOreStats } = require("./solana/oreStats");
app.get("/api/admin/ore-stats", async (req, res) => {
  try {
    res.json({ success: true, ...(await getOreStats()) });
  } catch (err) {
    res.status(502).json({ success: false, error: err.message });
  }
});

app.get("/api/admin/logs", (req, res) => {
  try {
    const result = queryLogs(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    serverError(res, err, "admin");
  }
});

app.get("/api/admin/logs/stats", (req, res) => {
  try {
    const stats = getLogStats();
    res.json({ success: true, stats });
  } catch (err) {
    serverError(res, err, "admin");
  }
});

app.get("/api/admin/logs/export", (req, res) => {
  if (!fs.existsSync(LOG_FILE)) {
    return res.status(404).json({ error: "No log file found" });
  }
  res.download(LOG_FILE, "arkana-dialogues.jsonl");
});

// Streak repair endpoint
app.post("/api/streak/repair", async (req, res) => {
  try {
    const { wallet, txSignature } = req.body;
    if (!wallet) return res.status(400).json({ success: false, error: "Wallet address is required." });
    if (!hasWalletSession(req, wallet)) return res.status(401).json(SESSION_REQUIRED);
    const signatureError = paymentSignatureError(req.body, true);
    if (signatureError) return res.status(400).json({ success: false, error: signatureError });
    // Check before charging, so nobody pays for a streak that cannot be repaired
    if (!getClockInStatus(wallet).canRepairStreak) {
      return res.status(400).json({ success: false, error: "There is no broken streak to repair." });
    }
    const config = loadEconomyConfig();
    const payment = await verifyPayment({
      wallet,
      signature: txSignature,
      extraSignatures: req.body.txSignatures,
      amountSkr: config.streakRepairCostSkr !== undefined ? config.streakRepairCostSkr : 1,
      actionLabel: "STREAK_REPAIR",
    });
    if (payment.busy) return res.status(503).json(PAYMENT_BUSY);
    if (!payment.ok) {
      // busy: temporary (verification slots, quote unavailable); the app keeps the payment and retries
      return res.status(payment.busy ? 503 : 402).json({ success: false, busy: Boolean(payment.busy), error: payment.error });
    }
    const result = repairStreak(wallet, txSignature);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    serverError(res, err, "streak/repair");
  }
});

/**
 * A payment the app signed but whose request never reached the server (the app was killed or lost
 * the network in between). The app sends the signature again on its next start; the server reads
 * the action from the on-chain memo, verifies the payment like any other and credits it:
 * questions and spreads as banked bonus uses, passes, repairs and offerings as themselves.
 */
app.post("/api/payment/credit", async (req, res) => {
  try {
    const { wallet, txSignature } = req.body || {};
    if (!wallet || !txSignature) return res.status(400).json({ success: false, error: "Wallet and payment signature are required." });
    if (!hasWalletSession(req, wallet)) return res.status(401).json(SESSION_REQUIRED);
    const signatureError = paymentSignatureError(req.body, true);
    if (signatureError) return res.status(400).json({ success: false, error: signatureError });

    const found = await paymentActionLabel(txSignature);
    if (found.pending) return res.status(402).json({ success: false, error: "Payment transaction not found on-chain yet. Try again in a minute." });
    if (found.error) return res.status(400).json({ success: false, error: found.error });

    const config = loadEconomyConfig();
    const amounts = {
      ORACLE_ASK: [config.askCostSkr || 1],
      EXTRA_SPREAD: [config.extraSpreadCostSkr || 5],
      STREAK_REPAIR: [config.streakRepairCostSkr !== undefined ? config.streakRepairCostSkr : 1],
      SUBSCRIPTION_PASS: [333],
      // Largest first: a payment is credited at the highest amount it actually covers
      ALTAR_OFFERING: [50, 15, 5, 1],
    }[found.label];
    if (!amounts) return res.status(400).json({ success: false, error: "Unknown payment action." });

    let payment = null;
    let amountSkr = 0;
    for (const amount of amounts) {
      payment = await verifyPayment({ wallet, signature: txSignature, amountSkr: amount, actionLabel: found.label });
      amountSkr = amount;
      if (payment.ok || payment.busy) break;
    }
    if (!payment.ok) {
      return res.status(payment.busy ? 503 : 402).json({ success: false, busy: Boolean(payment.busy), error: payment.error });
    }

    if (found.label === "SUBSCRIPTION_PASS") return res.json({ credited: "pass", ...recordSubscription(wallet, { txSignature, durationDays: 30 }) });
    if (found.label === "ALTAR_OFFERING") return res.json({ credited: "offering", ...recordOffering(wallet, { txSignature, amountSkr }) });
    if (found.label === "STREAK_REPAIR" && getClockInStatus(wallet).canRepairStreak) {
      const repaired = repairStreak(wallet, txSignature);
      if (repaired.success) return res.json({ credited: "streak_repair", ...repaired });
    }
    // Questions, spreads, and a repair whose streak can no longer be repaired: a banked bonus use
    res.json({ success: true, credited: "bonus", streakBonusSpreads: creditBonusSpreads(wallet, 1) });
  } catch (err) {
    serverError(res, err, "payment/credit");
  }
});

// Last resort for errors Express catches itself (malformed JSON bodies, sync throws): no internals out
app.use((err, req, res, next) => {
  if (err && err.type === "entity.parse.failed") {
    return res.status(400).json({ success: false, error: "Invalid JSON body." });
  }
  if (err && err.status === 413) return res.status(413).json({ success: false, error: "Request too large." });
  serverError(res, err, `${req.method} ${req.path}`);
});

// Only Caddy on the same machine talks to the API; set HOST=0.0.0.0 for a setup without a proxy
if (process.env.ARKANA_REQUIRE_SESSION === "off") {
  console.warn("[session] ARKANA_REQUIRE_SESSION=off: any request can spend any wallet's quota. Never use this in production.");
}

const server = app.listen(PORT, HOST, () => {
  console.log(`🔮 Arkana Oracle Server is running on http://${HOST}:${PORT}`);
  startLookupTableKeeper();
  startSyncKeeper();
  startSkrPriceRefresher();
});

// Port 80 directly, only on request (ARKANA_BIND_80=on) for setups without a reverse proxy.
// In production Caddy owns 80/443 and proxies to PORT, so nothing is ever served over plain HTTP.
if (process.env.ARKANA_BIND_80 === "on") try {
  const http = require("http");
  http
    .createServer(app)
    .on("error", (err) => console.warn("Could not bind port 80:", err.message))
    .listen(80, "0.0.0.0", () => {
      console.log(`🔮 Arkana HTTP download listener running on http://0.0.0.0:80`);
    });
} catch (err) {
  console.warn("Could not bind port 80:", err.message);
}
