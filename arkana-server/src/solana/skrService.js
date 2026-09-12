/**
 * SKR Token & Daily Clock-In Manager
 * Integrates Seeker native asset (SKR) mechanics & daily engagement loops.
 */

const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "..", "..", "data");
const USERS_FILE = path.join(DB_PATH, "users.json");

// Ensure data folder exists
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

/**
 * Check if a wallet can perform Daily Clock In
 */
function getClockInStatus(walletAddress) {
  if (!walletAddress) {
    return { canClockIn: true, streak: 0, lastClockIn: null };
  }
  const users = loadUsers();
  const user = users[walletAddress];
  if (!user || !user.lastClockIn) {
    return { canClockIn: true, streak: 0, lastClockIn: null, isSeekerHolder: true };
  }

  const lastDate = new Date(user.lastClockIn);
  const now = new Date();
  const diffHours = (now - lastDate) / (1000 * 60 * 60);

  const canClockIn = diffHours >= 20; // 20 hours window for daily cycle
  const isStreakBroken = diffHours >= 48;
  const currentStreak = isStreakBroken ? 0 : (user.streak || 0);

  return {
    canClockIn,
    streak: currentStreak,
    lastClockIn: user.lastClockIn,
    totalReadings: user.totalReadings || 0,
    skrBalance: user.skrBalance || 100, // mock default for test wallets
    isSeekerHolder: true
  };
}

/**
 * Record a Daily Clock In
 */
function recordClockIn(walletAddress, drawnCard) {
  const users = loadUsers();
  const now = new Date();
  const user = users[walletAddress] || { streak: 0, history: [], totalReadings: 0, skrBalance: 100 };

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
  user.history = user.history || [];
  user.history.unshift({
    timestamp: now.toISOString(),
    type: "daily-block",
    card: drawnCard.crypto_name,
    orientation: drawnCard.orientation,
    image: drawnCard.image
  });

  // Keep last 30 readings
  if (user.history.length > 30) user.history.pop();

  users[walletAddress] = user;
  saveUsers(users);

  return {
    success: true,
    streak: user.streak,
    lastClockIn: user.lastClockIn,
    rewardSkr: 5 // Bonus 5 SKR reward for daily clock in!
  };
}

module.exports = {
  getClockInStatus,
  recordClockIn
};
