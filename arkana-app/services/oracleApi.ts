import { getExtraPaymentSignatures } from './treasuryService';
import { apiHeaders } from './sessionService';
import { ALL_CARDS, CardData, SPREADS } from '@/data/cardsData';
import { translateFor, LanguageCode } from './i18n';
import { localizeCard } from './cardLocalization';

// Public VPS IP for testing, or localhost for local dev
export const API_BASE_URL = 'https://arkana.icu';

export interface ClockInResult {
  canClockIn: boolean;
  streak: number;
  brokenStreak?: number | null;
  canRepairStreak?: boolean;
  repairStreakTarget?: number;
  streakRepairCostSkr?: number;
  lastClockIn: string | null;
  todayCard?: { card_no: string; card: string; orientation: 'upright' | 'reversed'; txSignature?: string | null; slot?: number | null } | null;
  txSignature?: string | null;
  slot?: number | null;
  totalReadings: number;
  skrBalance: number;
  isSeekerHolder: boolean;
  freeSpreadsRemaining?: number;
  freeSpreadsMax?: number;
  streakBonusSpreads?: number;
  streakBonusAwarded?: number;
  extraSpreadCostSkr?: number;
  askCostSkr?: number;
  skrToSolRate?: number;
  askCostSol?: number;
  extraSpreadCostSol?: number;
  subscriptionCostSkr?: number;
  isSubscribed?: boolean;
  subscription?: { active: boolean; expiresAt: string; costSkr?: number } | null;
  totalOfferedSkr?: number;
}

export interface QuotaConsumeResult {
  allowed: boolean;
  isFree: boolean;
  cost: number;
  costSkr?: number;
  costSol?: number;
  paidWith?: 'free' | 'streak_reward' | 'skr' | 'sol';
  remainingFree: number;
  streakBonusSpreads?: number;
  balance: number;
  canPayWithSol?: boolean;
  isSeekerHolder?: boolean;
  error?: string;
  txSignature?: string | null;
}

export interface ReadingResponse {
  success: boolean;
  question?: string;
  spread_name: string;
  spread_key: string;
  category: string;
  quota?: QuotaConsumeResult;
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
export function generateLocalReading(spreadKey: string, question: string = '', language: string = 'en'): ReadingResponse {
  const lang = language as LanguageCode;
  const tr = (key: string, fallback: string, params?: Record<string, string | number>) =>
    translateFor(lang, key, fallback, params);
  const spreadDef = (SPREADS as any)[spreadKey] || (SPREADS as any)['network-scan'];
  const positions: string[] = spreadDef.positions;
  const hints: Record<string, string> = spreadDef.hints;

  // Shuffle copy of deck
  const pool = [...ALL_CARDS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const drawn = pool.slice(0, positions.length).map((card) => localizeCard(card, lang));
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
      arcana_note: majorsCount === 0
        ? tr('offline_arcana_note_minor', 'Tactical decisions resting with the builder')
        : tr('offline_arcana_note_major', 'Network-scale macro archetypes in motion'),
      dominant_suit: lead.suit,
      dominant_energy: lead.energy,
    },
    cards: resolvedCards,
    prose: {
      story: tr(
        'offline_story',
        'The network has committed consensus for your inquiry. The cards {cards} establish a trajectory from {first} to {last}.',
        {
          cards: resolvedCards
            .map((c) => `${c.crypto_name} (${c.orientation === 'reversed' ? tr('orient_reversed', 'reversed') : tr('orient_upright', 'upright')})`)
            .join(', '),
          first: lead.crypto_name,
          last: last.crypto_name,
        }
      ),
      hiddenForces: tr(
        'offline_hidden_forces',
        'The mempool channels the latent energy of {card}. Confirmations crystallize in the wake of your intent.',
        { card: lead.crypto_name }
      ),
      strengthens: tr('offline_strengthens', 'Your position is solidified by {card}: {advice}', {
        card: lead.crypto_name,
        advice: lead.advice || tr('offline_strengthens_default', 'maintain validator composure amidst volatility.'),
      }),
      weakens: tr('offline_weakens', 'Protocol vulnerability vector: {shadow}', {
        shadow: last.shadow || tr('offline_weakens_default', 'unhedged speculation lacking disciplined risk parameters.'),
      }),
      oracleAdvice: lead.advice || tr('offline_advice_default', 'Execute in alignment with the underlying network consensus.'),
      warning: tr('offline_warning', 'Emotional transaction velocity and mispriced priority fees lead to preventable state forks.'),
      finalOmen: tr('offline_final_omen', 'The immutability of the ledger anchors your future liquidity.'),
    },
  };
}

export async function fetchClockInStatus(wallet: string, isSeeker?: boolean): Promise<ClockInResult> {
  try {
    const url = isSeeker !== undefined
      ? `${API_BASE_URL}/api/clock-in/${wallet}?isSeeker=${isSeeker}`
      : `${API_BASE_URL}/api/clock-in/${wallet}`;
    const res = await fetch(url);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('API error, using local state:', e);
  }
  return {
    canClockIn: true,
    streak: 1,
    lastClockIn: null,
    totalReadings: 1,
    skrBalance: 0,
    freeSpreadsRemaining: 0,
    freeSpreadsMax: 0,
    streakBonusSpreads: 0,
    isSeekerHolder: false,
  };
}

export async function setRemoteSeekerStatus(wallet: string, isSeekerHolder: boolean): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/seeker/status`, {
      method: 'POST',
      headers: await apiHeaders(),
      body: JSON.stringify({ wallet, isSeekerHolder }),
    });
    if (res.ok) {
      const data = await res.json();
      return Boolean(data.isSeekerHolder);
    }
  } catch {}
  return false;
}

export async function executeClockIn(
  wallet?: string,
  cardNo?: string,
  orientation?: string,
  language: string = 'en',
  txSignature?: string,
  slot?: number
): Promise<{
  success: boolean;
  streak: number;
  reading: ReadingResponse;
  txSignature?: string;
  slot?: number;
  streakBonusAwarded?: number;
  streakBonusSpreads?: number;
}> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/clock-in`, {
      method: 'POST',
      headers: await apiHeaders(),
      body: JSON.stringify({ wallet, cardNo, orientation, language, txSignature, slot }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        streak: data.clockIn?.streak || 1,
        txSignature: data.txSignature || data.clockIn?.txSignature,
        slot: data.slot || data.clockIn?.slot,
        streakBonusAwarded: data.clockIn?.streakBonusAwarded || 0,
        streakBonusSpreads: data.clockIn?.streakBonusSpreads || 0,
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
  const local = generateLocalReading(
    'daily-block',
    translateFor(language as LanguageCode, 'offline_daily_question', 'Daily Consensus Clock-In'),
    language
  );
  return { success: true, streak: 1, streakBonusAwarded: 0, streakBonusSpreads: 0, reading: local };
}

export async function fetchReading(
  spread: string,
  question: string = '',
  wallet?: string,
  payWithSol: boolean = false,
  language: string = 'en',
  isSeeker?: boolean,
  txSignature?: string | null
): Promise<ReadingResponse> {
  try {
    const payload: any = { spread, question, wallet, payWithSol, language, txSignature, txSignatures: getExtraPaymentSignatures(txSignature) };
    if (isSeeker !== undefined) {
      payload.isSeeker = isSeeker;
    }
    const res = await fetch(`${API_BASE_URL}/api/reading`, {
      method: 'POST',
      headers: await apiHeaders(),
      body: JSON.stringify(payload),
    });
    if (res.status === 402) {
      const errData = await res.json();
      throw new Error(errData.error || 'Daily free spread allowance reached. 5 SKR or 0.001 SOL required to cast an additional spread.');
    }
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    if (e.message && (e.message.includes('5 SKR') || e.message.includes('SOL required') || e.message.includes('Seeker Genesis'))) {
      throw e;
    }
    console.warn('Backend reading fetch error, falling back to local engine:', e);
  }

  return generateLocalReading(spread, question, language);
}

export async function consumeSpreadQuota(wallet?: string, isSeeker?: boolean): Promise<QuotaConsumeResult> {
  if (!wallet) {
    return { allowed: true, isFree: true, cost: 0, remainingFree: 0, balance: 0, isSeekerHolder: false };
  }
  try {
    const payload: any = { wallet };
    if (isSeeker !== undefined) {
      payload.isSeeker = isSeeker;
    }
    const res = await fetch(`${API_BASE_URL}/api/spread/consume`, {
      method: 'POST',
      headers: await apiHeaders(),
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return data;
  } catch (e) {
    console.warn('API error consuming spread quota:', e);
    return { allowed: true, isFree: true, cost: 0, remainingFree: 0, balance: 0, isSeekerHolder: false };
  }
}

export async function repairStreak(wallet: string, txSignature: string): Promise<{ success: boolean; streak: number; skrBalance: number; cost?: number; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/streak/repair`, {
      method: 'POST',
      headers: await apiHeaders(),
      body: JSON.stringify({ wallet, txSignature, txSignatures: getExtraPaymentSignatures(txSignature) }),
    });
    const data = await res.json();
    return data;
  } catch (e: any) {
    return { success: false, streak: 1, skrBalance: 0, error: e.message || 'Streak repair network error' };
  }
}

export async function sendOracleChatMessage({
  message,
  wallet,
  history = [],
  payWithSol = false,
  txSignature = null,
  language = 'en',
}: {
  message: string;
  wallet?: string;
  history?: any[];
  payWithSol?: boolean;
  txSignature?: string | null;
  language?: string;
}): Promise<{
  reply: string;
  card?: any;
  quota?: QuotaConsumeResult;
  timestamp: string;
}> {
  const res = await fetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    headers: await apiHeaders(),
    body: JSON.stringify({ message, wallet, history, payWithSol, txSignature, txSignatures: getExtraPaymentSignatures(txSignature), language }),
  });

  const data = await res.json();
  if (res.status === 402) {
    const err = new Error(data.error || 'Daily free allowance reached.');
    (err as any).quota = data.quota;
    throw err;
  }
  if (!res.ok) {
    throw new Error(data.error || 'Failed to query Oracle');
  }
  return data;
}

export async function submitAltarOfferingApi({
  wallet,
  txSignature,
  amountSkr,
  message,
}: {
  wallet: string;
  txSignature: string;
  amountSkr: number;
  message?: string;
}): Promise<{ success: boolean; totalOfferedSkr: number; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/offering`, {
      method: 'POST',
      headers: await apiHeaders(),
      body: JSON.stringify({ wallet, txSignature, txSignatures: getExtraPaymentSignatures(txSignature), amountSkr, message }),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, totalOfferedSkr: 0, error: e.message || 'Network error submitting offering' };
  }
}

export async function activateSubscriptionApi({
  wallet,
  txSignature,
  durationDays = 30,
}: {
  wallet: string;
  txSignature: string;
  durationDays?: number;
}): Promise<{ success: boolean; subscription?: any; error?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/subscription/activate`, {
      method: 'POST',
      headers: await apiHeaders(),
      body: JSON.stringify({ wallet, txSignature, txSignatures: getExtraPaymentSignatures(txSignature), durationDays }),
    });
    return await res.json();
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error activating subscription' };
  }
}


