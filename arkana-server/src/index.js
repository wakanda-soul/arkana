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
  loadEconomyConfig,
  updateEconomyConfig
} = require("./solana/skrService");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static files (card images, logos, APKs)
app.use(express.static(path.join(__dirname, "..", "public")));
app.use("/cards", express.static(path.join(__dirname, "..", "public", "cards")));
app.use("/images", express.static(path.join(__dirname, "..", "public", "images")));

// Mobile APK Download Landing Page
app.get("/download", (req, res) => {
  const apkPath = path.join(__dirname, "..", "public", "arkana.apk");
  const isReady = fs.existsSync(apkPath);
  const apkSize = isReady ? (fs.statSync(apkPath).size / (1024 * 1024)).toFixed(1) + " MB" : null;

  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${!isReady ? '<meta http-equiv="refresh" content="10">' : ''}
      <title>Arkana: Solana Mobile APK</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
          background: #080711;
          color: #f0f0f8;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
          padding: 24px;
        }
        .card {
          background: #121024;
          border: 1px solid #2a2254;
          border-radius: 20px;
          max-width: 480px;
          width: 100%;
          padding: 32px 24px;
          text-align: center;
          box-shadow: 0 20px 40px rgba(0,0,0,0.6), 0 0 80px rgba(153,69,255,0.15);
        }
        .badge {
          display: inline-block;
          background: rgba(20, 241, 149, 0.15);
          color: #14F195;
          border: 1px solid rgba(20, 241, 149, 0.3);
          padding: 6px 14px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 1px;
          margin-bottom: 16px;
        }
        h1 {
          font-size: 28px;
          font-weight: 800;
          margin-bottom: 8px;
          background: linear-gradient(135deg, #fff, #b8a6ff);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }
        p.sub {
          color: #8f8ba8;
          font-size: 14px;
          line-height: 1.5;
          margin-bottom: 24px;
        }
        .btn {
          display: block;
          width: 100%;
          background: linear-gradient(135deg, #9945FF, #14F195);
          color: #000;
          font-weight: 700;
          font-size: 16px;
          padding: 16px;
          border-radius: 12px;
          text-decoration: none;
          margin-bottom: 12px;
          transition: transform 0.1s ease;
        }
        .btn:active { transform: scale(0.98); }
        .btn-sec {
          background: #1c1836;
          color: #b8a6ff;
          border: 1px solid #362e66;
        }
        .building-box {
          background: rgba(153,69,255,0.12);
          border: 1px solid rgba(153,69,255,0.3);
          border-radius: 12px;
          padding: 20px 16px;
          margin: 20px 0;
          text-align: center;
        }
        .features {
          text-align: left;
          background: #0b0918;
          border-radius: 12px;
          padding: 16px;
          margin: 20px 0;
          font-size: 13px;
          color: #a5a0c2;
        }
        .features li { margin-left: 20px; margin-bottom: 6px; }
        .note {
          font-size: 11px;
          color: #6d688a;
          line-height: 1.4;
          margin-top: 16px;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">SOLANA MOBILE HACKATHON 2026</div>
        <h1>🔮 Arkana v1.0.6</h1>
        <p class="sub">Decentralized crypto-oracle for Solana Mobile & Seeker with MWA and Seed Vault support.</p>
        
        ${isReady ? `
          <a class="btn" style="background: linear-gradient(135deg, #14F195 0%, #00C853 100%); color: #000; font-weight: 700;" href="https://github.com/wakanda-soul/arkana/releases/download/v1.0.0-beta/arkana-v1.0.0-beta.apk">⚡ High-Speed CDN Download (${apkSize})</a>
          <a class="btn btn-sec" href="/arkana.apk" download>🖥️ VPS Server Mirror (${apkSize})</a>
          <a class="btn btn-sec" href="/arkana-designs.zip" download>🎨 Download Design Kit (78 cards + icons, 22 MB)</a>
          <a class="btn btn-sec" href="https://github.com/wakanda-soul/arkana/releases/tag/v1.0.0-beta" target="_blank">🌐 GitHub Release</a>

          <div style="margin: 20px 0; padding: 16px; background: #fff; border-radius: 12px; display: inline-block;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://github.com/wakanda-soul/arkana/releases/download/v1.0.0-beta/arkana-v1.0.0-beta.apk" alt="QR Code" width="180" height="180" style="display:block;" />
            <p style="color: #333; font-size: 11px; margin-top: 8px; font-weight: 600;">Scan with phone camera (High Speed)</p>
          </div>
        ` : `
          <div class="building-box">
            <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
            <p style="font-weight: 700; color: #fff; margin-bottom: 6px;">Compiling Standalone Release APK</p>
            <p style="font-size: 12px; color: #a5a0c2; line-height: 1.5; margin-bottom: 12px;">
              GitHub Actions is building the release APK (bundled offline Hermes bytecode, no dev-client).
            </p>
            <p style="font-size: 11px; color: #14F195;">🔄 Page refreshes automatically every 10 seconds...</p>
          </div>
          <a class="btn btn-sec" href="https://github.com/wakanda-soul/arkana/actions" target="_blank">🔍 View Status in GitHub Actions</a>
        `}

        <div class="features">
          <p style="font-weight:600; color:#fff; margin-bottom:8px;">What's inside this build:</p>
          <ul>
            <li>💎 Solana Mobile Wallet Adapter (Phantom, Solflare) & Seed Vault</li>
            <li>⌨️ Native Soft-Keyboard Avoidance for Android and Ask input field</li>
            <li>✨ Obsidian Ritual Design & Interactive Core Loop (Tap &rarr; Shuffle &rarr; Pick &rarr; Reveal &rarr; Sign)</li>
            <li>🛡️ Full System Edge States (AI Generating, Tx Failed, Wallet Declined, Limit Reached, Offline)</li>
            <li>⏰ Daily Clock-In (daily free spread refill & streak tier multiplier)</li>
            <li>🃏 78 Tarot Arcana cards with 3D flip animations</li>
            <li>📖 Codex Archetype Collection & Card Zoom Inspection</li>
            <li>📢 Transmit / Share to X with dynamic anti-bot templates & card art</li>
            <li>⚡ Streak Repair Mechanism with dynamic SKR recovery</li>
            <li>🧠 7-Beat Oracle Synthesis (AI Engine)</li>
            <li>💬 Interactive Oracle Chat</li>
          </ul>
        </div>

        <p class="note">⚠️ To install on Android: open downloaded .apk file and allow installation from this source (Settings &rarr; Install unknown apps).</p>
      </div>
    </body>
    </html>
  `);
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Arkana - The Solana Oracle API",
    version: "1.0.6",
    hackathon: "Clock In: A Solana Mobile Hackathon",
    network: "Solana Mobile / Seeker"
  });
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
    const isSeeker = req.query.isSeeker !== undefined ? (req.query.isSeeker === "true" || req.query.isSeeker === "1") : true;
    const status = getClockInStatus(wallet, isSeeker);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check and consume spread quota or deduct 5 SKR fee
app.post("/api/spread/consume", (req, res) => {
  try {
    const { wallet, isSeeker } = req.body;
    const result = consumeSpread(wallet, { isSeeker: isSeeker !== undefined ? Boolean(isSeeker) : true });
    if (!result.allowed) {
      return res.status(402).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update or verify Seeker Genesis SBT status
app.post("/api/seeker/status", (req, res) => {
  try {
    const { wallet, isSeekerHolder } = req.body;
    const status = setSeekerHolderStatus(wallet, isSeekerHolder);
    res.json({ success: true, wallet, isSeekerHolder: status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Perform Daily Clock In (1 card draw)
app.post("/api/clock-in", async (req, res) => {
  try {
    const { wallet, language = "en", cardNo, orientation = "upright", txSignature: clientTx, slot: clientSlot } = req.body;
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
    const txSignature = clientTx || ("5xK" + Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10));
    const slot = clientSlot || (289441200 + Math.floor(Math.random() * 5000));

    let clockInResult = null;
    if (wallet) {
      clockInResult = recordClockIn(wallet, reading.cards[0]);
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
    if (wallet) {
      quotaResult = consumeSpread(wallet, {
        type: "spread",
        cost: 5,
        payWithSol: Boolean(req.body.payWithSol),
        txSignature: req.body.txSignature || null,
        isSeeker: req.body.isSeeker !== undefined ? Boolean(req.body.isSeeker) : true
      });
      if (!quotaResult.allowed) {
        return res.status(402).json({
          success: false,
          error: quotaResult.error,
          quota: quotaResult
        });
      }
    }

    const reading = getReading({
      spread,
      category,
      seed: seed ? parseInt(seed) : null,
      cardsArg: cards,
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
  const { message, history = [], wallet = "anonymous", payWithSol = false, txSignature = null, language = "en" } = req.body;

  if (!message || !message.trim()) {
    return res.status(400).json({ error: "Message is required" });
  }

  // Enforce shared daily quota for chat queries (1 SKR or 0.0002 SOL beyond free 3)
  let quotaResult = null;
  if (wallet && wallet !== "anonymous") {
    quotaResult = consumeSpread(wallet, {
      type: "chat",
      cost: 1,
      payWithSol: Boolean(payWithSol),
      txSignature
    });

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

// Admin Economy Config Endpoints
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
app.post("/api/streak/repair", (req, res) => {
  try {
    const { wallet } = req.body;
    const result = repairStreak(wallet);
    if (!result.success) {
      return res.status(400).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔮 Arkana Oracle Server is running on http://0.0.0.0:${PORT}`);
});

// Also bind standard HTTP port 80 for frictionless mobile downloads
try {
  const http = require("http");
  http.createServer(app).listen(80, "0.0.0.0", () => {
    console.log(`🔮 Arkana HTTP download listener running on http://0.0.0.0:80`);
  });
} catch (err) {
  console.warn("Could not bind port 80:", err.message);
}
