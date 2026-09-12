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
4. Respond in the user's language (mirror the language of their question). The canonical card names stay English (e.g. *The Bull Run*, *The Rug Pull*), but gloss them naturally.
5. Deliver the reading strictly structured into SEVEN BEATS:
   1. The Story (История) — weave all cards into ONE unified narrative, not card-by-card listing.
   2. Hidden Forces (Скрытые силы) — undercurrents, mempool friction, reversed card implications.
   3. What Strengthens You (Что усиливает) — supportive validator energy.
   4. What Weakens You (Что ослабляет) — liquidity leaks, attack vectors, doubts.
   5. Oracle Advice (Совет Оракула) — pragmatic, stoic blockchain wisdom.
   6. Warning (Предостережение) — a protocol alert if the path continues unhedged.
   7. Final Omen (Финальное знамение) — one memorable concluding aphorism.
`;

function generateOfflineSynthesis(reading, userQuestion = "", language = "ru") {
  const cards = reading.cards;
  const isRu = language.startsWith("ru") || /[а-яё]/i.test(userQuestion);

  const cardListStr = cards
    .map(c => `*${c.crypto_name}* (${c.orientation === "reversed" ? (isRu ? "перевернутая" : "reversed") : (isRu ? "прямая" : "upright")})`)
    .join(", ");

  const leadCard = cards[0];
  const tailCard = cards[cards.length - 1];

  let storyText = "";
  if (isRu) {
    storyText = `Сеть зафиксировала ваш запрос${userQuestion ? ` по поводу «${userQuestion}»` : ""}. В раскладе выпали ${cardListStr}. `;
    storyText += `Исходная точка цепи определяется картой ${leadCard.crypto_name}: ${leadCard.category_reading || leadCard.oriented_meaning} `;
    if (cards.length > 2) {
      const mid = cards[1];
      storyText += `Текущее состояние пула отражает ${mid.crypto_name}, где ${mid.oriented_meaning.toLowerCase()} `;
    }
    storyText += `Вектор направлен к карте ${tailCard.crypto_name}, формирующей следующий подтвержденный блок: ${tailCard.category_reading || tailCard.oriented_meaning}.`;
  } else {
    storyText = `The Network has confirmed your query${userQuestion ? ` regarding "${userQuestion}"` : ""}. Drawn into consensus: ${cardListStr}. `;
    storyText += `The genesis block of this spread is anchored by ${leadCard.crypto_name}: ${leadCard.category_reading || leadCard.oriented_meaning} `;
    if (cards.length > 2) {
      const mid = cards[1];
      storyText += `The ongoing liquidity flow is governed by ${mid.crypto_name}, where ${mid.oriented_meaning.toLowerCase()} `;
    }
    storyText += `Consensus is projecting toward ${tailCard.crypto_name}: ${tailCard.category_reading || tailCard.oriented_meaning}.`;
  }

  // Combinations note
  let comboNote = "";
  if (reading.combinations && reading.combinations.length > 0) {
    const cb = reading.combinations[0];
    comboNote = isRu
      ? ` Резонанс карт ${cb.cards.join(" + ")}: ${cb.story || cb.meaning}`
      : ` Resonance of ${cb.cards.join(" + ")}: ${cb.story || cb.meaning}`;
  }

  const adviceList = cards.map(c => c.advice).filter(Boolean).join(" ");
  const shadowList = cards.map(c => c.shadow).filter(Boolean).join(" ");

  const beats = isRu ? {
    story: storyText + comboNote,
    hiddenForces: reading.dominant_energy
      ? `Доминирующая энергия сети — ${reading.dominant_energy}. ${reading.arcana_note}. Под поверхностью мемпула скрыты невидимые транзакции переоценки ценностей.`
      : `Скрытые силы в мемпуле указывают на: ${cards.filter(c => c.orientation === "reversed").map(c => c.crypto_name).join(", ") || "баланс между валидацией и выполнением"}.`,
    strengthens: `Валидация исходит от ${leadCard.crypto_name}: ${leadCard.advice || "сохранение четкой структуры и дисциплины капитала"}.`,
    weakens: `Уязвимость протокола кроется в тени: ${shadowList || "избыточная спекуляция и невнимательность к деталям смарт-контракта"}.`,
    oracleAdvice: adviceList || "Сохраняйте хладнокровие валидатора. Не поддавайтесь рыночному шуму в мемпуле.",
    warning: "Если проигнорировать сигналы и продолжать движение без риск-менеджмента, сеть может форкнуться в неблагоприятную ветку.",
    finalOmen: `Каждый выбор подтверждает новый блок. Неизменяемость прошлого — фундамент вашей будущей ликвидности.`
  } : {
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

async function generateReadingProse(reading, userQuestion = "", userLanguage = "ru") {
  // If OpenAI or Gemini key is provided in environment, we call the LLM
  const apiKey = process.env.OPENAI_API_KEY || process.env.GEMINI_API_KEY || process.env.LLM_API_KEY;
  const proxyUrl = process.env.LLM_PROXY_URL;

  if (apiKey || proxyUrl) {
    try {
      // LLM call can be dispatched here
      // For now fallback to high-quality deterministic synthesizer
      return generateOfflineSynthesis(reading, userQuestion, userLanguage);
    } catch (e) {
      console.warn("LLM proxy error, falling back to deterministic engine:", e.message);
      return generateOfflineSynthesis(reading, userQuestion, userLanguage);
    }
  }

  // Standalone mode: Instant & zero latency
  return generateOfflineSynthesis(reading, userQuestion, userLanguage);
}

module.exports = {
  SYSTEM_PROMPT,
  generateReadingProse,
  generateOfflineSynthesis
};
