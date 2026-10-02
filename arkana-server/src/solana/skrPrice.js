/**
 * Live SKR to SOL rate for the SOL prices shown in the app.
 *
 * The payment itself always swaps at Jupiter's live quote; this rate only feeds the displayed
 * "pay X SOL" amounts, which used a fixed config value before. Refreshed every 5 minutes; when
 * Jupiter is unreachable the last known rate (or the config fallback) stays in place.
 */
const { jupFetch } = require("./jupiter");

const SKR_MINT = "SKRbvo6Gf7GondiT3BbTfuRDPqLWei4j2Qy2NPGZhW3";
const SOL_MINT = "So11111111111111111111111111111111111111112";
const ONE_SKR = 1_000_000; // SKR has 6 decimals
const REFRESH_MS = 5 * 60 * 1000;

let liveRate = null;

async function refreshSkrPrice() {
  try {
    const res = await jupFetch(`/quote?inputMint=${SKR_MINT}&outputMint=${SOL_MINT}&amount=${ONE_SKR}&slippageBps=50`, {
      signal: AbortSignal.timeout(8000),
    });
    const quote = await res.json();
    const rate = Number(quote.outAmount) / 1e9;
    if (rate > 0) liveRate = rate;
  } catch (err) {
    console.warn("[skr-price] quote failed:", err.message);
  }
}

/** SOL per 1 SKR: the live rate when known, else `fallback`. */
function getSkrToSolRate(fallback) {
  return liveRate || fallback;
}

function startSkrPriceRefresher() {
  refreshSkrPrice();
  setInterval(refreshSkrPrice, REFRESH_MS);
}

module.exports = { getSkrToSolRate, startSkrPriceRefresher };
