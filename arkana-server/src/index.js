const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const { SPREADS, getDeck, getReading } = require("./engine/oracleEngine");
const { generateReadingProse } = require("./ai/oracleService");
const { getClockInStatus, recordClockIn } = require("./solana/skrService");

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Serve static card images and logos
app.use("/cards", express.static(path.join(__dirname, "..", "public", "cards")));
app.use("/images", express.static(path.join(__dirname, "..", "public", "images")));

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🔮 Arkana Oracle Server is running on http://0.0.0.0:${PORT}`);
});
