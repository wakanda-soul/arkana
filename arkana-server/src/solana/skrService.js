/**
 * SKR Token & In-App Economy Manager
 * Implements sustainable daily retention, tiered streak bonuses, and fee mechanics:
 * - 3 free spreads per day for Seeker Genesis holders, +5 with the Oracle Pass
 * - Additional spreads cost 5 SKR
 * - Daily Clock-In refills spread allowance and tracks streaks (zero token payouts)
 */

const { getSkrToSolRate } = require("./skrPrice");
const fs = require("fs");
const path = require("path");
const { readJson, writeJsonAtomic } = require("../storage/jsonStore");

const DB_PATH = path.join(__dirname, "..", "..", "data");
const USERS_FILE = path.join(DB_PATH, "users.json");
const CONFIG_FILE = path.join(DB_PATH, "economy_config.json");

if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
}

function loadEconomyConfig() {
  const defaults = {
    streakRepairCostSkr: 1,
    extraSpreadCostSkr: 5,
    askCostSkr: 1,
    skrToSolRate: 0.0002,
    freeDailyAllowanceBase: 3,
    streakTier2Threshold: 3,
    streakTier3Threshold: 7
  };
  if (!fs.existsSync(CONFIG_FILE)) {
    try {
      writeJsonAtomic(CONFIG_FILE, defaults);
    } catch {}
    return defaults;
  }
  // A corrupt config falls back to defaults for reads; updateEconomyConfig refuses to overwrite it
  try {
    return { ...defaults, ...readJson(CONFIG_FILE) };
  } catch {
    return defaults;
  }
}

// Admin-editable numbers and their allowed ranges. Anything else (the treasury attestation included)
// is changed only by editing the file on the server.
const EDITABLE_CONFIG = {
  streakRepairCostSkr: [0.01, 1000],
  extraSpreadCostSkr: [0.01, 1000],
  askCostSkr: [0.01, 1000],
  subscriptionCostSkr: [1, 100000],
  skrToSolRate: [1e-9, 1],
  freeDailyAllowanceBase: [0, 100],
  streakTier2Threshold: [1, 365],
  streakTier3Threshold: [1, 365],
};

function updateEconomyConfig(newSettings) {
  readJson(CONFIG_FILE);
  if (!newSettings || typeof newSettings !== "object" || Array.isArray(newSettings)) throw new Error("Settings must be an object.");
  const changes = {};
  for (const [key, value] of Object.entries(newSettings)) {
    const range = Object.hasOwn(EDITABLE_CONFIG, key) ? EDITABLE_CONFIG[key] : null;
    if (!range) throw new Error(`Setting "${key}" cannot be changed here.`);
    if (typeof value !== "number" || !Number.isFinite(value) || value < range[0] || value > range[1]) {
      throw new Error(`Setting "${key}" must be a number between ${range[0]} and ${range[1]}.`);
    }
    changes[key] = value;
  }
  const current = loadEconomyConfig();
  const updated = { ...current, ...changes };
  writeJsonAtomic(CONFIG_FILE, updated);
  return updated;
}

// Throws on a corrupt users.json instead of returning {}, which the next save would write back
function loadUsers() {
  return readJson(USERS_FILE);
}

function saveUsers(users) {
  writeJsonAtomic(USERS_FILE, users);
}

/** Seeker Genesis holders get 3 free spreads per day. Streaks give banked bonus spreads instead (see getStreakMilestoneReward). */
/** Whole UTC calendar days between two moments (same UTC date = 0, yesterday = 1). */
function utcDaysBetween(earlier, later) {
  const day = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((day(later) - day(earlier)) / 86400000);
}

function getDailyFreeAllowance() {
  return 3;
}

function checkSeekerStatus(user, walletAddress, clientHint) {
  // The client hint is ignored: Seeker status is only set by /api/seeker/status after
  // the server verified the Seeker Genesis Token on-chain.
  if (user && user.isSeekerHolder !== undefined) {
    return Boolean(user.isSeekerHolder);
  }
  return false;
}

// Seeker Genesis Token is soulbound (it only moves together with the Seeker ID), so a verified
// "holder" stays valid for a week; "not a holder" is rechecked soon so a new owner gets free spreads.
const SEEKER_HOLDER_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const SEEKER_NON_HOLDER_TTL_MS = 10 * 60 * 1000;

/**
 * Seeker status with a stored, dated on-chain result. Calls checkOnChain(wallet) only when the stored
 * answer is stale; checkOnChain returns true / false, or null when the RPC failed, in which case the
 * stored answer is kept.
 */
async function refreshSeekerHolderStatus(walletAddress, checkOnChain) {
  if (!walletAddress) return false;
  const stored = loadUsers()[walletAddress] || {};
  const checkedAt = stored.seekerCheckedAt ? Date.parse(stored.seekerCheckedAt) : 0;
  const ttl = stored.isSeekerHolder ? SEEKER_HOLDER_TTL_MS : SEEKER_NON_HOLDER_TTL_MS;
  if (stored.isSeekerHolder !== undefined && Date.now() - checkedAt < ttl) {
    return Boolean(stored.isSeekerHolder);
  }

  const onChain = await checkOnChain(walletAddress);
  if (onChain === null || onChain === undefined) return Boolean(stored.isSeekerHolder);

  const users = loadUsers();
  // Unknown wallets that are not holders are not stored: anyone could grow users.json with random keys
  if (!users[walletAddress] && !onChain) return false;
  const user = users[walletAddress] || { streak: 0 };
  user.isSeekerHolder = Boolean(onChain);
  user.seekerCheckedAt = new Date().toISOString();
  users[walletAddress] = user;
  saveUsers(users);
  return user.isSeekerHolder;
}

function isUserSubscribed(user) {
  if (!user || !user.subscription || !user.subscription.active) return false;
  if (!user.subscription.expiresAt) return false;
  return new Date(user.subscription.expiresAt).getTime() > Date.now();
}

function getStreakMilestoneReward(streak = 0) {
  if (!streak || streak <= 0) return 0;
  if (streak === 7) return 1;
  if (streak === 14) return 2;
  if (streak === 21) return 3;
  // Day 28 and every 7 days thereafter (35, 42, 49, 56...) awards +5 bonus spreads
  if (streak >= 28 && streak % 7 === 0) return 5;
  return 0;
}

/**
 * Check wallet Clock-In, spread quota, and streak repair status.
 * Notice: Free daily spreads:
 * - Seeker Genesis SBT: 3 base
 * - Seeker Oracle Pass (Subscription 333 SKR/mo): +5 spreads/day (total up to 8-10/day)
 * - Streak Milestone Bonus Spreads: Stored on user account, never expire daily
 * - Other wallets: 0 base (require SKR/SOL or Subscription)
 */
function getClockInStatus(walletAddress, clientHint = undefined) {
  const config = loadEconomyConfig();
  const repairCost = config.streakRepairCostSkr || 1;
  const askCost = config.askCostSkr || 1;
  const extraSpreadCost = config.extraSpreadCostSkr || 5;
  const skrToSolRate = getSkrToSolRate(config.skrToSolRate || 0.0002);
  const subscriptionCostSkr = config.subscriptionCostSkr || 333;

  if (!walletAddress) {
    return {
      canClockIn: true,
      streak: 0,
      brokenStreak: null,
      canRepairStreak: false,
      repairStreakTarget: 1,
      streakRepairCostSkr: repairCost,
      lastClockIn: null,
      freeSpreadsRemaining: 0,
      freeSpreadsMax: 0,
      streakBonusSpreads: 0,
      extraSpreadCostSkr: extraSpreadCost,
      askCostSkr: askCost,
      skrToSolRate,
      askCostSol: Number((askCost * skrToSolRate).toFixed(6)),
      extraSpreadCostSol: Number((extraSpreadCost * skrToSolRate).toFixed(6)),
      subscriptionCostSkr,
      isSubscribed: false,
      subscription: null,
      skrBalance: 0,
      isSeekerHolder: false,
      totalOfferedSkr: 0
    };
  }

  const users = loadUsers();
  const user = users[walletAddress] || { streak: 0 };
  const isSeekerHolder = checkSeekerStatus(user, walletAddress, clientHint);
  const isSubscribed = isUserSubscribed(user);
  const now = new Date();
  const todayKey = now.toISOString().split("T")[0];

  const lastDate = user.lastClockIn ? new Date(user.lastClockIn) : null;
  let canClockIn = true;
  let canRepairStreak = false;
  let currentStreak = user.streak || 0;

  if (lastDate) {
    // Days follow the UTC calendar: a new Daily Consensus opens at 00:00 UTC
    const daysSince = utcDaysBetween(lastDate, now);
    canClockIn = daysSince >= 1;
    if (daysSince < 2 && user.brokenStreak) {
      // The streak is alive: a leftover broken value must not offer a paid repair
      user.brokenStreak = null;
      users[walletAddress] = user;
      saveUsers(users);
    }
    if (daysSince >= 2) {
      if (user.streak > 0) {
        user.brokenStreak = user.streak;
        user.previousStreak = user.streak;
        user.streak = 0;
        users[walletAddress] = user;
        saveUsers(users);
      }
      canRepairStreak = true;
      currentStreak = 0;
    }
  }

  const repairStreakTarget = user.brokenStreak || user.previousStreak || (currentStreak > 0 ? currentStreak : 1);

  // Daily free quota calculation:
  // Seeker Genesis holders get 3 base.
  // Active subscribers get an additional +5 spreads/day (Total 5 to 8-10 spreads/day!)
  const lastSpreadDate = user.lastSpreadDate || "";
  const dailySpreadsUsed = (lastSpreadDate === todayKey) ? (user.dailySpreadsUsed || 0) : 0;
  const seekerBase = isSeekerHolder ? getDailyFreeAllowance(currentStreak) : 0;
  const subscriptionBonus = isSubscribed ? 5 : 0;
  const maxFree = seekerBase + subscriptionBonus;
  const remainingFree = Math.max(0, maxFree - dailySpreadsUsed);
  const todayCard = (!canClockIn && user.history && user.history[0]) ? user.history[0] : null;

  return {
    canClockIn,
    streak: currentStreak,
    brokenStreak: canRepairStreak ? user.brokenStreak || null : null,
    canRepairStreak: canRepairStreak && user.brokenStreak > 0,
    repairStreakTarget,
    streakRepairCostSkr: repairCost,
    lastClockIn: user.lastClockIn,
    todayCard,
    totalReadings: user.totalReadings || 0,
    skrBalance: 0,
    freeSpreadsRemaining: remainingFree,
    freeSpreadsMax: maxFree,
    streakBonusSpreads: user.streakBonusSpreads || 0,
    extraSpreadCostSkr: extraSpreadCost,
    askCostSkr: askCost,
    skrToSolRate,
    askCostSol: Number((askCost * skrToSolRate).toFixed(6)),
    extraSpreadCostSol: Number((extraSpreadCost * skrToSolRate).toFixed(6)),
    subscriptionCostSkr,
    isSubscribed,
    subscription: user.subscription || null,
    isSeekerHolder,
    totalOfferedSkr: user.totalOfferedSkr || 0
  };
}

/**
 * Record Daily Clock-In:
 * - Refills daily spread allowance and updates on-chain streak
 * - Awards milestone bonus spreads on Day 7 (+1), 14 (+2), 21 (+3), 28 (+5)
 * - Zero token emission
 */
function recordClockIn(walletAddress, drawnCard, txSignature = null, slot = null) {
  const users = loadUsers();
  const now = new Date();
  const user = users[walletAddress] || { streak: 0, history: [], totalReadings: 0 };

  // A Clock-In memo signature counts once
  if (txSignature && (user.history || []).some((h) => h.txSignature === txSignature)) {
    return { success: false, alreadyClockedIn: true, streak: user.streak || 0, error: "This Clock-In transaction was already used." };
  }

  const lastDate = user.lastClockIn ? new Date(user.lastClockIn) : null;
  if (lastDate) {
    const daysSince = utcDaysBetween(lastDate, now);
    // One Clock-In per UTC day: otherwise the streak (and its bonus spreads) could be farmed
    if (daysSince < 1) {
      return { success: false, alreadyClockedIn: true, streak: user.streak || 0, error: "Already clocked in today." };
    }
    // Yesterday (UTC) continues the streak; a missed UTC day breaks it
    if (daysSince === 1) {
      user.streak = (user.streak || 0) + 1;
    } else {
      user.streak = 1;
      user.claimedStreakMilestones = [];
    }
  } else {
    user.streak = 1;
    user.claimedStreakMilestones = [];
  }

  user.lastClockIn = now.toISOString();
  user.totalReadings = (user.totalReadings || 0) + 1;
  // Starting a new streak ends the chance to repair the old one
  user.brokenStreak = null;

  // Streak milestone bonus spreads (Day 7: +1, Day 14: +2, Day 21: +3, Day 28: +5)
  user.claimedStreakMilestones = user.claimedStreakMilestones || [];
  const milestoneBonus = getStreakMilestoneReward(user.streak);
  let streakBonusAwarded = 0;
  if (milestoneBonus > 0 && !user.claimedStreakMilestones.includes(user.streak)) {
    streakBonusAwarded = milestoneBonus;
    user.streakBonusSpreads = (user.streakBonusSpreads || 0) + streakBonusAwarded;
    user.claimedStreakMilestones.push(user.streak);
  }

  // Zero emission mode: no token payouts on check-in
  const rewardSkr = 0;

  user.history = user.history || [];
  user.history.unshift({
    timestamp: now.toISOString(),
    type: "daily-block",
    card: drawnCard.crypto_name,
    card_no: drawnCard.card_no,
    orientation: drawnCard.orientation,
    image: drawnCard.image,
    txSignature: txSignature || null,
    slot: slot || null
  });

  if (user.history.length > 30) user.history.pop();

  users[walletAddress] = user;
  saveUsers(users);

  const isSeekerHolder = checkSeekerStatus(user, walletAddress);
  const maxFree = isSeekerHolder ? getDailyFreeAllowance(user.streak) : 0;
  const todayKey = now.toISOString().split("T")[0];
  const lastSpreadDate = user.lastSpreadDate || "";
  const dailySpreadsUsed = (lastSpreadDate === todayKey) ? (user.dailySpreadsUsed || 0) : 0;
  const remainingFree = Math.max(0, maxFree - dailySpreadsUsed);

  return {
    success: true,
    streak: user.streak,
    lastClockIn: user.lastClockIn,
    rewardSkr,
    freeSpreadsRemaining: remainingFree,
    freeSpreadsMax: maxFree,
    streakBonusAwarded,
    streakBonusSpreads: user.streakBonusSpreads || 0,
    txSignature,
    slot,
    skrBalance: 0,
    isSeekerHolder
  };
}

/**
 * Consume a spread or ask quota:
 * - Free if within daily allowance (shared between spreads & ask), then banked streak spreads
 * - Costs 1 SKR for chat or 5 SKR for spreads once daily allowance is exhausted
 * - Otherwise only with a payment verified on-chain by paymentVerifier
 */
function consumeSpread(walletAddress, options = {}) {
  const config = loadEconomyConfig();
  const itemType = options.type || "spread";
  const costSkr = options.cost !== undefined ? options.cost : (itemType === "chat" ? (config.askCostSkr || 1) : (config.extraSpreadCostSkr || 5));
  const skrToSolRate = getSkrToSolRate(config.skrToSolRate || 0.0002);
  const costSol = Number((costSkr * skrToSolRate).toFixed(6));
  const payWithSol = Boolean(options.payWithSol);
  const txSignature = options.txSignature || null;

  if (!walletAddress) {
    return {
      allowed: false,
      isFree: false,
      cost: costSkr,
      costSkr,
      costSol,
      isSeekerHolder: false,
      remainingFree: 0,
      balance: 0,
      reason: "Connect your wallet to consult the oracle."
    };
  }

  const users = loadUsers();
  const user = users[walletAddress] || { streak: 0 };
  const clientHint = options.isSeeker !== undefined ? Boolean(options.isSeeker) : undefined;
  const isSeekerHolder = checkSeekerStatus(user, walletAddress, clientHint);
  const now = new Date();
  const todayKey = now.toISOString().split("T")[0];

  const lastSpreadDate = user.lastSpreadDate || "";
  let dailySpreadsUsed = (lastSpreadDate === todayKey) ? (user.dailySpreadsUsed || 0) : 0;
  const isSubscribed = isUserSubscribed(user);
  const seekerBase = isSeekerHolder ? getDailyFreeAllowance(user.streak || 0) : 0;
  const subscriptionBonus = isSubscribed ? 5 : 0;
  const maxFree = seekerBase + subscriptionBonus;

  if (maxFree > 0 && dailySpreadsUsed < maxFree) {
    // 1. Within free daily allowance (Seeker Genesis SBT or Active Subscription)
    dailySpreadsUsed += 1;
    user.dailySpreadsUsed = dailySpreadsUsed;
    user.lastSpreadDate = todayKey;
    user.totalReadings = (user.totalReadings || 0) + 1;
    users[walletAddress] = user;
    saveUsers(users);

    return {
      allowed: true,
      isFree: true,
      cost: 0,
      costSkr: 0,
      costSol: 0,
      paidWith: "free",
      remainingFree: maxFree - dailySpreadsUsed,
      streakBonusSpreads: user.streakBonusSpreads || 0,
      balance: 0,
      isSeekerHolder,
      isSubscribed
    };
  }

  // 2. Streak Milestone Bonus Spreads (Stored on account, consumed only after daily quota is used)
  const streakBonus = user.streakBonusSpreads || 0;
  // Banked streak bonus spreads cover questions too, like the daily Seeker allowance they back up
  if ((itemType === "spread" || itemType === "chat") && streakBonus > 0) {
    user.streakBonusSpreads = streakBonus - 1;
    user.totalReadings = (user.totalReadings || 0) + 1;
    users[walletAddress] = user;
    saveUsers(users);

    return {
      allowed: true,
      isFree: true,
      cost: 0,
      costSkr: 0,
      costSol: 0,
      paidWith: "streak_reward",
      remainingFree: 0,
      streakBonusSpreads: user.streakBonusSpreads,
      balance: 0,
      isSeekerHolder,
      isSubscribed
    };
  }

  // 3. Beyond free & streak quota: only a payment the server verified on-chain (see paymentVerifier)
  if (options.paymentVerified && txSignature) {
    dailySpreadsUsed += 1;
    user.dailySpreadsUsed = dailySpreadsUsed;
    user.lastSpreadDate = todayKey;
    user.totalReadings = (user.totalReadings || 0) + 1;
    user.txHistory = user.txHistory || [];
    user.txHistory.push({
      timestamp: now.toISOString(),
      paidWith: payWithSol ? "sol" : "skr",
      costSkr,
      costSol,
      itemType,
      txSignature
    });
    users[walletAddress] = user;
    saveUsers(users);

    return {
      allowed: true,
      isFree: false,
      paidWith: payWithSol ? "sol" : "skr",
      cost: payWithSol ? costSol : costSkr,
      costSkr,
      costSol,
      remainingFree: 0,
      balance: 0,
      txSignature
    };
  }

  // Insufficient payment or quota exhausted
  return {
    allowed: false,
    isFree: false,
    cost: costSkr,
    costSkr,
    costSol,
    remainingFree: 0,
    balance: 0,
    canPayWithSol: true,
    isSeekerHolder,
    isSubscribed,
    error: isSeekerHolder || isSubscribed
      ? `Daily free allowance reached (${maxFree}/${maxFree}). ${costSkr} SKR or ${costSol} SOL required.`
      : `Free daily readings require Seeker Genesis SBT or Seeker Oracle Pass. ${costSkr} SKR or ${costSol} SOL required.`
  };
}

/**
 * Repair or preserve user streak using SKR
 * Default cost is 1 SKR (configurable dynamically via loadEconomyConfig)
 */
/** Called only after verifyPayment() confirmed the STREAK_REPAIR payment on-chain. */
function repairStreak(walletAddress, txSignature) {
  if (!walletAddress) {
    return { success: false, error: "Wallet address is required." };
  }

  const config = loadEconomyConfig();
  const cost = config.streakRepairCostSkr !== undefined ? config.streakRepairCostSkr : 1;
  const users = loadUsers();
  const user = users[walletAddress] || { streak: 0 };

  // Only a streak that was actually broken can be restored
  if (!user.brokenStreak || user.brokenStreak <= 0) {
    return { success: false, error: "There is no broken streak to repair." };
  }

  user.streak = user.brokenStreak;
  user.brokenStreak = null;
  // Count the repair as yesterday's Clock-In, so today's Clock-In continues the restored streak
  const now = new Date();
  user.lastClockIn = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - 1000).toISOString();
  user.repairTx = txSignature;

  users[walletAddress] = user;
  saveUsers(users);

  return {
    success: true,
    streak: user.streak,
    skrBalance: 0,
    cost
  };
}

/**
 * Record an Altar Offering (33% burn + 33% treasury + 34% ORE tranche).
 * Called only after verifyPayment() confirmed the ALTAR_OFFERING payment on-chain.
 */
function recordOffering(walletAddress, { txSignature, amountSkr, message = "Altar Offering" }) {
  if (!walletAddress) {
    return { success: false, error: "Wallet is required." };
  }
  const users = loadUsers();
  const user = users[walletAddress] || { streak: 0 };
  const amount = Number(amountSkr) || 5;

  user.offerings = user.offerings || [];
  user.offerings.unshift({
    timestamp: new Date().toISOString(),
    amountSkr: amount,
    treasurySkr: Number((amount * 0.33).toFixed(2)),
    burnedSkr: Number((amount * 0.33).toFixed(2)),
    oreShareSkr: Number((amount * 0.34).toFixed(2)),
    txSignature,
    message: String(message || "").slice(0, 140)
  });

  user.totalOfferedSkr = Number(((user.totalOfferedSkr || 0) + amount).toFixed(2));
  users[walletAddress] = user;
  saveUsers(users);

  return {
    success: true,
    totalOfferedSkr: user.totalOfferedSkr,
    lastOffering: user.offerings[0]
  };
}

/**
 * Activate Seeker Oracle Pass (Subscription): 333 SKR / 30 days (+5 spreads/day)
 */
/** Called only after verifyPayment() confirmed the 333 SKR payment on-chain. */
function recordSubscription(walletAddress, { txSignature, durationDays = 30 }) {
  if (!walletAddress) {
    return { success: false, error: "Wallet is required." };
  }
  const users = loadUsers();
  const user = users[walletAddress] || { streak: 0 };
  const now = new Date();
  const currentExpiry = user.subscription && user.subscription.expiresAt ? new Date(user.subscription.expiresAt) : now;
  const startFrom = currentExpiry > now ? currentExpiry : now;
  const newExpiry = new Date(startFrom.getTime() + durationDays * 24 * 60 * 60 * 1000);

  user.subscription = {
    active: true,
    activatedAt: now.toISOString(),
    expiresAt: newExpiry.toISOString(),
    costSkr: 333,
    txSignature
  };

  users[walletAddress] = user;
  saveUsers(users);

  return {
    success: true,
    subscription: user.subscription
  };
}

/** True when `signature` already backs one of the wallet's recorded Clock-Ins. */
function isClockInSignatureUsed(walletAddress, signature) {
  const user = loadUsers()[walletAddress];
  return Boolean(user && (user.history || []).some((h) => h.txSignature === signature));
}

module.exports = {
  getClockInStatus,
  isClockInSignatureUsed,
  refreshSeekerHolderStatus,
  recordClockIn,
  consumeSpread,
  repairStreak,
  recordOffering,
  recordSubscription,
  loadEconomyConfig,
  updateEconomyConfig
};

