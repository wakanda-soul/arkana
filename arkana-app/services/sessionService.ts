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

/**
 * The connected wallet's message signer, registered by the auth provider, so an expired or lost
 * session can be renewed without the user having to reconnect.
 */
let sessionSigner: { wallet: string; sign: (message: Uint8Array) => Promise<Uint8Array> } | null = null;

export function setSessionSigner(wallet: string | null, sign?: (message: Uint8Array) => Promise<Uint8Array>) {
  sessionSigner = wallet && sign ? { wallet, sign } : null;
}

/** Signs in again with the connected wallet. Returns false when there is no wallet or the user declines. */
export async function renewWalletSession(): Promise<boolean> {
  if (!sessionSigner) return false;
  const { wallet, sign } = sessionSigner;
  await clearWalletSession();
  try {
    await ensureWalletSession(wallet, sign);
    return true;
  } catch (err: any) {
    console.warn('[Auth] Session renewal declined:', err?.message || err);
    return false;
  }
}

/**
 * fetch() with the session token. When the server answers that the session is missing or expired,
 * the wallet signs in again once and the request is repeated with the new token.
 */
export async function authedFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const withSession = async (): Promise<RequestInit> => ({
    ...init,
    headers: { ...((init.headers as Record<string, string>) || {}), ...(await apiHeaders()) },
  });
  const res = await netFetch(input, await withSession());
  if (res.status !== 401) return res;
  const body = await res.clone().json().catch(() => ({}));
  if (!body?.sessionRequired || !(await renewWalletSession())) return res;
  return netFetch(input, await withSession());
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
