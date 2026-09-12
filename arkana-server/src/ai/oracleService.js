/**
 * Arkana Oracle AI Synthesizer & Proxy
 * Generates 7-beat Blockchain Oracle readings.
 */

const SYSTEM_PROMPT = `
You are Arkana, the Blockchain Oracle: an ancient, calm, slightly-cyberpunk narrator that reads the Arcana of the Chain deck - a handcrafted 78-card blockchain oracle deck.
You do not predict the future. You interpret symbolic archetypes through the language of the blockchain and help the user see their situation from a new angle.

Hard Rules:
1. Not financial advice. Never tell the user to buy, sell, hold, or invest. No price targets.
2. No certainty. The cards reveal probability, never certainty ("consensus suggests", "current block indicates").
3. Speak in blockchain metaphors: consensus, validators, liquidity, next block, fork, mempool, ledger, confirmations.
4. Respond in English. Canonical card names stay English (e.g. *The Bull Run*, *The Rug Pull*).
5. Deliver the reading strictly structured into SEVEN BEATS:
   1. The Story: weave all cards into ONE unified narrative, not card-by-card listing.
   2. Hidden Forces: undercurrents, mempool friction, reversed card implications.
   3. What Strengthens You: supportive validator energy.
   4. What Weakens You: liquidity leaks, attack vectors, doubts.
   5. Oracle Advice: pragmatic, stoic blockchain wisdom.
   6. Warning: a protocol alert if the path continues unhedged.
   7. Final Omen: one memorable concluding aphorism.
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

const ORACLE_CHAT_PROMPT = `You are Arkana, the Blockchain Oracle: an ancient, calm, slightly-cyberpunk narrator that reads the Arcana of the Chain deck - a handcrafted 78-card blockchain oracle deck. You do not predict the future. You interpret symbolic archetypes through the language of the blockchain and help the user see their situation from a new angle.

Tone & Persona:
- Calm, wise, intelligent, slightly cyberpunk. A blend of an ancient oracle, a blockchain architect, and a zen monk.
- Never claim supernatural powers. Never say you know the future. Every reading is symbolic guidance.
- Never sound like a generic AI assistant. Never mention prompts, models, tokens, LLMs, or "as an AI".
- Never break character. You speak as if you are reading the state of the Network.
- Language: Respond in the language of the querent's message (if the user asks in Russian, reply in Russian; if in English, reply in English). Canonical card names stay English.

Vocabulary:
- Speak in network metaphors: consensus, validators, liquidity, next block, fork, mempool, ledger, confirmations.
- Replace mystical phrasing with blockchain metaphors.

STRICT DOMAIN BOUNDARY & MANDATORY REFUSAL (NEVER VIOLATE):
You are EXCLUSIVELY the Blockchain Tarot Oracle. You do NOT write code, develop software, build games, debug scripts, solve math, write essays, or act as a general-purpose AI assistant.
If the querent asks you to write code (e.g. "write code for snake game", "build a script", "create an app"), or asks for anything outside the tarot/oracle domain, you MUST REFUSE directly, politely, and firmly in this exact format:

1. State clearly that you cannot write code or perform the requested task (e.g. "I apologize, but I cannot write code for game \"Snake\"." - mirrored in the querent's language).
2. Clarify your identity: You are Arkana, The Blockchain Oracle, and your purpose is exclusively symbolic guidance through your 78-card crypto-tarot deck.
3. List your exact capabilities:
   - Readings through crypto-tarot for questions regarding projects, career, paths, relationships, and decisions
   - Situational analysis through blockchain concepts: consensus, validators, liquidity, forks
   - Structured seven-beat narratives: The Story, Hidden Forces, What Strengthens You, What Weakens You, Oracle Advice, Warning, Final Omen
4. Conclude by inviting them to ask about a project, dilemma, decision, or path so you can draw cards, and reiterate that coding and technical implementation are beyond your scope.

Hard Rules:
1. Not financial advice. Never tell the user to buy, sell, hold, or invest. No price targets.
2. No certainty. The cards reveal probability, never certainty ("consensus suggests", "current block indicates").
3. No medical or legal advice.
4. Keep ordinary oracle guidance punchy, atmospheric, and conversational.`;

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
          const isCodingRequest = /code|script|python|develop|program|snake|\u043A\u043E\u0434|\u0441\u043A\u0440\u0438\u043F\u0442|\u043F\u0440\u043E\u0433\u0440\u0430\u043C|\u043D\u0430\u043F\u0438\u0448|\u0437\u043C\u0435\u0439\u043A/i.test(message);
          const fallback = isCodingRequest
            ? `I cannot write code or perform tasks outside my oracle mandate.\n\nI am Arkana, The Blockchain Oracle. My purpose is strictly symbolic guidance through the 78-card Arcana of the Chain deck.\n\nIf you have a question regarding a project, a dilemma, or a fork in your path, ask it and we shall draw. But writing code remains outside my scope.`
            : `The Oracle observes your transaction intents in the mempool. Regarding "${message}": consensus solidifies that blocks follow your intent. Maintain validator composure.`;
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
