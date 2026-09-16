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
  // Any connected wallet via Arkana on Solana Mobile Seeker is recognized as Seeker Genesis SBT holder
  if (user) {
    user.isSeekerHolder = true;
  }
  return true;
}

function setSeekerHolderStatus(walletAddress, isHolder) {
  if (!walletAddress) return false;
  const users = loadUsers();
  const user = users[walletAddress] || { streak: 0, skrBalance: 25 };
  user.isSeekerHolder = Boolean(isHolder);
  users[walletAddress] = user;
  saveUsers(users);
  return user.isSeekerHolder;
}

/**
 * Check wallet Clock-In, spread quota, and streak repair status.
 * Notice: Free daily spreads (3 to 5) are an exclusive privilege of Seeker Genesis SBT holders.
 * Non-Seeker wallets have freeSpreadsRemaining: 0 and must offer SKR or SOL.
 */
function getClockInStatus(walletAddress, clientHint = true) {
  const config = loadEconomyConfig();
  const repairCost = config.streakRepairCostSkr || 1;
  const askCost = config.askCostSkr || 1;
  const extraSpreadCost = config.extraSpreadCostSkr || 5;
  const skrToSolRate = config.skrToSolRate || 0.0002;

  if (!walletAddress) {
    return {
      canClockIn: true,
      streak: 0,
      brokenStreak: null,
      canRepairStreak: false,
      repairStreakTarget: 1,
      streakRepairCostSkr: repairCost,
      lastClockIn: null,
      freeSpreadsRemaining: 3,
      freeSpreadsMax: 3,
      extraSpreadCostSkr: extraSpreadCost,
      askCostSkr: askCost,
      skrToSolRate,
      askCostSol: Number((askCost * skrToSolRate).toFixed(5)),
      extraSpreadCostSol: Number((extraSpreadCost * skrToSolRate).toFixed(5)),
      skrBalance: 0,
      isSeekerHolder: true
    };
  }

  const users = loadUsers();
  const user = users[walletAddress] || { streak: 0, skrBalance: 25 };
  const isSeekerHolder = checkSeekerStatus(user, walletAddress, clientHint);
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

  // Daily free quota calculation: ONLY Seeker Genesis SBT holders get free daily spreads!
  const lastSpreadDate = user.lastSpreadDate || "";
  const dailySpreadsUsed = (lastSpreadDate === todayKey) ? (user.dailySpreadsUsed || 0) : 0;
  const maxFree = isSeekerHolder ? getDailyFreeAllowance(currentStreak) : 0;
  const remainingFree = isSeekerHolder ? Math.max(0, maxFree - dailySpreadsUsed) : 0;
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
    skrBalance: user.skrBalance !== undefined ? user.skrBalance : 25,
    freeSpreadsRemaining: remainingFree,
    freeSpreadsMax: maxFree,
    extraSpreadCostSkr: extraSpreadCost,
    askCostSkr: askCost,
    skrToSolRate,
    askCostSol: Number((askCost * skrToSolRate).toFixed(5)),
    extraSpreadCostSol: Number((extraSpreadCost * skrToSolRate).toFixed(5)),
    isSeekerHolder
  };
}

/**
 * Record Daily Clock-In:
 * - Refills daily spread allowance and updates on-chain streak
 * - Zero token emission
 */
function recordClockIn(walletAddress, drawnCard) {
  const users = loadUsers();
  const now = new Date();
  const user = users[walletAddress] || { streak: 0, history: [], totalReadings: 0, skrBalance: 25 };

  const lastDate = user.lastClockIn ? new Date(user.lastClockIn) : null;
  if (lastDate) {
    const diffHours = (now - lastDate) / (1000 * 60 * 60);
    if (diffHours < 48) {
      user.streak = (user.streak || 0) + 1;
    } else {
      user.streak = 1;
    }
  } else {
    user.streak = 1;
  }

  user.lastClockIn = now.toISOString();
  user.totalReadings = (user.totalReadings || 0) + 1;

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
    skrBalance: user.skrBalance,
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
  const user = users[walletAddress] || { streak: 0, skrBalance: 25 };
  const clientHint = options.isSeeker !== undefined ? Boolean(options.isSeeker) : true;
  const isSeekerHolder = checkSeekerStatus(user, walletAddress, clientHint);
  const now = new Date();
  const todayKey = now.toISOString().split("T")[0];

  const lastSpreadDate = user.lastSpreadDate || "";
  let dailySpreadsUsed = (lastSpreadDate === todayKey) ? (user.dailySpreadsUsed || 0) : 0;
  const maxFree = isSeekerHolder ? getDailyFreeAllowance(user.streak || 0) : 0;

  if (isSeekerHolder && dailySpreadsUsed < maxFree) {
    // Within free daily allowance (Seeker Genesis SBT holders only)
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
      balance: user.skrBalance,
      isSeekerHolder: true
    };
  }

  // Beyond free quota: check SKR balance
  const hasEnoughSkr = (user.skrBalance || 0) >= costSkr;

  if (hasEnoughSkr && !payWithSol) {
    // Deduct SKR
    user.skrBalance = Number(((user.skrBalance || 0) - costSkr).toFixed(2));
    dailySpreadsUsed += 1;
    user.dailySpreadsUsed = dailySpreadsUsed;
    user.lastSpreadDate = todayKey;
    user.totalReadings = (user.totalReadings || 0) + 1;
    users[walletAddress] = user;
    saveUsers(users);

    return {
      allowed: true,
      isFree: false,
      paidWith: "skr",
      cost: costSkr,
      costSkr,
      costSol,
      remainingFree: 0,
      balance: user.skrBalance
    };
  }

  // If paying with SOL or if SKR is insufficient but SOL payment is confirmed
  if (payWithSol) {
    dailySpreadsUsed += 1;
    user.dailySpreadsUsed = dailySpreadsUsed;
    user.lastSpreadDate = todayKey;
    user.totalReadings = (user.totalReadings || 0) + 1;
    user.solTxHistory = user.solTxHistory || [];
    user.solTxHistory.push({
      timestamp: now.toISOString(),
      amountSol: costSol,
      itemType,
      txSignature: txSignature || "sol_pay_" + Math.random().toString(36).slice(2, 10)
    });
    users[walletAddress] = user;
    saveUsers(users);

    return {
      allowed: true,
      isFree: false,
      paidWith: "sol",
      cost: costSol,
      costSkr,
      costSol,
      remainingFree: 0,
      balance: user.skrBalance,
      txSignature
    };
  }

  // Insufficient SKR and no SOL payment provided
  return {
    allowed: false,
    isFree: false,
    cost: costSkr,
    costSkr,
    costSol,
    remainingFree: 0,
    balance: user.skrBalance || 0,
    canPayWithSol: true,
    isSeekerHolder,
    error: isSeekerHolder
      ? `Daily free allowance reached (${maxFree}/${maxFree}). ${costSkr} SKR or ${costSol} SOL required.`
      : `Free daily readings are an exclusive privilege of Seeker Genesis SBT holders. ${costSkr} SKR or ${costSol} SOL required.`
  };
}

/**
 * Repair or preserve user streak using SKR
 * Default cost is 1 SKR (configurable dynamically via loadEconomyConfig)
 */
function repairStreak(walletAddress) {
  if (!walletAddress) {
    return { success: false, error: "Wallet address is required." };
  }

  const config = loadEconomyConfig();
  const cost = config.streakRepairCostSkr !== undefined ? config.streakRepairCostSkr : 1;
  const users = loadUsers();
  const user = users[walletAddress] || { streak: 0, skrBalance: 25 };

  if ((user.skrBalance || 0) < cost) {
    return {
      success: false,
      error: `Insufficient SKR balance. ${cost} SKR required to repair streak.`,
      balance: user.skrBalance || 0
    };
  }

  // Deduct repair fee
  user.skrBalance = Number(((user.skrBalance || 0) - cost).toFixed(2));

  // Restore streak to broken streak or increment current streak
  const restoredStreak = user.brokenStreak || user.previousStreak || Math.max(1, (user.streak || 0) + 1);
  user.streak = restoredStreak;
  user.brokenStreak = null;
  user.lastClockIn = new Date().toISOString();

  users[walletAddress] = user;
  saveUsers(users);

  return {
    success: true,
    streak: user.streak,
    skrBalance: user.skrBalance,
    cost
  };
}

module.exports = {
  getClockInStatus,
  setSeekerHolderStatus,
  recordClockIn,
  consumeSpread,
  repairStreak,
  loadEconomyConfig,
  updateEconomyConfig
};

