import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { API_BASE_URL } from './oracleApi';
import { netFetch } from './netFetch';

/**
 * Wallet session: the wallet signs a one-time server message (free, not a transaction)
 * and the server returns a token proving the wallet belongs to this user. Requests that
 * spend the wallet's quota send it as `Authorization: Bearer <token>`.
 */
const SESSION_KEY = 'arkana_wallet_session_v1';
/** Renew a few days before the server-side 30-day expiry. */
const RENEW_BEFORE_MS = 3 * 24 * 60 * 60 * 1000;

interface StoredSession {
  wallet: string;
  token: string;
  expiresAt: number;
}

async function readSession(): Promise<StoredSession | null> {
  try {
    const raw = await AsyncStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch {
    return null;
  }
}

export async function hasValidSession(wallet: string): Promise<boolean> {
  const session = await readSession();
  return Boolean(session && session.wallet === wallet && session.expiresAt - RENEW_BEFORE_MS > Date.now());
}

let pendingSignIn: Promise<void> | null = null;

/**
 * Makes sure `wallet` has a server session, asking the wallet to sign a message if needed.
 * Concurrent callers share one wallet prompt.
 */
export async function ensureWalletSession(
  wallet: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<void> {
  if (await hasValidSession(wallet)) return;
  if (pendingSignIn) return pendingSignIn;

  pendingSignIn = (async () => {
    const nonceRes = await netFetch(`${API_BASE_URL}/api/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet }),
    });
    const { message } = await nonceRes.json();
    if (!message) throw new Error('Sign-in is unavailable right now.');

    const signed = await signMessage(new Uint8Array(Buffer.from(message, 'utf-8')));
    const verifyRes = await netFetch(`${API_BASE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, message, signature: Buffer.from(signed).toString('base64') }),
    });
    const data = await verifyRes.json();
    if (!data.success || !data.token) throw new Error(data.error || 'Wallet sign-in failed.');

    const session: StoredSession = { wallet, token: data.token, expiresAt: data.expiresAt };
    await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
  })();

  try {
    await pendingSignIn;
  } finally {
    pendingSignIn = null;
  }
}

export async function clearWalletSession(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SESSION_KEY);
  } catch {}
}

/** JSON headers plus the session token when one is stored. */
export async function apiHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const session = await readSession();
  if (session && session.expiresAt > Date.now()) {
    headers.Authorization = `Bearer ${session.token}`;
  }
  return headers;
}
