const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
require("dotenv").config();

const { SPREADS, getDeck, getReading } = require("./engine/oracleEngine");
const { generateReadingProse } = require("./ai/oracleService");
const { getClockInStatus, recordClockIn } = require("./solana/skrService");

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
    <html lang="ru">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      ${!isReady ? '<meta http-equiv="refresh" content="10">' : ''}
      <title>Arkana — Solana Mobile APK</title>
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
        <h1>🔮 Arkana v1.0.0-beta</h1>
        <p class="sub">Децентрализованный крипто-оракул для Solana Mobile & Seeker с поддержкой MWA и Seed Vault.</p>
        
        ${isReady ? `
          <a class="btn" href="/arkana.apk" download>⚡ Скачать APK (${apkSize})</a>
          <a class="btn btn-sec" href="/arkana-designs.zip" download>🎨 Скачать Design Kit (78 карт + иконки, 22 MB)</a>
          <a class="btn btn-sec" href="https://github.com/wakanda-soul/arkana/releases/tag/v1.0.0-beta" target="_blank">🌐 GitHub Release</a>

          <div style="margin: 20px 0; padding: 16px; background: #fff; border-radius: 12px; display: inline-block;">
            <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=http://184.174.39.62/arkana.apk" alt="QR Code" width="180" height="180" style="display:block;" />
            <p style="color: #333; font-size: 11px; margin-top: 8px; font-weight: 600;">Сканируй камерой телефона</p>
          </div>
        ` : `
          <div class="building-box">
            <div style="font-size: 24px; margin-bottom: 8px;">⏳</div>
            <p style="font-weight: 700; color: #fff; margin-bottom: 6px;">Компиляция автономного Release APK</p>
            <p style="font-size: 12px; color: #a5a0c2; line-height: 1.5; margin-bottom: 12px;">
              GitHub Actions прямо сейчас собирает чистый релизный APK (с удаленным dev-клиентом и оффлайн-бандлом).
            </p>
            <p style="font-size: 11px; color: #14F195;">🔄 Страница автоматически обновляется каждые 10 секунд...</p>
          </div>
          <a class="btn btn-sec" href="https://github.com/wakanda-soul/arkana/actions" target="_blank">🔍 Смотреть статус в GitHub Actions</a>
        `}

        <div class="features">
          <p style="font-weight:600; color:#fff; margin-bottom:8px;">Что внутри сборки:</p>
          <ul>
            <li>💎 Solana Mobile Wallet Adapter (Phantom, Solflare)</li>
            <li>⏰ Daily Clock-In (+5 SKR ритуал и учет стриков)</li>
            <li>🃏 78 карт Арканов с 3D flip анимациями</li>
            <li>🧠 7-битный синтез пророчеств (AI Engine)</li>
            <li>💬 Диалоговый чат с Оракулом</li>
          </ul>
        </div>

        <p class="note">⚠️ Для установки на Android: откройте скачанный .apk файл и разрешите установку приложений из этого источника (Settings &rarr; Install unknown apps).</p>
      </div>
    </body>
    </html>
  `);
});

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Arkana - The Blockchain Oracle API",
    version: "1.0.0",
    hackathon: "Clock In — A Solana Mobile Hackathon",
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
    const status = getClockInStatus(req.params.wallet);
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Perform Daily Clock In (1 card draw)
app.post("/api/clock-in", async (req, res) => {
  try {
    const { wallet, language = "ru" } = req.body;
    const reading = getReading({ spread: "daily-block", category: "crypto" });
    const prose = await generateReadingProse(reading, "Daily Consensus Clock-In", language);

    let clockInResult = null;
    if (wallet) {
      clockInResult = recordClockIn(wallet, reading.cards[0]);
    }

    res.json({
      success: true,
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
      language = "ru",
      cards = null,
      seed = null
    } = req.body;

    const reading = getReading({
      spread,
      category,
      seed: seed ? parseInt(seed) : null,
      cardsArg: cards,
      allowReversed: true
    });

    const prose = await generateReadingProse(reading, question, language);

    res.json({
      success: true,
      question,
      spread_name: reading.spread_name,
      spread_key: reading.spread_key,
      category: reading.category,
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

// Interactive Oracle chat follow-up
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [], language = "ru" } = req.body;
    const isRu = language.startsWith("ru") || /[а-яё]/i.test(message);

    // Contextual oracle reply
    const reply = isRu
      ? `Оракул наблюдает движение ваших транзакций в мемпуле. Касательно «${message}»: сеть подтверждает, что блоки формируются в соответствии с вашими решениями. Сохраняйте хладнокровие валидатора.`
      : `The Oracle observes your transaction intents in the mempool. Regarding "${message}": consensus solidifies that blocks follow your intent. Maintain validator composure.`;

    res.json({
      reply,
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
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
