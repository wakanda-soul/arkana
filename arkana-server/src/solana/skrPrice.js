/**
 * Live SKR and ORE prices in SOL for the prices shown in the app ("~0.05 SOL", the claim-fee
 * warning). Display only: a payment always swaps at a fresh Jupiter route.
 *
 * One Jupiter Price API v3 call per refresh covers SOL, SKR and ORE (USD prices, divided by SOL's),
 * every 5 minutes; a quote is the fallback for SKR. When Jupiter is unreachable the last known rates
 * (or the config fallback) stay in place.
 */
const { jupFetch } = require("./jupiter");

const SOL_MINT = "So11111111111111111111111111111111111111112";
const SKR_MINT = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";
const ORE_MINT = "oreoU2P8bN6jkk3jbaiVxYnG1dCXcYxwhwyK9jSybcp";
const ONE_SKR = 1_000_000; // SKR has 6 decimals
const REFRESH_MS = 5 * 60 * 1000;

let skrRate = null; // SOL per 1 SKR
let oreRate = null; // SOL per 1 ORE

async function refreshFromPriceApi() {
  const res = await jupFetch(`/price/v3?ids=${SOL_MINT},${SKR_MINT},${ORE_MINT}`, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`price API ${res.status}`);
  const prices = await res.json();
  const sol = Number(prices[SOL_MINT]?.usdPrice);
  if (!(sol > 0)) throw new Error("no SOL price");
  const skr = Number(prices[SKR_MINT]?.usdPrice);
  const ore = Number(prices[ORE_MINT]?.usdPrice);
  if (skr > 0) skrRate = skr / sol;
  if (ore > 0) oreRate = ore / sol;
  return skr > 0;
}

async function refreshSkrFromQuote() {
  const res = await jupFetch(`/quote?inputMint=${SKR_MINT}&outputMint=${SOL_MINT}&amount=${ONE_SKR}&slippageBps=50`, {
    signal: AbortSignal.timeout(8000),
  });
  const rate = Number((await res.json()).outAmount) / 1e9;
  if (rate > 0) skrRate = rate;
}

async function refreshSkrPrice() {
  try {
    if (await refreshFromPriceApi()) return;
  } catch (err) {
    console.warn("[skr-price] price API failed:", err.message);
  }
  try {
    await refreshSkrFromQuote();
  } catch (err) {
    console.warn("[skr-price] quote failed:", err.message);
  }
}

/** SOL per 1 SKR: the live rate when known, else `fallback`. */
function getSkrToSolRate(fallback) {
  return skrRate || fallback;
}

/** SOL per 1 ORE, or null while unknown. */
function getOreToSolRate() {
  return oreRate;
}

function startSkrPriceRefresher() {
  refreshSkrPrice();
  setInterval(refreshSkrPrice, REFRESH_MS);
}

module.exports = { getSkrToSolRate, getOreToSolRate, startSkrPriceRefresher };
