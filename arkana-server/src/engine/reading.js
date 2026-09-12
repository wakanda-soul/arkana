#!/usr/bin/env node
/**
 * Arcana of the Chain — one-shot reading packet (Node.js port of reading.py).
 *
 * Wraps draw.js: draws the cards AND assembles everything the Oracle needs into
 * one JSON dossier — each card's meaning filtered by orientation + category, the
 * symbolism/advice/shadow, engine metrics (dominant suit, Major weight, structural
 * flag), and any seeded combination-bank hits. The Oracle then writes ONE story
 * from this packet; it does not open other files or re-draw.
 *
 * Usage:
 *   node reading.js <spread> --category <cat> [--seed N] [--cards "A:r,B,C"]
 */
const fs = require("fs");
const path = require("path");
const drawmod = require("./draw.js");

const HERE = __dirname;
const CARDS_DIR = path.join(HERE, "..", "references", "cards");
const COMBOS = path.join(HERE, "..", "references", "combinations.json");
const MANIFEST = path.join(HERE, "..", "deck-web", "manifest.json");
const ENERGIES = path.join(HERE, "..", "references", "energies.json");

const DOMAINS = ["crypto", "trading", "money", "career", "startup", "relationships", "health", "life"];
const CATEGORY_ALIASES = { love: "relationships", work: "career", job: "career", general: "life", other: "life", "": "crypto" };

const POSITION_HINTS = {
  "network-scan": {
    "Past": "the block that set the current chain in motion",
    "Present": "the current state of the Network — the trend or barrier you stand in",
    "Next Block": "the most probable next step if nothing changes (a direction, not a verdict)",
  },
  "validator-cross": {
    "Current State": "where you stand; the core of the question",
    "Main Opportunity": "the strongest supportive force / the opening",
    "Main Obstacle": "the central challenge crossing the situation",
    "Hidden Influence": "the undercurrent you don't see (weight reversed cards heavily)",
    "Outcome if the current path continues": "the tendency if nothing changes (conditional)",
  },
  "crypto-compass": {
    "You": "your real position, mindset, readiness",
    "Market": "the external conditions / macro sentiment",
    "Project": "the thing itself, on its own merits",
    "Opportunity": "the realistic upside / what can be gained",
    "Risk": "what can break it (the shadow to manage)",
  },
};

function loadPassports() {
  const p = {};
  for (const fname of fs.readdirSync(CARDS_DIR).sort()) {
    if (!fname.endsWith(".json")) continue;
    const data = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, fname), "utf-8"));
    const suit = data.suit || "?";
    for (const c of data.cards) { c.suit = suit; p[c.crypto_name] = c; }
  }
  return p;
}

function normCategory(cat) {
  cat = (cat || "").trim().toLowerCase();
  if (cat in CATEGORY_ALIASES) cat = CATEGORY_ALIASES[cat];
  return DOMAINS.includes(cat) ? cat : "crypto";
}

function buildFromUserCards(spreadArg, spec, deckNames) {
  const [name, key, positions] = drawmod.resolveSpread(spreadArg);
  const items = spec.split(",").map(s => s.trim()).filter(Boolean);
  if (items.length !== positions.length) {
    throw new Error(`--cards has ${items.length} cards but spread '${key}' has ${positions.length} positions`);
  }
  const cards = positions.map((pos, i) => {
    const parts = items[i].split(":");
    const cname = parts[0].trim();
    const rev = parts.length > 1 && ["r", "rev", "reversed"].includes(parts[1].trim().toLowerCase());
    if (!deckNames.has(cname)) throw new Error(`unknown card: ${cname}`);
    return { position: pos, crypto_name: cname, orientation: rev ? "reversed" : "upright" };
  });
  return { spread: name, spread_key: key, seed: null, reversed_chance: drawmod.REVERSED_CHANCE, cards };
}

function comboHits(names, combos) {
  const hits = [];
  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      for (const c of combos) {
        if ((c.a === names[i] && c.b === names[j]) || (c.a === names[j] && c.b === names[i])) {
          hits.push({ a: c.a, b: c.b, s: c.s });
        }
      }
    }
  }
  return hits;
}

function main() {
  const argv = process.argv.slice(2);
  let spreadArg = null, seed = null, category = null, cardsSpec = null;
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if ((a === "--seed" || a === "-s") && i + 1 < argv.length) seed = parseInt(argv[++i], 10);
    else if ((a === "--category" || a === "-c") && i + 1 < argv.length) category = argv[++i];
    else if (a === "--cards" && i + 1 < argv.length) cardsSpec = argv[++i];
    else if (spreadArg === null && !a.startsWith("-")) spreadArg = a;
  }

  const passports = loadPassports();
  const deckNames = new Set(Object.keys(passports));
  const cat = normCategory(category);
  let deckImg = {};
  try { deckImg = (JSON.parse(fs.readFileSync(MANIFEST, "utf-8")).cards) || {}; } catch (e) { deckImg = {}; }
  let deckEnergy = {};
  try { deckEnergy = (JSON.parse(fs.readFileSync(ENERGIES, "utf-8")).cards) || {}; } catch (e) { deckEnergy = {}; }

  let base;
  try {
    base = cardsSpec ? buildFromUserCards(spreadArg, cardsSpec, deckNames)
                     : drawmod.performDraw(spreadArg, seed);
  } catch (e) {
    console.log(JSON.stringify({ error: e.message })); process.exit(2);
  }

  const key = base.spread_key;
  const hints = POSITION_HINTS[key] || {};

  let majors = 0;
  const suitTally = {};
  const resolved = base.cards.map(c => {
    const p = passports[c.crypto_name];
    const arcana = p.arcana || "minor";
    if (arcana === "major") majors++;
    else suitTally[p.suit] = (suitTally[p.suit] || 0) + 1;
    const oriented = c.orientation === "reversed" ? (p.reversed_full || "") : (p.upright_full || "");
    const entry = {
      position: c.position,
      position_hint: hints[c.position] || null,
      crypto_name: c.crypto_name,
      classic: p.classic,
      suit: p.suit,
      arcana,
      orientation: c.orientation,
      keywords: p.keywords || [],
      oriented_meaning: oriented,
      category_reading: (p.domains || {})[cat] || "",
      symbolism: p.symbolism || "",
      advice: p.advice || "",
      shadow: p.shadow || "",
    };
    const img = deckImg[c.crypto_name];
    if (img) { entry.card_no = img.n; entry.image = img.web; }
    const en = deckEnergy[entry.card_no];
    if (en) entry.energy = en;
    if ("court" in p) entry.court = p.court;
    return entry;
  });

  const n = resolved.length;
  const structural = majors >= 3 || (n <= 3 && majors >= 2);
  let arcanaNote;
  if (majors === 0) arcanaNote = "no Major Arcana — everyday choices, largely in the querent's control";
  else if (structural) arcanaNote = `${majors} Major Arcana — STRUCTURAL / life-changing forces beyond full control`;
  else arcanaNote = `${majors} Major Arcana — a meaningful theme anchors the spread`;

  let dominantSuit = null;
  const vals = Object.values(suitTally);
  if (vals.length) {
    const top = Math.max(...vals);
    const leaders = Object.keys(suitTally).filter(s => suitTally[s] === top);
    dominantSuit = leaders.length === 1 ? leaders[0] : null;
  }

  const energyTally = {};
  for (const c of resolved) { if (c.energy) energyTally[c.energy] = (energyTally[c.energy] || 0) + 1; }
  let dominantEnergy = null;
  const ev = Object.values(energyTally);
  if (ev.length) {
    const top = Math.max(...ev);
    const leaders = Object.keys(energyTally).filter(e => energyTally[e] === top);
    dominantEnergy = leaders.length === 1 ? leaders[0] : null;
  }

  const combos = JSON.parse(fs.readFileSync(COMBOS, "utf-8")).pairs;
  const hits = comboHits(resolved.map(c => c.crypto_name), combos);

  const cardsArg = resolved.filter(c => c.card_no)
    .map(c => c.card_no + (c.orientation === "reversed" ? ":r" : "")).join(",");

  const out = {
    spread: base.spread, spread_key: key, cards_arg: cardsArg, category: cat, seed: base.seed,
    reversed_chance: base.reversed_chance, majors, structural, arcana_note: arcanaNote,
    dominant_suit: dominantSuit, suit_tally: suitTally,
    dominant_energy: dominantEnergy, energy_tally: energyTally, cards: resolved, combinations: hits,
    instructions: "Reveal the spread as an image at the TOP of the reply, in 3 steps: (1) run "
      + "`python scripts/render_spread.py <spread_key> --cards <cards_arg>` — it self-installs Pillow if "
      + "the sandbox lacks it and prints the PNG path; (2) upload that PNG to the session's shared object "
      + "storage (OSS) to get a public https URL; (3) put that URL as a markdown image `![Spread](url)` on "
      + "the FIRST line, then the reading. The image leads (not just a bare link at the bottom). Embed the "
      + "REAL url; never hand-type a guessed/local image path. Fall back to a plain-text list "
      + "(`• Position — Card (orientation)`) ONLY if render/upload truly fails; never a table, `<br>`, or "
      + "ASCII schematic. Then write the reading as chat TEXT: ONE story using category_reading + "
      + "combinations; apply arcana_note, dominant_suit, dominant_energy; then the 7 beats (The Story, "
      + "Hidden Forces, What Strengthens You, What Weakens You, Oracle Advice, Warning, Final Omen). Never "
      + "read cards one-by-one. No financial advice/certainty.",
  };
  console.log(JSON.stringify(out, null, 2));
}

main();
