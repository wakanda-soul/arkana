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
const QUOTE_PARAMS = ["inputMint", "outputMint", "amount", "swapMode", "slippageBps", "maxAccounts", "onlyDirectRoutes"];

function jupFetch(path, init = {}) {
  const headers = { ...(init.headers || {}) };
  if (process.env.JUPITER_API_KEY) headers["x-api-key"] = process.env.JUPITER_API_KEY;
  return fetch(`${JUPITER_SWAP_API}${path}`, { ...init, headers, signal: init.signal || AbortSignal.timeout(10000) });
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
