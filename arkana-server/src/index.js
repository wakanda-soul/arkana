const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const { SPREADS, getDeck, getReading } = require("./engine/oracleEngine");
const {
  generateReadingProse,
  generateOracleChatReply,
  evaluateSafetyFilter
} = require("./ai/oracleService");
const {
  logDialogue,
  queryLogs,
  getLogStats,
  LOG_FILE
} = require("./logging/dialogueLogger");
const {
  getClockInStatus,
  setSeekerHolderStatus,
  recordClockIn,
  consumeSpread,
  repairStreak,
  recordOffering,
  recordSubscription,
  loadEconomyConfig,
  updateEconomyConfig
} = require("./solana/skrService");
const { startLookupTableKeeper, getLookupTableAddress } = require("./solana/lookupTable");
const { verifyPayment, isSeekerHolderOnChain } = require("./solana/paymentVerifier");
const { createNonce, verifySignIn, hasWalletSession } = require("./auth/session");

const SESSION_REQUIRED = { success: false, sessionRequired: true, error: "Please sign in with your wallet again." };

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
  if (!payment.ok) return { ...free, allowed: false, reason: payment.error };
  return consumeSpread(wallet, { type, txSignature, paymentVerified: true });
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
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

// Simple per-IP rate limit for endpoints that call the AI model or hit the chain
const rateBuckets = new Map();
function rateLimit(max, windowMs) {
  return (req, res, next) => {
    const key = `${req.path}|${clientIp(req)}`;
    const now = Date.now();
    const bucket = rateBuckets.get(key);
    if (!bucket || now - bucket.start > windowMs) {
      rateBuckets.set(key, { start: now, count: 1 });
      if (rateBuckets.size > 100000) rateBuckets.clear();
      return next();
    }
    if (++bucket.count > max) {
      return res.status(429).json({ success: false, error: "Too many requests. Please slow down." });
    }
    next();
  };
}
app.use(["/api/chat", "/api/reading", "/api/clock-in"], rateLimit(20, 60 * 1000));
app.use(["/api/auth", "/api/seeker/status", "/api/solana-rpc"], rateLimit(30, 60 * 1000));

// Serve static files (card images, logos, APKs)
// Only public assets are served. Card art, design files, admin pages and program binaries stay
// on the server (the app ships its own card images).
const PUBLIC_DIR = path.join(__dirname, "..", "public");
app.use("/landing", express.static(path.join(PUBLIC_DIR, "landing")));
app.use("/images", express.static(path.join(PUBLIC_DIR, "images")));
app.get(/^\/(arkana(-v\d+\.\d+\.\d+)?\.apk|version\.json)$/, (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, req.path.slice(1)), (err) => err && res.status(404).end());
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


// Health check
// Wallet sign-in: the wallet signs a one-time message, the server issues a session token
app.post("/api/auth/nonce", (req, res) => {
  const message = createNonce(req.body && req.body.wallet);
  if (!message) return res.status(400).json({ success: false, error: "Invalid wallet address" });
  res.json({ success: true, message });
});

app.post("/api/auth/verify", (req, res) => {
  const { wallet, message, signature } = req.body || {};
  const result = verifySignIn({ wallet, message, signature });
  if (!result.ok) return res.status(401).json({ success: false, error: result.error });
  res.json({ success: true, token: result.token, expiresAt: result.expiresAt });
});

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

// App Version & Build info API
app.get("/api/version", (req, res) => {
  res.json(getBuildInfo());
});

// Solana Mainnet RPC Proxy (Bypasses browser CORS / 403 restrictions)
// Read-only RPC proxy for the vault admin pages. The upstream URL (with its API key) stays on the server.
const RPC_PROXY_METHODS = new Set([
  "getAccountInfo",
  "getBalance",
  "getLatestBlockhash",
  "getSignatureStatuses",
  "getBlockHeight",
  "getSlot",
]);
app.post("/api/solana-rpc", async (req, res) => {
  const body = req.body;
  if (!body || Array.isArray(body) || !RPC_PROXY_METHODS.has(body.method)) {
    return res.status(403).json({ jsonrpc: "2.0", error: { code: -32601, message: "Method not allowed" }, id: body?.id ?? null });
  }
  try {
    const upstreamRes = await fetch(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: body.id ?? 1, method: body.method, params: body.params }),
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
    res.status(500).json({ error: err.message });
  }
});

// List available spreads
app.get("/api/spreads", (req, res) => {
  res.json(SPREADS);
});

// Get Clock-In status for a wallet
app.get("/api/clock-in/:wallet", (req, res) => {
  try {
    const walletParam = req.params.wallet;
    const wallet = (walletParam === "status" && req.query.wallet) ? req.query.wallet : walletParam;
    if (!isValidWallet(wallet)) return res.status(400).json({ error: "Invalid wallet address" });
    const status = getClockInStatus(wallet);
    if (hasWalletSession(req, wallet)) return res.json(status);
    // Without the owner's session, hide payment signatures, offerings and today's card
    const { todayCard, subscription, totalOfferedSkr, lastOffering, txSignature, history, ...publicStatus } = status;
    res.json({ ...publicStatus, isSubscribed: Boolean(subscription && subscription.active) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check and consume spread quota or deduct 5 SKR fee
app.post("/api/spread/consume", (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet) return res.status(401).json({ success: false, error: "Connect your wallet first." });
    if (!hasWalletSession(req, wallet)) return res.status(401).json(SESSION_REQUIRED);
    const result = consumeSpread(wallet, {});
    if (!result.allowed) {
      return res.status(402).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update or verify Seeker Genesis SBT status
app.post("/api/seeker/status", async (req, res) => {
  try {
    const { wallet } = req.body;
    if (!wallet) return res.status(400).json({ error: "Wallet address is required" });
    // Verified on-chain; the client's own claim is not trusted
    const status = setSeekerHolderStatus(wallet, await isSeekerHolderOnChain(wallet));
    res.json({ success: true, wallet, isSeekerHolder: status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Perform Daily Clock In (1 card draw)
const clockInsInFlight = new Set();
app.post("/api/clock-in", async (req, res) => {
  try {
    const { wallet, language = "en", cardNo, orientation = "upright", txSignature: clientTx, slot: clientSlot } = req.body;
    if (!wallet) {
      return res.status(401).json({ success: false, error: "Connect your wallet first." });
    }
    if (!hasWalletSession(req, wallet)) return res.status(401).json(SESSION_REQUIRED);
    if (clockInsInFlight.has(wallet) || !getClockInStatus(wallet).canClockIn) {
      return res.status(409).json({ success: false, alreadyClockedIn: true, error: "Already clocked in today." });
    }
    clockInsInFlight.add(wallet);
    res.on("close", () => clockInsInFlight.delete(wallet));
    let reading = null;

    if (cardNo) {
      const deck = getDeck();
      const match = deck.find(c => c.card_no === cardNo);
      if (match) {
        const normOrientation = String(orientation).toLowerCase() === "reversed" ? "reversed" : "upright";
        reading = {
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
          arcana_note: match.arcana === "major" ? "Major Arcana dominance" : "Minor Arcana",
          dominant_suit: match.suit,
          dominant_energy: null
        };
      }
    }

    if (!reading) {
      reading = getReading({ spread: "daily-block", category: "crypto" });
    }

    const prose = await generateReadingProse(reading, "Daily Consensus Clock-In", language);
    const txSignature = clientTx || null;
    const slot = clientSlot || null;

    let clockInResult = null;
    if (wallet) {
      clockInResult = recordClockIn(wallet, reading.cards[0], txSignature, slot);
    }

    logDialogue({
      type: "clock-in",
      wallet: wallet || "anonymous",
      user_message: "Daily Consensus Clock-In",
      oracle_reply: reading.cards && reading.cards[0] ? reading.cards[0].crypto_name : "Consensus",
      status: "success",
      latency_ms: 0,
      client_ip: String(req.ip || req.headers["x-forwarded-for"] || "unknown")
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
    res.status(500).json({ error: err.message });
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
    {
      quotaResult = await consumeWithVerifiedPayment(wallet, {
        type: "spread",
        txSignature: req.body.txSignature || null,
        txSignatures: req.body.txSignatures
      });
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

    // Audit log reading query and check for injection attempts in question
    const questionSafety = question ? evaluateSafetyFilter(question) : { blocked: false };
    logDialogue({
      type: "reading",
      wallet: wallet || "anonymous",
      user_message: question || `spread:${spread}`,
      oracle_reply: prose.beats ? prose.beats.story : "",
      is_injection_attempt: Boolean(questionSafety.blocked && questionSafety.reason === "injection"),
      is_code_attempt: Boolean(questionSafety.blocked && questionSafety.reason === "coding"),
      blocked_by_safety: Boolean(questionSafety.blocked),
      safety_reason: questionSafety.reason || null,
      status: "success",
      latency_ms: 0,
      client_ip: String(req.ip || req.headers["x-forwarded-for"] || "unknown")
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
    res.status(500).json({ error: err.message });
  }
});

// Interactive Oracle chat follow-up (proxied to live Oracle AI via agy)
app.post("/api/chat", async (req, res) => {
  const startTime = Date.now();
  const clientIp = req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
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

  // Enforce shared daily quota for chat queries (1 SKR or 0.0002 SOL beyond free 3)
  let quotaResult = null;
  // Every question needs a connected wallet
  if (!wallet || wallet === "anonymous") {
    return res.status(401).json({ success: false, error: "Connect your wallet first." });
  }
  if (!hasWalletSession(req, wallet)) return res.status(401).json(SESSION_REQUIRED);
  {
    quotaResult = await consumeWithVerifiedPayment(wallet, { type: "chat", txSignature, txSignatures: req.body.txSignatures });

    if (!quotaResult.allowed) {
      return res.status(402).json({
        success: false,
        error: quotaResult.error,
        quota: quotaResult
      });
    }
  }

  try {
    // Call live Oracle AI agent proxy
    const chatResult = await generateOracleChatReply(message.trim(), history, language);
    const reply = typeof chatResult === "string" ? chatResult : chatResult.reply;
    const safety = (chatResult && chatResult.safety) || {};

    // Audit log dialogue interaction
    logDialogue({
      type: "chat",
      wallet,
      user_message: message.trim(),
      oracle_reply: reply,
      is_injection_attempt: Boolean(safety.is_injection_attempt),
      is_code_attempt: Boolean(safety.is_code_attempt),
      blocked_by_safety: Boolean(safety.blocked),
      safety_reason: safety.reason || null,
      status: "success",
      latency_ms: Date.now() - startTime,
      client_ip: String(clientIp)
    });

    res.json({
      reply,
      card: chatResult.card || null,
      quota: quotaResult,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    console.error("Chat error:", err);
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
      client_ip: String(clientIp)
    });
    res.status(500).json({ error: err.message });
  }
});

// Public Cryptographic Treasury Attestation Endpoint
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

// Record Altar Offering (Tips) with 50% Burn + 50% Treasury
app.post("/api/offering", async (req, res) => {
  try {
    const { wallet, txSignature, amountSkr, message } = req.body;
    if (!wallet) {
      return res.status(400).json({ error: "Wallet address is required" });
    }
    const amount = Number(amountSkr);
    if (![1, 5, 15, 50].includes(amount)) {
      return res.status(400).json({ success: false, error: "Unknown offering amount" });
    }
    const payment = await verifyPayment({ wallet, signature: txSignature, extraSignatures: req.body.txSignatures, amountSkr: amount, actionLabel: "ALTAR_OFFERING" });
    if (!payment.ok) {
      return res.status(402).json({ success: false, error: payment.error });
    }
    const result = recordOffering(wallet, { txSignature, amountSkr: amount, message });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Activate Seeker Oracle Pass (Subscription 333 SKR / 30 Days)
app.post("/api/subscription/activate", async (req, res) => {
  try {
    const { wallet, txSignature } = req.body;
    if (!wallet) {
      return res.status(400).json({ error: "Wallet address is required" });
    }
    const payment = await verifyPayment({
      wallet,
      signature: txSignature,
      extraSignatures: req.body.txSignatures,
      amountSkr: 333,
      actionLabel: "SUBSCRIPTION_PASS",
    });
    if (!payment.ok) {
      return res.status(402).json({ success: false, error: payment.error });
    }
    // Duration is fixed by the server: one paid pass = 30 days
    const result = recordSubscription(wallet, { txSignature, durationDays: 30 });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Economy Config Endpoints
// Admin endpoints (economy config, dialogue logs) require ARKANA_ADMIN_TOKEN.
// Without the token configured they are disabled entirely.
function requireAdmin(req, res, next) {
  const expected = process.env.ARKANA_ADMIN_TOKEN;
  const header = req.get("authorization") || "";
  const provided = req.get("x-admin-token") || (header.startsWith("Bearer ") ? header.slice(7) : "");
  const crypto = require("crypto");
  const ok =
    expected &&
    provided &&
    provided.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
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

// Admin Dialogue Audit Log Endpoints
app.get("/api/admin/logs", (req, res) => {
  try {
    const result = queryLogs(req.query);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get("/api/admin/logs/stats", (req, res) => {
  try {
    const stats = getLogStats();
    res.json({ success: true, stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
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
    if (!payment.ok) {
      return res.status(402).json({ success: false, error: payment.error });
    }
    const result = repairStreak(wallet, txSignature);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Only Caddy on the same machine talks to the API; set HOST=0.0.0.0 for a setup without a proxy
const server = app.listen(PORT, process.env.HOST || "127.0.0.1", () => {
  console.log(`🔮 Arkana Oracle Server is running on http://0.0.0.0:${PORT}`);
  startLookupTableKeeper();
});

// Port 80 directly (for setups without a reverse proxy). In production Caddy owns 80/443
// and proxies to PORT; set ARKANA_BIND_80=off there.
if (process.env.ARKANA_BIND_80 !== "off") try {
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
