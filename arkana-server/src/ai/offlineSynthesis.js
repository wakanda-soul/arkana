/**
 * Reading written without the AI model (model unavailable or timed out), in the user's language.
 * Card texts come from the app's card translations; card names always stay in English.
 */
const fs = require("fs");
const path = require("path");

const CARD_LOCALES_DIR = path.join(__dirname, "..", "..", "..", "arkana-app", "data", "locales", "cards");
const cardLocales = {};

function localizedCard(card, lang) {
  if (lang === "en") return card;
  if (!(lang in cardLocales)) {
    try {
      cardLocales[lang] = JSON.parse(fs.readFileSync(path.join(CARD_LOCALES_DIR, `${lang}.json`), "utf8"));
    } catch {
      cardLocales[lang] = null;
    }
  }
  const tr = cardLocales[lang] && cardLocales[lang][card.card_no];
  if (!tr) return card;
  const reversed = card.orientation === "reversed";
  return {
    ...card,
    oriented_meaning: (reversed ? tr.reversed_full : tr.upright_full) || card.oriented_meaning,
    advice: tr.advice || card.advice,
    shadow: tr.shadow || card.shadow,
  };
}

const TEMPLATES = {
  en: {
    upright: "upright", reversed: "reversed",
    introQuestion: 'The Network has confirmed your question "{q}".', intro: "The Network has confirmed your question.",
    drawn: "Drawn into consensus: {list}.",
    lead: "The spread is anchored by {card}: {text}", tail: "Consensus is moving toward {card}: {text}",
    hidden: "Hidden influences: {cards}.", hiddenNone: "Execution and consensus are in balance; no hidden currents stand out.",
    strengthens: "Your position is supported by {card}: {text}", weakens: "Watch the weak spots: {text}",
    adviceDefault: "Act with a validator's composure. Let consensus form before you move.",
    warning: "Unhedged exposure can lead to an unwanted hard fork on your path.",
    omen: "Every block is irreversible: build with conviction, the ledger remembers everything.",
  },
  ru: {
    upright: "прямая", reversed: "перевёрнутая",
    introQuestion: "Сеть приняла твой вопрос «{q}».", intro: "Сеть приняла твой вопрос.",
    drawn: "В консенсус вошли: {list}.",
    lead: "Опора расклада: {card}. {text}", tail: "Консенсус движется к {card}. {text}",
    hidden: "Скрытые влияния: {cards}.", hiddenNone: "Исполнение и консенсус в равновесии, скрытых течений не видно.",
    strengthens: "Твою позицию укрепляет {card}. {text}", weakens: "Следи за слабыми местами: {text}",
    adviceDefault: "Действуй со спокойствием валидатора. Дай консенсусу сложиться, прежде чем делать ход.",
    warning: "Открытая позиция без страховки может привести к нежеланному хардфорку на твоём пути.",
    omen: "Каждый блок необратим: строй уверенно, реестр помнит всё.",
  },
  zh: {
    upright: "正位", reversed: "逆位",
    introQuestion: "网络已确认你的问题：「{q}」。", intro: "网络已确认你的问题。",
    drawn: "进入共识的卡牌：{list}。",
    lead: "这次牌阵的锚点是 {card}：{text}", tail: "共识正在走向 {card}：{text}",
    hidden: "隐藏的影响：{cards}。", hiddenNone: "执行与共识保持平衡，没有明显的暗流。",
    strengthens: "支撑你立场的是 {card}：{text}", weakens: "留意薄弱之处：{text}",
    adviceDefault: "像验证者一样沉着行事。先让共识形成，再采取行动。",
    warning: "没有对冲的敞口，可能让你的道路出现不想要的硬分叉。",
    omen: "每个区块都不可逆：带着信念去构建，账本会记住一切。",
  },
  hi: {
    upright: "सीधा", reversed: "उल्टा",
    introQuestion: "नेटवर्क ने तुम्हारा प्रश्न स्वीकार किया है: \"{q}\"।", intro: "नेटवर्क ने तुम्हारा प्रश्न स्वीकार किया है।",
    drawn: "कंसेंसस में आए कार्ड: {list}।",
    lead: "इस स्प्रेड का आधार {card} है: {text}", tail: "कंसेंसस {card} की ओर बढ़ रहा है: {text}",
    hidden: "छिपे प्रभाव: {cards}।", hiddenNone: "निष्पादन और कंसेंसस संतुलन में हैं, कोई छिपी धारा नहीं दिखती।",
    strengthens: "तुम्हारी स्थिति को {card} सहारा देता है: {text}", weakens: "कमज़ोर जगहों पर नज़र रखो: {text}",
    adviceDefault: "वैलिडेटर जैसी शांति से काम लो। कदम उठाने से पहले कंसेंसस बनने दो।",
    warning: "बिना हेज की पोज़िशन तुम्हारे रास्ते में अनचाहा हार्ड फ़ोर्क ला सकती है।",
    omen: "हर ब्लॉक अपरिवर्तनीय है: विश्वास के साथ बनाओ, लेजर सब याद रखता है।",
  },
  es: {
    upright: "al derecho", reversed: "invertida",
    introQuestion: "La Red ha confirmado tu pregunta: «{q}».", intro: "La Red ha confirmado tu pregunta.",
    drawn: "Entran en consenso: {list}.",
    lead: "La tirada se ancla en {card}: {text}", tail: "El consenso avanza hacia {card}: {text}",
    hidden: "Influencias ocultas: {cards}.", hiddenNone: "Ejecución y consenso están en equilibrio; no se ven corrientes ocultas.",
    strengthens: "Tu posición se apoya en {card}: {text}", weakens: "Vigila los puntos débiles: {text}",
    adviceDefault: "Actúa con la calma de un validador. Deja que el consenso se forme antes de moverte.",
    warning: "Una exposición sin cobertura puede provocar un hard fork no deseado en tu camino.",
    omen: "Cada bloque es irreversible: construye con convicción, el ledger lo recuerda todo.",
  },
  ar: {
    upright: "معتدلة", reversed: "مقلوبة",
    introQuestion: "أكّدت الشبكة سؤالك: «{q}».", intro: "أكّدت الشبكة سؤالك.",
    drawn: "دخلت في الإجماع: {list}.",
    lead: "ترتكز هذه القراءة على {card}: {text}", tail: "يتجه الإجماع نحو {card}: {text}",
    hidden: "تأثيرات خفية: {cards}.", hiddenNone: "التنفيذ والإجماع في توازن، ولا تظهر تيارات خفية.",
    strengthens: "يدعم موقفك {card}: {text}", weakens: "انتبه إلى نقاط الضعف: {text}",
    adviceDefault: "تصرّف بهدوء المُدقِّق. دع الإجماع يتشكّل قبل أن تتحرك.",
    warning: "التعرّض دون تحوّط قد يقود إلى hard fork غير مرغوب في طريقك.",
    omen: "كل كتلة لا رجعة فيها: ابنِ بثقة، فالسجل يتذكّر كل شيء.",
  },
  fr: {
    upright: "à l'endroit", reversed: "renversée",
    introQuestion: "Le Réseau a confirmé ta question : « {q} ».", intro: "Le Réseau a confirmé ta question.",
    drawn: "Entrent dans le consensus : {list}.",
    lead: "Le tirage s'ancre sur {card} : {text}", tail: "Le consensus avance vers {card} : {text}",
    hidden: "Influences cachées : {cards}.", hiddenNone: "Exécution et consensus sont en équilibre, aucun courant caché ne ressort.",
    strengthens: "Ta position s'appuie sur {card} : {text}", weakens: "Surveille les points faibles : {text}",
    adviceDefault: "Agis avec le calme d'un validateur. Laisse le consensus se former avant d'agir.",
    warning: "Une exposition sans couverture peut provoquer un hard fork non désiré sur ton chemin.",
    omen: "Chaque bloc est irréversible : construis avec conviction, le registre se souvient de tout.",
  },
  bn: {
    upright: "সোজা", reversed: "উল্টো",
    introQuestion: "নেটওয়ার্ক তোমার প্রশ্ন গ্রহণ করেছে: \"{q}\"।", intro: "নেটওয়ার্ক তোমার প্রশ্ন গ্রহণ করেছে।",
    drawn: "কনসেনসাসে এসেছে: {list}।",
    lead: "এই স্প্রেডের ভিত্তি {card}: {text}", tail: "কনসেনসাস এগোচ্ছে {card}-এর দিকে: {text}",
    hidden: "লুকানো প্রভাব: {cards}।", hiddenNone: "এক্সিকিউশন ও কনসেনসাস ভারসাম্যে আছে, কোনো লুকানো স্রোত চোখে পড়ছে না।",
    strengthens: "তোমার অবস্থানকে শক্তি দিচ্ছে {card}: {text}", weakens: "দুর্বল জায়গাগুলোর দিকে নজর রাখো: {text}",
    adviceDefault: "একজন ভ্যালিডেটরের মতো শান্তভাবে কাজ করো। পদক্ষেপ নেওয়ার আগে কনসেনসাস তৈরি হতে দাও।",
    warning: "হেজ ছাড়া এক্সপোজার তোমার পথে অনাকাঙ্ক্ষিত হার্ড ফর্ক আনতে পারে।",
    omen: "প্রতিটি ব্লক অপরিবর্তনীয়: দৃঢ় বিশ্বাসে গড়ো, লেজার সব মনে রাখে।",
  },
  pt: {
    upright: "em pé", reversed: "invertida",
    introQuestion: "A Rede confirmou sua pergunta: \"{q}\".", intro: "A Rede confirmou sua pergunta.",
    drawn: "Entram no consenso: {list}.",
    lead: "A tiragem se ancora em {card}: {text}", tail: "O consenso avança rumo a {card}: {text}",
    hidden: "Influências ocultas: {cards}.", hiddenNone: "Execução e consenso estão em equilíbrio; nenhuma corrente oculta se destaca.",
    strengthens: "Sua posição se apoia em {card}: {text}", weakens: "Fique de olho nos pontos fracos: {text}",
    adviceDefault: "Aja com a calma de um validador. Deixe o consenso se formar antes de agir.",
    warning: "Uma exposição sem proteção pode causar um hard fork indesejado no seu caminho.",
    omen: "Todo bloco é irreversível: construa com convicção, o ledger lembra de tudo.",
  },
  id: {
    upright: "tegak", reversed: "terbalik",
    introQuestion: "Jaringan telah mengonfirmasi pertanyaanmu: \"{q}\".", intro: "Jaringan telah mengonfirmasi pertanyaanmu.",
    drawn: "Masuk ke konsensus: {list}.",
    lead: "Bacaan ini berpijak pada {card}: {text}", tail: "Konsensus bergerak menuju {card}: {text}",
    hidden: "Pengaruh tersembunyi: {cards}.", hiddenNone: "Eksekusi dan konsensus seimbang; tidak ada arus tersembunyi yang menonjol.",
    strengthens: "Posisimu ditopang oleh {card}: {text}", weakens: "Waspadai titik lemah: {text}",
    adviceDefault: "Bertindaklah setenang validator. Biarkan konsensus terbentuk sebelum melangkah.",
    warning: "Eksposur tanpa lindung nilai bisa memicu hard fork yang tidak diinginkan di jalanmu.",
    omen: "Setiap blok tidak bisa dibatalkan: bangunlah dengan keyakinan, ledger mengingat segalanya.",
  },
};

const fill = (tpl, params) => tpl.replace(/\{(\w+)\}/g, (_, k) => (params[k] !== undefined ? params[k] : ""));

function generateOfflineSynthesis(reading, userQuestion = "", language = "en") {
  const lang = TEMPLATES[language] ? language : "en";
  const T = TEMPLATES[lang];
  const cards = reading.cards.map((c) => localizedCard(c, lang));
  const lead = cards[0];
  const tail = cards[cards.length - 1];

  const list = cards.map((c) => `${c.crypto_name} (${c.orientation === "reversed" ? T.reversed : T.upright})`).join(", ");
  const story = [
    userQuestion ? fill(T.introQuestion, { q: userQuestion }) : T.intro,
    fill(T.drawn, { list }),
    fill(T.lead, { card: lead.crypto_name, text: lead.oriented_meaning }),
    cards.length > 1 ? fill(T.tail, { card: tail.crypto_name, text: tail.oriented_meaning }) : "",
  ].filter(Boolean).join(" ");

  const reversed = cards.filter((c) => c.orientation === "reversed").map((c) => c.crypto_name);
  const beats = {
    story,
    hiddenForces: reversed.length ? fill(T.hidden, { cards: reversed.join(", ") }) : T.hiddenNone,
    strengthens: fill(T.strengthens, { card: lead.crypto_name, text: lead.advice || T.adviceDefault }),
    weakens: fill(T.weakens, { text: cards.map((c) => c.shadow).filter(Boolean).join(" ") || T.warning }),
    oracleAdvice: cards.map((c) => c.advice).filter(Boolean).join(" ") || T.adviceDefault,
    warning: T.warning,
    finalOmen: T.omen,
  };

  return {
    mode: "deterministic-engine",
    beats,
    raw: Object.entries(beats).map(([k, v]) => `**${k}**:\n${v}`).join("\n\n"),
  };
}

module.exports = { generateOfflineSynthesis, localizedCard };
