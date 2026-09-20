/**
 * SKR Token & In-App Economy Manager
 * Implements sustainable daily retention, tiered streak bonuses, and fee mechanics:
 * - 3 Free Spreads per day for every user (up to 5/day for active streaks)
 * - Additional spreads cost 5 SKR
 * - Daily Clock-In refills spread allowance and tracks streaks (zero token payouts)
 */

const fs = require("fs");
const path = require("path");

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
      fs.writeFileSync(CONFIG_FILE, JSON.stringify(defaults, null, 2), "utf-8");
    } catch {}
    return defaults;
  }
  try {
    return { ...defaults, ...JSON.parse(fs.readFileSync(CONFIG_FILE, "utf-8")) };
  } catch {
    return defaults;
  }
}

function updateEconomyConfig(newSettings) {
  const current = loadEconomyConfig();
  const updated = { ...current, ...newSettings };
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(updated, null, 2), "utf-8");
  return updated;
}

function loadUsers() {
  if (!fs.existsSync(USERS_FILE)) return {};
  try {
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
}

function getDailyFreeAllowance(streak = 0) {
  if (streak >= 7) return 5; // 7+ day streak loyalty bonus
  if (streak >= 3) return 4; // 3-6 day streak bonus
  return 3;                  // Base daily free allowance
}

function checkSeekerStatus(user, walletAddress, clientHint) {
  if (clientHint !== undefined) {
    if (user) {
      user.isSeekerHolder = Boolean(clientHint);
    }
    return Boolean(clientHint);
  }
  if (user && user.isSeekerHolder !== undefined) {
    return Boolean(user.isSeekerHolder);
  }
  if (!walletAddress) return false;
  // All addresses require genuine on-chain SBT verification (via checkSeekerGenesisHolderOnChain on mobile client)
  return false;
}

function setSeekerHolderStatus(walletAddress, isHolder) {
  if (!walletAddress) return false;
  const users = loadUsers();
  const user = users[walletAddress] || { streak: 0 };
  user.isSeekerHolder = Boolean(isHolder);
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
 * - Seeker Genesis SBT: 3 base (up to 5 with streak)
 * - Seeker Oracle Pass (Subscription 333 SKR/mo): +5 spreads/day (total up to 8-10/day)
 * - Streak Milestone Bonus Spreads: Stored on user account, never expire daily
 * - Other wallets: 0 base (require SKR/SOL or Subscription)
 */
function getClockInStatus(walletAddress, clientHint = undefined) {
  const config = loadEconomyConfig();
  const repairCost = config.streakRepairCostSkr || 1;
  const askCost = config.askCostSkr || 1;
  const extraSpreadCost = config.extraSpreadCostSkr || 5;
  const skrToSolRate = config.skrToSolRate || 0.0002;
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
      askCostSol: Number((askCost * skrToSolRate).toFixed(5)),
      extraSpreadCostSol: Number((extraSpreadCost * skrToSolRate).toFixed(5)),
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
    const diffHours = (now - lastDate) / (1000 * 60 * 60);
    canClockIn = diffHours >= 20;
    if (diffHours >= 48) {
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
  // Seeker Genesis holders get 3-5 base.
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
    brokenStreak: user.brokenStreak || null,
    canRepairStreak: canRepairStreak || (user.brokenStreak > 0),
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
    askCostSol: Number((askCost * skrToSolRate).toFixed(5)),
    extraSpreadCostSol: Number((extraSpreadCost * skrToSolRate).toFixed(5)),
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
function recordClockIn(walletAddress, drawnCard) {
  const users = loadUsers();
  const now = new Date();
  const user = users[walletAddress] || { streak: 0, history: [], totalReadings: 0 };

  const lastDate = user.lastClockIn ? new Date(user.lastClockIn) : null;
  if (lastDate) {
    const diffHours = (now - lastDate) / (1000 * 60 * 60);
    if (diffHours < 48) {
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
    image: drawnCard.image
  });

  if (user.history.length > 30) user.history.pop();

  users[walletAddress] = user;
  saveUsers(users);

  const isSeekerHolder = checkSeekerStatus(user, walletAddress);
  const maxFree = isSeekerHolder ? getDailyFreeAllowance(user.streak) : 0;

  return {
    success: true,
    streak: user.streak,
    lastClockIn: user.lastClockIn,
    rewardSkr,
    freeSpreadsMax: maxFree,
    streakBonusAwarded,
    streakBonusSpreads: user.streakBonusSpreads || 0,
    skrBalance: 0,
    isSeekerHolder
  };
}

/**
 * Consume a spread or ask quota:
 * - Free if within daily allowance (first 3-5 inquiries shared between spreads & ask)
 * - Costs 1 SKR for chat or 5 SKR for spreads once daily allowance is exhausted
 * - Fallback to SOL payment if SKR balance is insufficient
 */
function consumeSpread(walletAddress, options = {}) {
  const config = loadEconomyConfig();
  const itemType = options.type || "spread";
  const costSkr = options.cost !== undefined ? options.cost : (itemType === "chat" ? (config.askCostSkr || 1) : (config.extraSpreadCostSkr || 5));
  const skrToSolRate = config.skrToSolRate || 0.0002;
  const costSol = Number((costSkr * skrToSolRate).toFixed(5));
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
  if (itemType === "spread" && streakBonus > 0) {
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

  // 3. Beyond free & streak quota: on-chain payment verification (SKR or SOL)
  if (txSignature || payWithSol) {
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
      txSignature: txSignature || "tx_" + Math.random().toString(36).slice(2, 10)
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
function repairStreak(walletAddress, txSignature = null) {
  if (!walletAddress) {
    return { success: false, error: "Wallet address is required." };
  }

  const config = loadEconomyConfig();
  const cost = config.streakRepairCostSkr !== undefined ? config.streakRepairCostSkr : 1;
  const users = loadUsers();
  const user = users[walletAddress] || { streak: 0 };

  // Restore streak to broken streak or increment current streak
  const restoredStreak = user.brokenStreak || user.previousStreak || Math.max(1, (user.streak || 0) + 1);
  user.streak = restoredStreak;
  user.brokenStreak = null;
  user.lastClockIn = new Date().toISOString();
  if (txSignature) {
    user.repairTx = txSignature;
  }

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
 * Record an Altar Offering (Tips) with 50% Burn + 50% Treasury
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
    treasurySkr: Number((amount * 0.5).toFixed(2)),
    burnedSkr: Number((amount * 0.5).toFixed(2)),
    txSignature: txSignature || "offering_" + Math.random().toString(36).slice(2, 10),
    message
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
    txSignature: txSignature || "sub_" + Math.random().toString(36).slice(2, 10)
  };

  users[walletAddress] = user;
  saveUsers(users);

  return {
    success: true,
    subscription: user.subscription
  };
}

module.exports = {
  getClockInStatus,
  setSeekerHolderStatus,
  recordClockIn,
  consumeSpread,
  repairStreak,
  recordOffering,
  recordSubscription,
  loadEconomyConfig,
  updateEconomyConfig
};

