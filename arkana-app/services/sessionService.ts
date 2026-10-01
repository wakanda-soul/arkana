import AsyncStorage from '@react-native-async-storage/async-storage';
import { Buffer } from 'buffer';
import { API_BASE_URL } from './oracleApi';
import { netFetch } from './netFetch';

/**
 * Wallet session: the wallet signs a one-time server message (free, not a transaction)
 * and the server returns a token proving the wallet belongs to this user. Requests that
 * spend the wallet's quota send it as `Authorization: Bearer <token>`.
 */
/** One session per wallet: switching wallets (e.g. to check a Genesis token) must not sign the other out. */
const SESSIONS_KEY = 'arkana_wallet_sessions_v2';
const LEGACY_SESSION_KEY = 'arkana_wallet_session_v1';
/** Renew a few days before the server-side 30-day expiry. */
const RENEW_BEFORE_MS = 3 * 24 * 60 * 60 * 1000;

interface StoredSession {
  wallet: string;
  token: string;
  expiresAt: number;
}

async function readSessions(): Promise<Record<string, StoredSession>> {
  try {
    const raw = await AsyncStorage.getItem(SESSIONS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, StoredSession>;
    // Sessions stored by 1.1.16 and earlier: a single slot
    const legacy = await AsyncStorage.getItem(LEGACY_SESSION_KEY);
    if (!legacy) return {};
    const session = JSON.parse(legacy) as StoredSession;
    return session?.wallet ? { [session.wallet]: session } : {};
  } catch {
    return {};
  }
}

async function writeSessions(sessions: Record<string, StoredSession>): Promise<void> {
  // Expired sessions are dropped on every write
  const live = Object.fromEntries(Object.entries(sessions).filter(([, v]) => v.expiresAt > Date.now()));
  await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(live));
  await AsyncStorage.removeItem(LEGACY_SESSION_KEY).catch(() => {});
}

async function readSession(wallet: string | null | undefined): Promise<StoredSession | null> {
  if (!wallet) return null;
  return (await readSessions())[wallet] ?? null;
}

export async function hasValidSession(wallet: string): Promise<boolean> {
  const session = await readSession(wallet);
  return Boolean(session && session.wallet === wallet && session.expiresAt - RENEW_BEFORE_MS > Date.now());
}

/** One sign-in per wallet at a time; callers for the same wallet share its wallet prompt. */
const pendingSignIns = new Map<string, Promise<void>>();

/**
 * Makes sure `wallet` has a server session, asking the wallet to sign a message if needed.
 * Concurrent callers share one wallet prompt.
 */
export async function ensureWalletSession(
  wallet: string,
  signMessage: (message: Uint8Array) => Promise<Uint8Array>
): Promise<void> {
  if (await hasValidSession(wallet)) return;
  const inFlight = pendingSignIns.get(wallet);
  if (inFlight) return inFlight;

  const signIn = (async () => {
    const nonceRes = await netFetch(`${API_BASE_URL}/api/auth/nonce`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet }),
    });
    const { message } = await nonceRes.json();
    if (!message) throw new Error('Sign-in is unavailable right now.');
    // Sign only Arkana's own sign-in text for this wallet, never an arbitrary server-provided message
    if (typeof message !== 'string' || !message.startsWith('Arkana sign-in\n') || !message.includes(`Wallet: ${wallet}\n`)) {
      throw new Error('Unexpected sign-in message.');
    }

    const signed = await signMessage(new Uint8Array(Buffer.from(message, 'utf-8')));
    const verifyRes = await netFetch(`${API_BASE_URL}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wallet, message, signature: Buffer.from(signed).toString('base64') }),
    });
    const data = await verifyRes.json();
    if (!data.success || !data.token) throw new Error(data.error || 'Wallet sign-in failed.');

    const session: StoredSession = { wallet, token: data.token, expiresAt: data.expiresAt };
    await writeSessions({ ...(await readSessions()), [wallet]: session });
  })();

  pendingSignIns.set(wallet, signIn);
  try {
    await signIn;
  } finally {
    pendingSignIns.delete(wallet);
  }
}

export interface SiwsPayload {
  domain: string;
  statement: string;
  nonce: string;
  issuedAt: string;
}

/** Sign In With Solana payload for the connect call, fetched before the wallet opens. */
export async function fetchSiwsPayload(): Promise<SiwsPayload> {
  const res = await netFetch(`${API_BASE_URL}/api/auth/nonce`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!data?.siws?.nonce) throw new Error('Sign-in is unavailable right now.');
  // The wallet shows this domain to the user: it must be ours, whatever the server answered
  if (data.siws.domain !== 'arkana.icu') throw new Error('Unexpected sign-in domain.');
  return data.siws as SiwsPayload;
}

/** Turns the message the wallet signed while connecting into a stored session for `wallet`. */
export async function completeSiwsSignIn(wallet: string, signedMessage: Uint8Array, signature: Uint8Array): Promise<void> {
  const res = await netFetch(`${API_BASE_URL}/api/auth/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      wallet,
      message: Buffer.from(signedMessage).toString('utf-8'),
      signature: Buffer.from(signature).toString('base64'),
    }),
  });
  const data = await res.json();
  if (!data.success || !data.token) throw new Error(data.error || 'Wallet sign-in failed.');
  await writeSessions({ ...(await readSessions()), [wallet]: { wallet, token: data.token, expiresAt: data.expiresAt } });
}

/** Forgets the session of `wallet` (the connected one by default). */
export async function clearWalletSession(wallet: string | null = sessionSigner?.wallet ?? null): Promise<void> {
  if (!wallet) return;
  try {
    const sessions = await readSessions();
    delete sessions[wallet];
    await writeSessions(sessions);
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
  await clearWalletSession(wallet);
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
  const session = await readSession(sessionSigner?.wallet);
  if (session && session.expiresAt > Date.now()) {
    headers.Authorization = `Bearer ${session.token}`;
  }
  return headers;
}
