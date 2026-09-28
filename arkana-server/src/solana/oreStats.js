/**
 * ORE usage numbers for progress reports (admin only).
 *
 * On-chain: the vault config keeps running totals, every user has one UserVault account and every
 * daily deposit is a Tranche account of the Arkana ORE vault program. Off-chain: verified payments
 * recorded by the server. Cached for a minute so the report never hammers the RPC.
 */
const fs = require("fs");
const path = require("path");

// getProgramAccounts costs more than the Alchemy plan allows per second; the public mainnet RPC serves it
const RPC_URL = process.env.STATS_RPC_URL || "https://api.mainnet-beta.solana.com";
const VAULT_PROGRAM = "B49g3obWUCPQzP9kdcRiCPJDurufWhJhszpQsK5eeV8C";
const ORE_DECIMALS = 11;
const USED_PAYMENTS_FILE = path.join(__dirname, "../../data/used_payments.json");
const CACHE_MS = 60_000;

// Steel account discriminators (first byte) and sizes, from programs/arkana-ore-vault/api/src/state.rs
const ACCOUNT = { VaultConfig: 10, UserVault: 11, Tranche: 12 };
const SIZE = { UserVault: 64, Tranche: 112 };

let cache = null;

async function rpc(method, params) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    });
    const data = await res.json();
    if (!data.error) return data.result;
    // getProgramAccounts is heavy; the RPC plan rate-limits bursts
    const limited = res.status === 429 || /compute units|rate/i.test(data.error.message || "");
    if (!limited || attempt >= 4) throw new Error(data.error.message || "RPC error");
    await new Promise((r) => setTimeout(r, 1000 * attempt));
  }
}

/** All accounts of the vault program in one request, grouped by account type. */
async function vaultAccounts() {
  const result = await rpc("getProgramAccounts", [VAULT_PROGRAM, { encoding: "base64" }]);
  const groups = { VaultConfig: [], UserVault: [], Tranche: [] };
  for (const a of result || []) {
    const data = Buffer.from(a.account.data[0], "base64");
    if (data[0] === ACCOUNT.VaultConfig) groups.VaultConfig.push(data);
    else if (data[0] === ACCOUNT.UserVault && data.length === SIZE.UserVault) groups.UserVault.push(data);
    else if (data[0] === ACCOUNT.Tranche && data.length === SIZE.Tranche) groups.Tranche.push(data);
  }
  return groups;
}

const ore = (raw) => Number(raw) / 10 ** ORE_DECIMALS;

async function computeStats() {
  const { VaultConfig: configs, UserVault: userVaults, Tranche: tranches } = await vaultAccounts();

  const config = configs[0];
  const totals = config
    ? {
        stakedOre: ore(config.readBigUInt64LE(96)),
        yieldDistributedOre: ore(config.readBigUInt64LE(104)),
        maturedOre: ore(config.readBigUInt64LE(112)),
        tranchesCreated: Number(config.readBigUInt64LE(120)),
      }
    : null;

  const now = Date.now() / 1000;
  const DAY = 86400;
  let active = 0;
  let matured = 0;
  let deposited7d = 0;
  let deposited30d = 0;
  let depositedAllRaw = 0n;
  let claimedRaw = 0n;
  for (const t of tranches) {
    const isMatured = t[44] === 1;
    const amount = t.readBigUInt64LE(48);
    const depositedAt = Number(t.readBigInt64LE(56));
    depositedAllRaw += amount;
    claimedRaw += t.readBigUInt64LE(104);
    if (isMatured) matured++;
    else active++;
    if (now - depositedAt <= 7 * DAY) deposited7d += ore(amount);
    if (now - depositedAt <= 30 * DAY) deposited30d += ore(amount);
  }

  let payments = [];
  try {
    const used = JSON.parse(fs.readFileSync(USED_PAYMENTS_FILE, "utf-8"));
    payments = Array.isArray(used) ? used.map(([, v]) => v) : Object.values(used);
  } catch {}
  const since = (days) => payments.filter((p) => p.verifiedAt && Date.now() - Date.parse(p.verifiedAt) <= days * DAY * 1000);
  const summarize = (list) => ({
    count: list.length,
    skr: Number(list.reduce((s, p) => s + (Number(p.amountSkr) || 0), 0).toFixed(2)),
    wallets: new Set(list.map((p) => p.wallet)).size,
  });

  return {
    generatedAt: new Date().toISOString(),
    vaultProgram: VAULT_PROGRAM,
    ore: {
      vaultTotals: totals,
      users: userVaults.length,
      tranches: { total: tranches.length, active, matured },
      depositedOre: {
        allTime: ore(depositedAllRaw),
        last7d: Number(deposited7d.toFixed(6)),
        last30d: Number(deposited30d.toFixed(6)),
      },
      yieldClaimedOre: ore(claimedRaw),
    },
    payments: {
      allTime: summarize(payments),
      last7d: summarize(since(7)),
      last30d: summarize(since(30)),
    },
  };
}

async function getOreStats() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.stats;
  const stats = await computeStats();
  cache = { at: Date.now(), stats };
  return stats;
}

module.exports = { getOreStats };
