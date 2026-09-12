import { ALL_CARDS, CardData, SPREADS } from '@/data/cardsData';

// Public VPS IP for testing, or localhost for local dev
export const API_BASE_URL = 'http://184.174.39.62:3001';

export interface ClockInResult {
  canClockIn: boolean;
  streak: number;
  lastClockIn: string | null;
  totalReadings: number;
  skrBalance: number;
  isSeekerHolder: boolean;
}

export interface ReadingResponse {
  success: boolean;
  question?: string;
  spread_name: string;
  spread_key: string;
  category: string;
  cards: Array<{
    position: string;
    position_hint: string;
    card_no: string;
    crypto_name: string;
    classic: string;
    suit: string;
    arcana: string;
    orientation: 'upright' | 'reversed';
    image: string;
    keywords: string[];
    energy: string | null;
    oriented_meaning: string;
    symbolism: string;
    advice: string;
    shadow: string;
  }>;
  engine_metrics: {
    majors_count: number;
    structural: boolean;
    arcana_note: string;
    dominant_suit: string | null;
    dominant_energy: string | null;
  };
  prose: {
    story: string;
    hiddenForces: string;
    strengthens: string;
    weakens: string;
    oracleAdvice: string;
    warning: string;
    finalOmen: string;
  };
}

// Local fallback draw generator for 100% offline capability
export function generateLocalReading(spreadKey: string, question: string = ''): ReadingResponse {
  const spreadDef = (SPREADS as any)[spreadKey] || (SPREADS as any)['network-scan'];
  const positions: string[] = spreadDef.positions;
  const hints: Record<string, string> = spreadDef.hints;

  // Shuffle copy of deck
  const pool = [...ALL_CARDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const drawn = pool.slice(0, positions.length);
  let majorsCount = 0;

  const resolvedCards = drawn.map((card, idx) => {
    const isReversed = Math.random() < 0.3;
    const pos = positions[idx];
    if (card.arcana === 'major') majorsCount++;

    return {
      position: pos,
      position_hint: hints[pos] || '',
      card_no: card.card_no,
      crypto_name: card.crypto_name,
      classic: card.classic,
      suit: card.suit,
      arcana: card.arcana,
      orientation: isReversed ? ('reversed' as const) : ('upright' as const),
      image: `/cards/${card.card_no}.webp`,
      keywords: card.keywords,
      energy: card.energy,
      oriented_meaning: isReversed ? card.reversed_full : card.upright_full,
      symbolism: card.symbolism,
      advice: card.advice,
      shadow: card.shadow,
    };
  });

  const lead = resolvedCards[0];
  const last = resolvedCards[resolvedCards.length - 1];

  return {
    success: true,
    question,
    spread_name: spreadDef.name,
    spread_key: spreadKey,
    category: 'crypto',
    engine_metrics: {
      majors_count: majorsCount,
      structural: majorsCount >= Math.ceil(positions.length / 2),
      arcana_note: majorsCount === 0 ? 'Тактические решения в руках создателя' : 'Влияние макро-архетипов сети',
      dominant_suit: lead.suit,
      dominant_energy: lead.energy,
    },
    cards: resolvedCards,
    prose: {
      story: `Сеть зафиксировала консенсус для вашего вопроса. Карты ${resolvedCards.map(c => `${c.crypto_name} (${c.orientation === 'reversed' ? 'перевернутая' : 'прямая'})`).join(', ')} формируют вектор от ${lead.crypto_name} к ${last.crypto_name}.`,
      hiddenForces: `Мемпул несет скрытую энергию карты ${lead.crypto_name}. Подтверждения следуют за вашим намерением.`,
      strengthens: `Ваша позиция укреплена картой ${lead.crypto_name}: ${lead.advice || 'сохраняйте хладнокровие валидатора'}.`,
      weakens: `Потенциальная уязвимость протокола: ${last.shadow || 'избыточная спекуляция без риск-менеджмента'}.`,
      oracleAdvice: lead.advice || 'Действуйте в гармонии с консенсусом сети.',
      warning: 'Ошибочный расчет газа и эмоции в мемпуле ведут к ненужному форку.',
      finalOmen: 'Неизменяемость реестра — основа вашей будущей ликвидности.',
    },
  };
}

export async function fetchClockInStatus(wallet: string): Promise<ClockInResult> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/clock-in/${wallet}`);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('API error, using local state:', e);
  }
  return {
    canClockIn: true,
    streak: 1,
    lastClockIn: null,
    totalReadings: 1,
    skrBalance: 50,
    isSeekerHolder: true,
  };
}

export async function executeClockIn(wallet: string): Promise<{ success: boolean; streak: number; reading: ReadingResponse }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/clock-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        streak: data.clockIn?.streak || 1,
        reading: {
          success: true,
          spread_name: data.reading.spread_name,
          spread_key: data.reading.spread_key,
          category: data.reading.category,
          cards: data.reading.cards,
          engine_metrics: {
            majors_count: data.reading.majors_count,
            structural: data.reading.structural,
            arcana_note: data.reading.arcana_note,
            dominant_suit: data.reading.dominant_suit,
            dominant_energy: data.reading.dominant_energy,
          },
          prose: data.prose,
        },
      };
    }
  } catch (e) {
    console.warn('Backend clock-in error, using offline generator:', e);
  }

  // Offline fallback
  const local = generateLocalReading('daily-block', 'Daily Consensus Clock-In');
  return { success: true, streak: 1, reading: local };
}

export async function fetchReading(spread: string, question: string = '', wallet?: string): Promise<ReadingResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/reading`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ spread, question, wallet }),
    });
    if (res.ok) {
      return await res.json();
    }
  } catch (e) {
    console.warn('Backend reading fetch error, falling back to local engine:', e);
  }

  return generateLocalReading(spread, question);
}
