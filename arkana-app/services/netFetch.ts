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

export async function netFetch(input: string, init?: RequestInit): Promise<Response> {
  let lastErr: any;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetch(input, init);
    } catch (err) {
      lastErr = err;
      if (!isNetworkError(err) || attempt === MAX_ATTEMPTS) break;
      await waitForForeground();
      await new Promise((r) => setTimeout(r, 600 * attempt));
    }
  }
  throw lastErr;
}
