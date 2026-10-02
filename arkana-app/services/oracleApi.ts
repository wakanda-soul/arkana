import { secureRandomInt } from '@/utils/secureRandom';
import { getExtraPaymentSignatures } from './treasuryService';
import { authedFetch } from './sessionService';
import { netFetch } from './netFetch';
import { ALL_CARDS, SPREADS } from '@/data/cardsData';
import { translateFor, LanguageCode } from './i18n';
import { localizeCard } from './cardLocalization';
import { PendingPaymentKind, getPendingPayments, removePendingPayment, savePendingPayment } from './pendingPayments';

// Arkana API. For a local server, point this at it (see README: Run it yourself).
export const API_BASE_URL = 'https://arkana.icu';

/** Stable error codes, so screens never have to match English error text. */
export const ERR_QUOTA_REQUIRED = 'QUOTA_REQUIRED';
export const ERR_PAYMENT_PENDING = 'PAYMENT_PENDING';
export const ERR_PAYMENT_REJECTED = 'PAYMENT_REJECTED';

/** Shown (translated) when a payment landed but the server has not answered yet. */
export const PAYMENT_PENDING_MESSAGE = 'Payment received. Arkana is still answering, try again in a moment.';

function apiError(message: string, code: string, extra?: Record<string, any>): Error {
  const err = new Error(message);
  Object.assign(err, { code }, extra);
  return err;
}

const PAID_REQUEST_ATTEMPTS = 3;

/** A 402 that only means "not visible on chain yet" or "busy": the same payment may succeed later. */
function isRetryablePaymentStatus(status: number, error: string): boolean {
  if (status >= 500 || status === 401 || status === 408 || status === 429) return true;
  return status === 402 && /not found on-chain yet|busy/i.test(error);
}

/**
 * POST for a request that carries a payment signature. The signature is stored before the request,
 * retried with backoff on server errors, and cleared once the server gives a final answer. When the
 * server never answers, it stays stored and ERR_PAYMENT_PENDING is thrown: the payment is never
 * replaced by a local result and never charged again.
 */
async function postPaidRequest(
  kind: PendingPaymentKind,
  path: string,
  body: Record<string, any>,
  wallet: string
): Promise<{ res: Response; data: any }> {
  const signature = String(body.txSignature);
  await savePendingPayment(wallet, { kind, signature, body, createdAt: Date.now() });
  for (let attempt = 1; attempt <= PAID_REQUEST_ATTEMPTS; attempt++) {
    try {
      const res = await authedFetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!isRetryablePaymentStatus(res.status, String(data?.error || ''))) {
        await removePendingPayment(wallet, signature);
        return { res, data };
      }
      console.warn(`Paid request ${path} answered ${res.status}, attempt ${attempt}`);
    } catch (e) {
      console.warn(`Paid request ${path} failed, attempt ${attempt}:`, e);
    }
    if (attempt < PAID_REQUEST_ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 1500 * 2 ** (attempt - 1)));
    }
  }
  throw apiError(PAYMENT_PENDING_MESSAGE, ERR_PAYMENT_PENDING, { signature });
}

const PAID_PATHS: Record<PendingPaymentKind, string> = {
  reading: '/api/reading',
  chat: '/api/chat',
  subscription: '/api/subscription/activate',
  offering: '/api/offering',
  streak_repair: '/api/streak/repair',
  unsubmitted: '/api/payment/credit',
};

/** A reading or question left pending this long is no longer waiting for a retry by the user. */
const STALE_PENDING_MS = 10 * 60 * 1000;
/** An 'unsubmitted' payment younger than this may still be on its way to the server. */
const UNSUBMITTED_GRACE_MS = 2 * 60 * 1000;

/**
 * Sends stored passes and offerings again (called once a wallet session exists, e.g. on app start).
 * Readings and questions are not re-sent here: the next reading or question reuses their payment.
 */
export async function resubmitPendingPayments(wallet: string): Promise<void> {
  const now = Date.now();
  for (const payment of await getPendingPayments(wallet)) {
    const age = now - payment.createdAt;
    let path: string | null = null;
    let body: Record<string, any> = payment.body;
    if (payment.kind === 'subscription' || payment.kind === 'offering' || payment.kind === 'streak_repair') {
      path = PAID_PATHS[payment.kind];
    } else if (
      (payment.kind === 'unsubmitted' && age > UNSUBMITTED_GRACE_MS) ||
      ((payment.kind === 'reading' || payment.kind === 'chat') && age > STALE_PENDING_MS)
    ) {
      // Never answered: the server reads the action from the memo and credits it
      path = PAID_PATHS.unsubmitted;
      body = { wallet, txSignature: payment.signature };
    }
    if (!path) continue;
    try {
      const res = await authedFetch(`${API_BASE_URL}${path}`, { method: 'POST', body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({}));
      if (!isRetryablePaymentStatus(res.status, String(data?.error || ''))) {
        await removePendingPayment(wallet, payment.signature);
      }
    } catch (e) {
      console.warn('Pending payment re-submit failed:', e);
    }
  }
}

let priceCache: { rate: number; at: number } | null = null;

/**
 * SOL estimate of an SKR price for display, from the server's live rate (refreshed from Jupiter every
 * 5 minutes). Display prices never use the phone's own Jupiter quota, which the payment needs.
 */
export async function getSkrSolEstimate(amountSkr: number): Promise<number | null> {
  try {
    if (!priceCache || Date.now() - priceCache.at > 60_000) {
      const res = await netFetch(`${API_BASE_URL}/api/prices`);
      const data = await res.json();
      if (!(data?.skrToSolRate > 0)) return null;
      priceCache = { rate: data.skrToSolRate, at: Date.now() };
    }
    return Number((amountSkr * priceCache.rate).toFixed(6));
  } catch {
    return null;
  }
}

export interface ClockInResult {
  /** true when the server could not be reached and these are placeholder values */
  offline?: boolean;
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
  cards: {
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
  }[];
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
    const j = secureRandomInt(i + 1);
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  const drawn = pool.slice(0, positions.length).map((card) => localizeCard(card, lang));
  let majorsCount = 0;

  const resolvedCards = drawn.map((card, idx) => {
    const isReversed = secureRandomInt(10) < 3;
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
    const res = await authedFetch(url);
    if (res.ok) return await res.json();
  } catch (e) {
    console.warn('API error, using local state:', e);
  }
  return {
    offline: true,
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

/**
 * Seeker Genesis status, verified by the server on chain (it keeps the answer: a holder for 7 days,
 * a non-holder for 10 minutes). Asked once per wallet per app launch; the client never checks the
 * chain itself.
 */
const seekerStatusRequests = new Map<string, Promise<boolean>>();
export function refreshSeekerStatus(wallet: string): Promise<boolean> {
  let pending = seekerStatusRequests.get(wallet);
  if (!pending) {
    pending = (async () => {
      try {
        const res = await authedFetch(`${API_BASE_URL}/api/seeker/status`, {
          method: 'POST',
          body: JSON.stringify({ wallet }),
        });
        if (res.ok) return Boolean((await res.json()).isSeekerHolder);
      } catch {}
      // Not cached on failure, so the next screen asks again
      seekerStatusRequests.delete(wallet);
      return false;
    })();
    seekerStatusRequests.set(wallet, pending);
  }
  return pending;
}

/** Kept for existing callers: the claimed value is ignored, the server decides. */
export async function setRemoteSeekerStatus(wallet: string, _isSeekerHolder?: boolean): Promise<boolean> {
  return refreshSeekerStatus(wallet);
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
  reading?: ReadingResponse;
  /** The server already has today's clock-in (HTTP 409): refetch the status instead of sealing again. */
  alreadyClockedIn?: boolean;
  error?: string;
  txSignature?: string;
  slot?: number;
  streakBonusAwarded?: number;
  streakBonusSpreads?: number;
}> {
  try {
    const res = await authedFetch(`${API_BASE_URL}/api/clock-in`, {
      method: 'POST',
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
    const data = await res.json().catch(() => ({}));
    if (res.status === 409) {
      return { success: false, alreadyClockedIn: true, streak: data.streak || 0, error: data.error || 'Already clocked in today.' };
    }
    return { success: false, streak: 0, error: data.error || `Clock-in failed (${res.status}).` };
  } catch (e: any) {
    // No local seal: a clock-in the server did not record must not look sealed
    console.warn('Backend clock-in error:', e);
    return { success: false, streak: 0, error: e?.message || 'Network request failed' };
  }
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
  const payload: any = { spread, question, wallet, payWithSol, language, txSignature, txSignatures: getExtraPaymentSignatures(txSignature) };
  if (isSeeker !== undefined) {
    payload.isSeeker = isSeeker;
  }

  // A paid reading is never replaced by a local draw
  if (txSignature && wallet) {
    const { res, data } = await postPaidRequest('reading', '/api/reading', payload, wallet);
    if (res.ok) return data;
    throw apiError(data?.error || `Reading failed (${res.status}).`, res.status === 402 ? ERR_PAYMENT_REJECTED : 'SERVER_ERROR');
  }

  try {
    const res = await authedFetch(`${API_BASE_URL}/api/reading`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.status === 402) {
      const errData = await res.json().catch(() => ({}));
      throw apiError(errData.error || 'Daily free allowance reached.', ERR_QUOTA_REQUIRED, { quota: errData.quota });
    }
    if (res.ok) {
      return await res.json();
    }
  } catch (e: any) {
    if (e?.code === ERR_QUOTA_REQUIRED) {
      throw e;
    }
    console.warn('Backend reading fetch error, falling back to local engine:', e);
  }

  return generateLocalReading(spread, question, language);
}

export async function repairStreak(wallet: string, txSignature: string): Promise<{ success: boolean; streak: number; skrBalance: number; cost?: number; error?: string; pending?: boolean }> {
  try {
    // Same safety net as the other paid requests: the payment stays stored until the server answers
    const { data } = await postPaidRequest(
      'streak_repair',
      '/api/streak/repair',
      { wallet, txSignature, txSignatures: getExtraPaymentSignatures(txSignature) },
      wallet
    );
    return data;
  } catch (e: any) {
    const pending = e?.code === ERR_PAYMENT_PENDING;
    return { success: false, streak: 1, skrBalance: 0, pending, error: e.message || 'Streak repair network error' };
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
  const body = { message, wallet, history, payWithSol, txSignature, txSignatures: getExtraPaymentSignatures(txSignature), language };

  // A paid question keeps its payment until the server answers
  if (txSignature && wallet) {
    const { res, data } = await postPaidRequest('chat', '/api/chat', body, wallet);
    if (res.ok) return data;
    throw apiError(data?.error || 'Failed to query Oracle', res.status === 402 ? ERR_PAYMENT_REJECTED : 'SERVER_ERROR');
  }

  const res = await authedFetch(`${API_BASE_URL}/api/chat`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (res.status === 402) {
    throw apiError(data.error || 'Daily free allowance reached.', ERR_QUOTA_REQUIRED, { quota: data.quota });
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
}): Promise<{ success: boolean; totalOfferedSkr: number; error?: string; code?: string }> {
  try {
    const body = { wallet, txSignature, txSignatures: getExtraPaymentSignatures(txSignature), amountSkr, message };
    const { res, data } = await postPaidRequest('offering', '/api/offering', body, wallet);
    if (res.ok) return data;
    return { success: false, totalOfferedSkr: 0, error: data?.error || `Offering failed (${res.status}).` };
  } catch (e: any) {
    return { success: false, totalOfferedSkr: 0, error: e.message || 'Network error submitting offering', code: e?.code };
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
}): Promise<{ success: boolean; subscription?: any; error?: string; code?: string }> {
  try {
    const body = { wallet, txSignature, txSignatures: getExtraPaymentSignatures(txSignature), durationDays };
    const { res, data } = await postPaidRequest('subscription', '/api/subscription/activate', body, wallet);
    if (res.ok) return data;
    return { success: false, error: data?.error || `Pass activation failed (${res.status}).` };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error activating subscription', code: e?.code };
  }
}

/** Re-sends a stored pass payment (the user already paid; nothing is charged again). */
export async function resubmitSubscriptionPayment(
  wallet: string,
  body: Record<string, any>
): Promise<{ success: boolean; subscription?: any; error?: string; code?: string }> {
  try {
    const { res, data } = await postPaidRequest('subscription', '/api/subscription/activate', body, wallet);
    if (res.ok) return data;
    return { success: false, error: data?.error || `Pass activation failed (${res.status}).` };
  } catch (e: any) {
    return { success: false, error: e.message || 'Network error activating subscription', code: e?.code };
  }
}


