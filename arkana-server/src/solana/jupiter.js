/**
 * Jupiter Swap API client. With JUPITER_API_KEY set (portal.jup.ag) every call carries the key, which
 * lifts the free tier's limit of about 5 requests per ~10 s per IP. The key stays on the server: the
 * app reaches Jupiter through the proxy routes in index.js and still checks every instruction it
 * gets back before signing.
 */
const JUPITER_SWAP_API = "https://api.jup.ag/swap/v1";

// The only tokens Arkana swaps; the proxy refuses anything else so the key cannot be used for other swaps
const ALLOWED_MINTS = new Set([
  "So11111111111111111111111111111111111111112", // wrapped SOL
  "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3", // SKR
  "oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp", // ORE
]);
const QUOTE_PARAMS = ["inputMint", "outputMint", "amount", "swapMode", "slippageBps", "maxAccounts", "onlyDirectRoutes", "restrictIntermediateTokens"];

const JUPITER_ROOT = "https://api.jup.ag";
const MAX_RATE_WAIT_MS = 6000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * One Jupiter request. Limits are per organisation in a sliding window (Free key: 1 RPS, about 10
 * per 10 s), so on a 429 this waits until the gateway says a slot frees (x-ratelimit-reset, Unix
 * seconds) plus jitter, and tries again, up to twice, instead of passing the 429 to the phone.
 * `path` is under /swap/v1 unless it starts with "/price" or another full API path.
 */
async function jupFetch(path, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (process.env.JUPITER_API_KEY) headers["x-api-key"] = process.env.JUPITER_API_KEY;
  const url = path.startsWith("/price/") ? `${JUPITER_ROOT}${path}` : `${JUPITER_SWAP_API}${path}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, headers, signal: init.signal || AbortSignal.timeout(10000) });
    if (res.status !== 429 || attempt >= 2) {
      if (res.status === 429) {
        console.warn(`[jupiter] 429 after retries, request ${res.headers.get("x-api-gateway-request-id") || "?"}`);
      }
      return res;
    }
    const reset = Number(res.headers.get("x-ratelimit-reset"));
    const untilReset = reset > 0 ? reset * 1000 - Date.now() : 1000;
    await sleep(Math.min(MAX_RATE_WAIT_MS, Math.max(250, untilReset)) + Math.floor(Math.random() * 250));
  }
}

/** Query string for a quote from client params, or null when it is not an Arkana swap. */
function quoteQuery(params) {
  if (!ALLOWED_MINTS.has(params.inputMint) || !ALLOWED_MINTS.has(params.outputMint)) return null;
  if (!/^\d{1,20}$/.test(String(params.amount || ""))) return null;
  const query = new URLSearchParams();
  for (const key of QUOTE_PARAMS) {
    if (params[key] !== undefined) query.set(key, String(params[key]).slice(0, 64));
  }
  return query.toString();
}

function isArkanaQuote(quote) {
  return Boolean(quote && ALLOWED_MINTS.has(quote.inputMint) && ALLOWED_MINTS.has(quote.outputMint));
}

console.log(`[jupiter] API key ${process.env.JUPITER_API_KEY ? "set" : "not set (free tier limits)"}`);

module.exports = { jupFetch, quoteQuery, isArkanaQuote };
