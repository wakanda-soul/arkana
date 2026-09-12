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

if (!fs.existsSync(DB_PATH)) {
  fs.mkdirSync(DB_PATH, { recursive: true });
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

/**
 * Check wallet Clock-In and spread quota status
 */
function getClockInStatus(walletAddress) {
  if (!walletAddress) {
    return {
      canClockIn: true,
      streak: 0,
      lastClockIn: null,
      freeSpreadsRemaining: 3,
      freeSpreadsMax: 3,
      extraSpreadCostSkr: 5,
      skrBalance: 25,
      isSeekerHolder: true
    };
  }

  const users = loadUsers();
  const user = users[walletAddress] || { streak: 0, skrBalance: 25 };
  const now = new Date();
  const todayKey = now.toISOString().split("T")[0];

  const lastDate = user.lastClockIn ? new Date(user.lastClockIn) : null;
  let canClockIn = true;
  let currentStreak = user.streak || 0;

  if (lastDate) {
    const diffHours = (now - lastDate) / (1000 * 60 * 60);
    canClockIn = diffHours >= 20;
    if (diffHours >= 48) {
      currentStreak = 0;
    }
  }

  // Daily free quota calculation
  const lastSpreadDate = user.lastSpreadDate || "";
  const dailySpreadsUsed = (lastSpreadDate === todayKey) ? (user.dailySpreadsUsed || 0) : 0;
  const maxFree = getDailyFreeAllowance(currentStreak);
  const remainingFree = Math.max(0, maxFree - dailySpreadsUsed);

  return {
    canClockIn,
    streak: currentStreak,
    lastClockIn: user.lastClockIn,
    totalReadings: user.totalReadings || 0,
    skrBalance: user.skrBalance !== undefined ? user.skrBalance : 25,
    freeSpreadsRemaining: remainingFree,
    freeSpreadsMax: maxFree,
    extraSpreadCostSkr: 5,
    isSeekerHolder: true
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
    orientation: drawnCard.orientation,
    image: drawnCard.image
  });

  if (user.history.length > 30) user.history.pop();

  users[walletAddress] = user;
  saveUsers(users);

  const maxFree = getDailyFreeAllowance(user.streak);

  return {
    success: true,
    streak: user.streak,
    lastClockIn: user.lastClockIn,
    rewardSkr,
    freeSpreadsMax: maxFree,
    skrBalance: user.skrBalance
  };
}

/**
 * Consume a spread cast:
 * - Free if within daily allowance (first 3-5 spreads)
 * - Costs 5 SKR once daily allowance is exhausted
 */
function consumeSpread(walletAddress) {
  if (!walletAddress) {
    return { allowed: true, isFree: true, cost: 0, remainingFree: 3, balance: 25 };
  }

  const users = loadUsers();
  const user = users[walletAddress] || { streak: 0, skrBalance: 25 };
  const now = new Date();
  const todayKey = now.toISOString().split("T")[0];

  const lastSpreadDate = user.lastSpreadDate || "";
  let dailySpreadsUsed = (lastSpreadDate === todayKey) ? (user.dailySpreadsUsed || 0) : 0;
  const maxFree = getDailyFreeAllowance(user.streak || 0);

  if (dailySpreadsUsed < maxFree) {
    // Within free daily allowance
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
      remainingFree: maxFree - dailySpreadsUsed,
      balance: user.skrBalance
    };
  }

  // Beyond free quota: require 5 SKR fee
  const SPREAD_FEE = 5;
  if ((user.skrBalance || 0) < SPREAD_FEE) {
    return {
      allowed: false,
      isFree: false,
      cost: SPREAD_FEE,
      remainingFree: 0,
      balance: user.skrBalance || 0,
      error: `Daily free allowance reached (${maxFree}/${maxFree}). 5 SKR required to cast an additional spread.`
    };
  }

  // Deduct 5 SKR
  user.skrBalance = Number(((user.skrBalance || 0) - SPREAD_FEE).toFixed(2));
  dailySpreadsUsed += 1;
  user.dailySpreadsUsed = dailySpreadsUsed;
  user.lastSpreadDate = todayKey;
  user.totalReadings = (user.totalReadings || 0) + 1;
  users[walletAddress] = user;
  saveUsers(users);

  return {
    allowed: true,
    isFree: false,
    cost: SPREAD_FEE,
    remainingFree: 0,
    balance: user.skrBalance
  };
}

module.exports = {
  getClockInStatus,
  recordClockIn,
  consumeSpread
};
