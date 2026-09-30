import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Payments that landed on chain but were not credited by the server yet (it did not answer).
 * They are kept per wallet so the app can submit the same signature again instead of charging twice:
 * readings and questions reuse it on the next attempt, passes and offerings are re-sent on app start.
 */
export type PendingPaymentKind = 'reading' | 'chat' | 'subscription' | 'offering';

export interface PendingPayment {
  kind: PendingPaymentKind;
  signature: string;
  /** Request body that was sent with the payment (includes txSignature and txSignatures). */
  body: Record<string, any>;
  createdAt: number;
}

/** The server refuses payments older than this, so older entries are dropped. */
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;

const storageKey = (wallet: string) => `arkana_pending_payments_${wallet}`;

export async function getPendingPayments(wallet: string): Promise<PendingPayment[]> {
  if (!wallet) return [];
  try {
    const raw = await AsyncStorage.getItem(storageKey(wallet));
    const list = raw ? (JSON.parse(raw) as PendingPayment[]) : [];
    return Array.isArray(list) ? list.filter((p) => p && p.signature && Date.now() - p.createdAt < MAX_AGE_MS) : [];
  } catch {
    return [];
  }
}

async function writePendingPayments(wallet: string, list: PendingPayment[]): Promise<void> {
  try {
    if (list.length === 0) await AsyncStorage.removeItem(storageKey(wallet));
    else await AsyncStorage.setItem(storageKey(wallet), JSON.stringify(list));
  } catch (err) {
    console.warn('Could not store pending payment:', err);
  }
}

export async function savePendingPayment(wallet: string, payment: PendingPayment): Promise<void> {
  if (!wallet || !payment.signature) return;
  const list = (await getPendingPayments(wallet)).filter((p) => p.signature !== payment.signature);
  await writePendingPayments(wallet, [...list, payment]);
}

export async function removePendingPayment(wallet: string, signature: string): Promise<void> {
  if (!wallet || !signature) return;
  const list = await getPendingPayments(wallet);
  const next = list.filter((p) => p.signature !== signature);
  if (next.length !== list.length) await writePendingPayments(wallet, next);
}

/** Oldest pending payment of this kind, to be re-submitted instead of paying again. */
export async function findPendingPayment(wallet: string, kind: PendingPaymentKind): Promise<PendingPayment | null> {
  const list = await getPendingPayments(wallet);
  return list.find((p) => p.kind === kind) || null;
}
