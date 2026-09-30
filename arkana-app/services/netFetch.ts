import { AppState } from 'react-native';

/**
 * fetch() that survives the moment the app comes back from the wallet.
 *
 * The wallet answers while it is still on screen, and Android does not resolve hostnames for an app
 * in the background ("Unable to resolve host"). The request made right after signing then fails before
 * it leaves the phone. On a network error we wait until Arkana is in the foreground again and retry.
 */
const MAX_ATTEMPTS = 5;
const FOREGROUND_WAIT_MS = 20_000;

function isNetworkError(err: any): boolean {
  return err instanceof TypeError || /network|fetch failed|resolve host|UnknownHost|timed? ?out|ECONN/i.test(String(err?.message || err));
}

function waitForForeground(): Promise<void> {
  if (AppState.currentState === 'active') return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      sub.remove();
      resolve();
    };
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') done();
    });
    const timer = setTimeout(done, FOREGROUND_WAIT_MS);
  });
}

/** One fetch attempt, aborted after `timeoutMs` when given. */
async function fetchOnce(input: string, init: RequestInit | undefined, timeoutMs?: number): Promise<Response> {
  if (!timeoutMs) return fetch(input, init);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (controller.signal.aborted) throw new Error('Request timed out');
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function netFetch(input: string, init?: RequestInit, options?: { timeoutMs?: number }): Promise<Response> {
  let lastErr: any;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchOnce(input, init, options?.timeoutMs);
    } catch (err: any) {
      // A request that timed out is not retried: the caller decides what to do next
      if (err?.message === 'Request timed out') throw err;
      lastErr = err;
      if (!isNetworkError(err) || attempt === MAX_ATTEMPTS) break;
      await waitForForeground();
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  throw lastErr;
}
