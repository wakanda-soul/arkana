#!/usr/bin/env node
/**
 * Arcana of the Chain — fair card draw (RNG, NOT the LLM).
 *
 * Portable Node.js equivalent of draw.py. Draws distinct cards uniformly from
 * the 78-card deck and gives each a 30% chance of being reversed, removing the
 * language model from the act of drawing.
 *
 * Usage:
 *   node draw.js <spread> [--seed N]
 *
 * <spread>: network-scan (default) | validator-cross | crypto-compass |
 *           <integer N> | comma,separated,positions
 * --seed N: reproducible draw; if omitted a random seed is chosen and echoed
 *           back so any draw can be replayed. NOTE: a seed reproduces only within
 *           the SAME runtime — draw.js (mulberry32) and draw.py (Mersenne Twister)
 *           use different PRNGs, so seeds are not portable between Node and Python.
 *
 * Output: JSON on stdout. The Oracle loads each card's passport from
 * ../references/cards/ and interprets. It must NOT re-draw.
 */
const fs = require("fs");
const path = require("path");

const HERE = __dirname;
const CARDS_DIR = path.join(HERE, "..", "references", "cards");
const REVERSED_CHANCE = 0.30;

const SPREADS = {
  "network-scan": ["The Network Scan", ["Past", "Present", "Next Block"]],
  "validator-cross": ["The Validator Cross", [
    "Current State", "Main Opportunity", "Main Obstacle",
    "Hidden Influence", "Outcome if the current path continues"]],
  "crypto-compass": ["The Crypto Compass", ["You", "Market", "Project", "Opportunity", "Risk"]],
};

// Seedable PRNG (mulberry32) so --seed reproduces a draw; Math.random otherwise.
function makeRng(seed) {
  if (seed === null || seed === undefined) return Math.random;
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function loadDeck() {
  const deck = [];
  for (const fname of fs.readdirSync(CARDS_DIR).sort()) {
    if (!fname.endsWith(".json")) continue;
    const data = JSON.parse(fs.readFileSync(path.join(CARDS_DIR, fname), "utf-8"));
    const suit = data.suit || "?";
    for (const c of data.cards) {
      deck.push({ crypto_name: c.crypto_name, classic: c.classic, suit });
    }
  }
  return deck;
}

function sample(deck, n, rnd) {
  // Fisher-Yates partial shuffle for distinct uniform picks.
  const a = deck.slice();
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(rnd() * (a.length - i));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, n);
}

function resolveSpread(arg) {
  const key = (arg || "network-scan").toLowerCase();
  if (SPREADS[key]) return [SPREADS[key][0], key, SPREADS[key][1]];
  if (arg && /^\d+$/.test(arg)) {
    const n = parseInt(arg, 10);
    return [`${n}-Card Draw`, "custom", Array.from({ length: n }, (_, i) => `Card ${i + 1}`)];
  }
  if (arg && arg.includes(",")) {
    return ["Custom Spread", "custom", arg.split(",").map(s => s.trim()).filter(Boolean)];
  }
  return [SPREADS["network-scan"][0], "network-scan", SPREADS["network-scan"][1]];
}

// Core RNG draw. Returns the same object the CLI prints. Reused by reading.js.
function performDraw(spreadArg, seed, deck) {
  if (!deck) deck = loadDeck();
  if (deck.length !== 78) throw new Error(`deck has ${deck.length} cards, expected 78`);

  const [name, key, positions] = resolveSpread(spreadArg);
  if (positions.length > deck.length) throw new Error(`spread wants ${positions.length} cards, deck has ${deck.length}`);

  if (seed === null || seed === undefined || Number.isNaN(seed)) seed = Math.floor(Math.random() * 2 ** 31);
  const rnd = makeRng(seed);

  const picked = sample(deck, positions.length, rnd);
  const cards = positions.map((pos, i) => ({
    position: pos,
    crypto_name: picked[i].crypto_name,
    classic: picked[i].classic,
    suit: picked[i].suit,
    orientation: rnd() < REVERSED_CHANCE ? "reversed" : "upright",
  }));
  return { spread: name, spread_key: key, seed, reversed_chance: REVERSED_CHANCE, cards };
}

function main() {
  const argv = process.argv.slice(2);
  let spreadArg = null, seed = null;
  for (let i = 0; i < argv.length; i++) {
    if ((argv[i] === "--seed" || argv[i] === "-s") && i + 1 < argv.length) { seed = parseInt(argv[++i], 10); }
    else if (spreadArg === null) { spreadArg = argv[i]; }
  }
  try {
    console.log(JSON.stringify(performDraw(spreadArg, seed), null, 2));
  } catch (e) {
    console.log(JSON.stringify({ error: e.message })); process.exit(2);
  }
}

module.exports = { loadDeck, resolveSpread, performDraw, makeRng, sample, SPREADS, REVERSED_CHANCE };

if (require.main === module) main();
