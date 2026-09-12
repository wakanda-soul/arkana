const fs = require("fs");
const path = require("path");

const CARDS_DIR = path.join(__dirname, "references", "cards");
const COMBOS_FILE = path.join(__dirname, "references", "combinations.json");
const MANIFEST_FILE = path.join(__dirname, "manifest.json");
const ENERGIES_FILE = path.join(__dirname, "references", "energies.json");

const SPREADS = {
  "daily-block": {
    name: "The Daily Block",
    positions: ["Today's Consensus"],
    hints: {
      "Today's Consensus": "the prevailing energy validating your day and trading mindset"
    }
  },
  "network-scan": {
    name: "The Network Scan",
    positions: ["Past", "Present", "Next Block"],
    hints: {
      "Past": "the block that set the current chain in motion",
      "Present": "the current state of the Network — the trend or barrier you stand in",
      "Next Block": "the most probable next step if nothing changes (a direction, not a verdict)"
    }
  },
  "validator-cross": {
    name: "The Validator Cross",
    positions: [
      "Current State",
      "Main Opportunity",
      "Main Obstacle",
      "Hidden Influence",
      "Outcome if the current path continues"
    ],
    hints: {
      "Current State": "where you stand; the core of the question",
      "Main Opportunity": "the strongest supportive force / the opening",
      "Main Obstacle": "the central challenge crossing the situation",
      "Hidden Influence": "the undercurrent you don't see (weight reversed cards heavily)",
      "Outcome if the current path continues": "the tendency if nothing changes (conditional)"
    }
  },
  "crypto-compass": {
    name: "The Crypto Compass",
    positions: ["You", "Market", "Project", "Opportunity", "Risk"],
    hints: {
      "You": "your real position, mindset, readiness",
      "Market": "the external conditions / macro sentiment",
      "Project": "the thing itself, on its own merits",
      "Opportunity": "the realistic upside / what can be gained",
      "Risk": "what can break it (the shadow to manage)"
    }
  }
};

const DOMAINS = ["crypto", "trading", "money", "career", "startup", "relationships", "health", "life"];
const CATEGORY_ALIASES = {
  love: "relationships",
  work: "career",
  job: "career",
  general: "life",
  other: "life",
  "": "crypto"
};

let _passports = null;
let _manifest = null;
let _combos = null;
let _energies = null;

function loadData() {
  if (!_passports) {
    _passports = {};
    const files = fs.readdirSync(CARDS_DIR).sort();
    for (const f of files) {
      if (!f.endsWith(".json")) continue;
      const data = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, f), "utf-8"));
      const suit = data.suit || "Major";
      for (const card of data.cards) {
        card.suit = suit;
        _passports[card.crypto_name] = card;
      }
    }
  }

  if (!_manifest && fs.existsSync(MANIFEST_FILE)) {
    _manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf-8"));
  }

  if (!_combos && fs.existsSync(COMBOS_FILE)) {
    _combos = JSON.parse(fs.readFileSync(COMBOS_FILE, "utf-8"));
  }

  if (!_energies && fs.existsSync(ENERGIES_FILE)) {
    _energies = JSON.parse(fs.readFileSync(ENERGIES_FILE, "utf-8"));
  }
}

function makeRng(seed) {
  if (seed === null || seed === undefined) return Math.random;
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function getDeck() {
  loadData();
  const deck = [];
  for (const name in _passports) {
    const card = _passports[name];
    const meta = _manifest && _manifest.cards && _manifest.cards[name] ? _manifest.cards[name] : null;
    deck.push({
      crypto_name: card.crypto_name,
      classic: card.classic,
      suit: card.suit,
      arcana: card.arcana || (card.suit === "Major Arcana" ? "major" : "minor"),
      card_no: meta ? meta.n : "00",
      image: meta ? `/cards/${meta.n}.webp` : "/cards/00.webp",
      keywords: card.keywords || [],
      energy: _energies && _energies[card.crypto_name] ? _energies[card.crypto_name].energy : null,
      symbolism: card.symbolism,
      advice: card.advice,
      shadow: card.shadow,
      upright_full: card.upright_full,
      reversed_full: card.reversed_full,
      readings: card.readings
    });
  }
  return deck;
}

function normCategory(cat) {
  if (!cat) return "crypto";
  const c = String(cat).toLowerCase().trim();
  if (DOMAINS.includes(c)) return c;
  return CATEGORY_ALIASES[c] || "crypto";
}

function getReading({ spread = "network-scan", category = "crypto", seed = null, cardsArg = null, allowReversed = true }) {
  loadData();
  const cat = normCategory(category);
  const spreadDef = SPREADS[spread] || SPREADS["network-scan"];
  const positions = spreadDef.positions;
  const hints = spreadDef.hints;

  const deck = getDeck();
  const rnd = makeRng(seed);

  let picks = [];
  if (cardsArg) {
    // Parse cardsArg "00,05:r,07"
    const tokens = cardsArg.split(",").map(t => t.trim());
    for (const tok of tokens) {
      const parts = tok.split(":");
      const identifier = parts[0];
      const isRev = parts[1] === "r";
      const found = deck.find(c => c.card_no === identifier || c.crypto_name.toLowerCase() === identifier.toLowerCase());
      if (found) {
        picks.push({ card: found, reversed: isRev });
      }
    }
  } else {
    // Random draw
    const pool = deck.slice();
    for (let i = 0; i < positions.length; i++) {
      const j = i + Math.floor(rnd() * (pool.length - i));
      [pool[i], pool[j]] = [pool[j], pool[i]];
      const isRev = allowReversed ? rnd() < 0.30 : false;
      picks.push({ card: pool[i], reversed: isRev });
    }
  }

  // Build resolved cards
  const resolvedCards = picks.map((p, idx) => {
    const pos = positions[idx] || `Position ${idx + 1}`;
    const c = p.card;
    const orientation = p.reversed ? "reversed" : "upright";
    const oriented_meaning = p.reversed ? c.reversed_full : c.upright_full;
    const catReading = (c.readings && c.readings[cat]) ? c.readings[cat] : (c.readings && c.readings.crypto ? c.readings.crypto : oriented_meaning);

    return {
      position: pos,
      position_hint: hints[pos] || "",
      card_no: c.card_no,
      crypto_name: c.crypto_name,
      classic: c.classic,
      suit: c.suit,
      arcana: c.arcana,
      orientation,
      image: c.image,
      keywords: c.keywords,
      energy: c.energy,
      oriented_meaning,
      category_reading: catReading,
      symbolism: c.symbolism,
      advice: c.advice,
      shadow: c.shadow
    };
  });

  // Calculate metrics
  let majorsCount = 0;
  const suitTally = {};
  const energyTally = {};

  for (const rc of resolvedCards) {
    if (rc.arcana === "major" || rc.suit === "Major Arcana") majorsCount++;
    suitTally[rc.suit] = (suitTally[rc.suit] || 0) + 1;
    if (rc.energy) energyTally[rc.energy] = (energyTally[rc.energy] || 0) + 1;
  }

  let dominantSuit = null;
  let maxSuitCount = 1;
  for (const s in suitTally) {
    if (suitTally[s] > maxSuitCount) {
      maxSuitCount = suitTally[s];
      dominantSuit = s;
    }
  }

  let dominantEnergy = null;
  let maxEnergyCount = 1;
  for (const e in energyTally) {
    if (energyTally[e] > maxEnergyCount) {
      maxEnergyCount = energyTally[e];
      dominantEnergy = e;
    }
  }

  let arcanaNote = "";
  if (majorsCount === 0) {
    arcanaNote = "no Major Arcana — everyday tactical choices, largely in the querent's control";
  } else if (majorsCount >= Math.ceil(positions.length / 2)) {
    arcanaNote = "heavy Major Arcana presence — macro network forces and pivotal milestones at play";
  } else {
    arcanaNote = "balanced blend of archetype forces and tactical execution";
  }

  // Check combinations
  const foundCombos = [];
  if (_combos && Array.isArray(_combos.combinations)) {
    const drawnNames = resolvedCards.map(c => c.crypto_name);
    for (const combo of _combos.combinations) {
      if (combo.cards && combo.cards.every(name => drawnNames.includes(name))) {
        foundCombos.push(combo);
      }
    }
  }

  return {
    spread_key: spread,
    spread_name: spreadDef.name,
    category: cat,
    seed,
    majors_count: majorsCount,
    structural: majorsCount >= Math.ceil(positions.length / 2),
    arcana_note: arcanaNote,
    dominant_suit: dominantSuit,
    dominant_energy: dominantEnergy,
    suit_tally: suitTally,
    energy_tally: energyTally,
    cards: resolvedCards,
    combinations: foundCombos
  };
}

module.exports = {
  SPREADS,
  getDeck,
  getReading
};
