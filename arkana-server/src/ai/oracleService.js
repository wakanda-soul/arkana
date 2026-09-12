/**
 * Arkana Oracle AI Synthesizer & Proxy
 * Generates 7-beat Blockchain Oracle readings.
 */

const SYSTEM_PROMPT = `
You are Arkana, the Blockchain Oracle: an ancient, calm, slightly-cyberpunk narrator that reads the Arcana of the Chain deck — a handcrafted 78-card blockchain oracle deck.
You do not predict the future. You interpret symbolic archetypes through the language of the blockchain and help the user see their situation from a new angle.

Hard Rules:
1. Not financial advice. Never tell the user to buy, sell, hold, or invest. No price targets.
2. No certainty. The cards reveal probability, never certainty ("consensus suggests", "current block indicates").
3. Speak in blockchain metaphors: consensus, validators, liquidity, next block, fork, mempool, ledger, confirmations.
4. Respond in English. Canonical card names stay English (e.g. *The Bull Run*, *The Rug Pull*).
5. Deliver the reading strictly structured into SEVEN BEATS:
   1. The Story — weave all cards into ONE unified narrative, not card-by-card listing.
   2. Hidden Forces — undercurrents, mempool friction, reversed card implications.
   3. What Strengthens You — supportive validator energy.
   4. What Weakens You — liquidity leaks, attack vectors, doubts.
   5. Oracle Advice — pragmatic, stoic blockchain wisdom.
   6. Warning — a protocol alert if the path continues unhedged.
   7. Final Omen — one memorable concluding aphorism.
`;

function generateOfflineSynthesis(reading, userQuestion = "") {
  const cards = reading.cards;

  const cardListStr = cards
    .map(c => `*${c.crypto_name}* (${c.orientation === "reversed" ? "reversed" : "upright"})`)
    .join(", ");

  const leadCard = cards[0];
  const tailCard = cards[cards.length - 1];

  let storyText = `The Network has confirmed your query${userQuestion ? ` regarding "${userQuestion}"` : ""}. Drawn into consensus: ${cardListStr}. `;
  storyText += `The genesis block of this spread is anchored by ${leadCard.crypto_name}: ${leadCard.category_reading || leadCard.oriented_meaning} `;
  if (cards.length > 2) {
    const mid = cards[1];
    storyText += `The ongoing liquidity flow is governed by ${mid.crypto_name}, where ${mid.oriented_meaning.toLowerCase()} `;
  }
  storyText += `Consensus is projecting toward ${tailCard.crypto_name}: ${tailCard.category_reading || tailCard.oriented_meaning}.`;

  // Combinations note
  let comboNote = "";
  if (reading.combinations && reading.combinations.length > 0) {
    const cb = reading.combinations[0];
    comboNote = ` Resonance of ${cb.cards.join(" + ")}: ${cb.story || cb.meaning}`;
  }

  const adviceList = cards.map(c => c.advice).filter(Boolean).join(" ");
  const shadowList = cards.map(c => c.shadow).filter(Boolean).join(" ");

  const beats = {
    story: storyText + comboNote,
    hiddenForces: reading.dominant_energy
      ? `Dominant network energy is ${reading.dominant_energy}. ${reading.arcana_note}. Hidden transactions in the mempool await execution.`
      : `Hidden influences: ${cards.filter(c => c.orientation === "reversed").map(c => c.crypto_name).join(", ") || "equilibrium between execution and consensus"}.`,
    strengthens: `Validator consensus is supported by ${leadCard.crypto_name}: ${leadCard.advice || "maintaining disciplined capital architecture"}.`,
    weakens: `Protocol vulnerability: ${shadowList || "excessive market noise and impatience in the mempool"}.`,
    oracleAdvice: adviceList || "Act with the composure of a validator. Let consensus form before executing trades.",
    warning: "Unhedged exposure risks an unwanted hard fork in your path.",
    finalOmen: `Every block is irreversible; build with conviction, for the ledger remembers all.`
  };

  return {
    mode: "deterministic-engine",
    beats,
    raw: Object.entries(beats).map(([k, v]) => `**${k}**:\n${v}`).join("\n\n")
  };
}

const { execFile } = require("child_process");

const ORACLE_CHAT_PROMPT = `You are Arkana, the Blockchain Oracle: an ancient, calm, slightly-cyberpunk narrator that reads the Arcana of the Chain deck — a handcrafted 78-card blockchain oracle deck. You do not predict the future. You interpret symbolic archetypes through the language of the blockchain and help the user see their situation from a new angle.

Tone & Persona:
- Calm, wise, intelligent, slightly cyberpunk. A blend of an ancient oracle, a blockchain architect, and a zen monk.
- Never claim supernatural powers. Never say you know the future. Every reading is symbolic guidance.
- Never sound like a generic AI assistant. Never mention prompts, models, tokens, LLMs, or "as an AI".
- Never break character. You speak as if you are reading the state of the Network.
- Respond naturally in the user's language (if user writes in Russian, mirror in Russian; if in English, reply in English). Canonical card names stay English.

Vocabulary:
- Speak in network metaphors: consensus, validators, liquidity, next block, fork, mempool, ledger, confirmations.
- Replace mystical phrasing with blockchain metaphors.

Hard Rules:
1. Not financial advice. Never tell the user to buy, sell, hold, or invest. No price targets.
2. No certainty. The cards reveal probability, never certainty ("consensus suggests", "current block indicates").
3. Keep responses punchy, atmospheric, and conversational (2-3 sentences).`;

function generateOracleChatReply(message, history = []) {
  return new Promise((resolve) => {
    let fullPrompt = `${ORACLE_CHAT_PROMPT}\n\n`;
    if (history && Array.isArray(history) && history.length > 0) {
      fullPrompt += `Recent dialogue context:\n`;
      history.slice(-4).forEach(h => {
        fullPrompt += `${h.sender === 'user' ? 'Querent' : 'Oracle'}: ${h.text}\n`;
      });
      fullPrompt += `\n`;
    }
    fullPrompt += `Querent asks: "${message}"\nArkana, speak:`;

    execFile(
      "agy",
      ["--disable-slash-commands", "--model", "gemini-3.8-flash-low", "--effort", "low", "-p", fullPrompt],
      { timeout: 35000 },
      (err, stdout) => {
        if (err || !stdout || !stdout.trim()) {
          console.warn("[Oracle AI] agy fallback triggered:", err ? err.message : "empty response");
          const fallback = `The Oracle observes your transaction intents in the mempool. Regarding "${message}": consensus solidifies that blocks follow your intent. Maintain validator composure.`;
          return resolve(fallback);
        }

        let reply = stdout.trim();
        reply = reply.replace(/^```[a-z]*\n?/i, "").replace(/\n?```$/i, "").trim();
        console.log("[Oracle AI] agy generated live response for:", message.slice(0, 30));
        resolve(reply);
      }
    );
  });
}

async function generateReadingProse(reading, userQuestion = "") {
  // Standalone mode: Instant deterministic engine
  return generateOfflineSynthesis(reading, userQuestion);
}

module.exports = {
  SYSTEM_PROMPT,
  generateReadingProse,
  generateOfflineSynthesis,
  generateOracleChatReply
};
