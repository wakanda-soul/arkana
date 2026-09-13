const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const crypto = require("crypto");

const DATA_DIR = path.join(__dirname, "..", "..", "data");
const LOG_FILE = path.join(DATA_DIR, "dialogues.jsonl");
const MAX_LOG_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB per file before gzip rotation
const MAX_ARCHIVES = 50; // Keep up to 50 compressed archives (~500 MB raw, ~50 MB compressed)

if (!fs.existsSync(DATA_DIR)) {
  try {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  } catch (err) {
    console.error("[Logger] Failed to create data directory:", err.message);
  }
}

/**
 * Rotate log file if exceeding MAX_LOG_SIZE_BYTES.
 * Compresses the rotated log to .jsonl.gz asynchronously.
 */
function checkAndRotateLogs() {
  try {
    if (!fs.existsSync(LOG_FILE)) return;
    const stats = fs.statSync(LOG_FILE);
    if (stats.size < MAX_LOG_SIZE_BYTES) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const rotatedPath = path.join(DATA_DIR, `dialogues-${timestamp}.jsonl`);
    const gzipPath = `${rotatedPath}.gz`;

    // Atomic rename
    fs.renameSync(LOG_FILE, rotatedPath);

    // Compress in background
    const readStream = fs.createReadStream(rotatedPath);
    const writeStream = fs.createWriteStream(gzipPath);
    const gzip = zlib.createGzip();

    readStream
      .pipe(gzip)
      .pipe(writeStream)
      .on("finish", () => {
        try {
          fs.unlinkSync(rotatedPath); // Remove uncompressed archive
          cleanOldArchives();
        } catch {}
      });
  } catch (err) {
    console.error("[Logger] Log rotation failed:", err.message);
  }
}

/**
 * Clean up old compressed archives beyond retention limit.
 */
function cleanOldArchives() {
  try {
    const files = fs.readdirSync(DATA_DIR);
    const archives = files
      .filter((f) => f.startsWith("dialogues-") && f.endsWith(".jsonl.gz"))
      .map((f) => ({
        name: f,
        path: path.join(DATA_DIR, f),
        time: fs.statSync(path.join(DATA_DIR, f)).mtimeMs
      }))
      .sort((a, b) => b.time - a.time);

    if (archives.length > MAX_ARCHIVES) {
      const toDelete = archives.slice(MAX_ARCHIVES);
      for (const item of toDelete) {
        try {
          fs.unlinkSync(item.path);
        } catch {}
      }
    }
  } catch {}
}

/**
 * Append a dialogue log entry to dialogues.jsonl
 * @param {Object} entry - Log payload
 */
function logDialogue(entry) {
  try {
    const record = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type: entry.type || "chat", // "chat", "reading", "clock-in"
      wallet: entry.wallet || "anonymous",
      user_message: entry.user_message || "",
      oracle_reply: entry.oracle_reply || "",
      is_injection_attempt: Boolean(entry.is_injection_attempt),
      is_code_attempt: Boolean(entry.is_code_attempt),
      blocked_by_safety: Boolean(entry.blocked_by_safety),
      safety_reason: entry.safety_reason || null,
      status: entry.status || "success",
      latency_ms: entry.latency_ms || 0,
      client_ip: entry.client_ip || "unknown",
      error: entry.error || null
    };

    const line = JSON.stringify(record) + "\n";
    fs.appendFile(LOG_FILE, line, "utf-8", (err) => {
      if (err) {
        console.error("[Logger] Append failed:", err.message);
      }
    });

    // Check size asynchronously
    setImmediate(checkAndRotateLogs);
  } catch (err) {
    console.error("[Logger] logDialogue exception:", err.message);
  }
}

/**
 * Query recent dialogue logs with pagination and filters.
 * Reads backwards from file for fast retrieval.
 */
function queryLogs(options = {}) {
  const { page = 1, limit = 50, filter = "all", wallet = null } = options;
  if (!fs.existsSync(LOG_FILE)) {
    return {
      total: 0,
      page,
      limit,
      totalPages: 0,
      logs: [],
      stats: { total: 0, injections: 0, codeAttempts: 0, errors: 0, logSizeBytes: 0 }
    };
  }

  try {
    const raw = fs.readFileSync(LOG_FILE, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);

    let totalInjections = 0;
    let totalCode = 0;
    let totalErrors = 0;
    const allRecords = [];

    // Parse records backwards (most recent first)
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const record = JSON.parse(lines[i]);
        if (record.is_injection_attempt) totalInjections++;
        if (record.is_code_attempt) totalCode++;
        if (record.status === "error" || record.error) totalErrors++;

        // Apply filters
        let keep = true;
        if (filter === "injections" && !record.is_injection_attempt) keep = false;
        if (filter === "code" && !record.is_code_attempt) keep = false;
        if (filter === "security" && !record.is_injection_attempt && !record.is_code_attempt) keep = false;
        if (filter === "errors" && record.status !== "error" && !record.error) keep = false;
        if (wallet && record.wallet !== wallet) keep = false;

        if (keep) {
          allRecords.push(record);
        }
      } catch {}
    }

    const totalFiltered = allRecords.length;
    const totalPages = Math.ceil(totalFiltered / limit) || 1;
    const startIndex = (page - 1) * limit;
    const pageRecords = allRecords.slice(startIndex, startIndex + limit);

    const stats = {
      total: lines.length,
      injections: totalInjections,
      codeAttempts: totalCode,
      errors: totalErrors,
      logSizeBytes: fs.statSync(LOG_FILE).size
    };

    return {
      total: totalFiltered,
      page: Number(page),
      limit: Number(limit),
      totalPages,
      logs: pageRecords,
      stats
    };
  } catch (err) {
    console.error("[Logger] queryLogs error:", err.message);
    return { error: err.message, logs: [] };
  }
}

/**
 * Get aggregate logging statistics and disk usage.
 */
function getLogStats() {
  if (!fs.existsSync(LOG_FILE)) {
    return {
      total: 0,
      injections: 0,
      codeAttempts: 0,
      errors: 0,
      logSizeBytes: 0,
      diskUsageFormatted: "0 KB"
    };
  }

  try {
    const raw = fs.readFileSync(LOG_FILE, "utf-8");
    const lines = raw.trim().split("\n").filter(Boolean);
    let injections = 0;
    let codeAttempts = 0;
    let errors = 0;

    for (let i = 0; i < lines.length; i++) {
      try {
        const item = JSON.parse(lines[i]);
        if (item.is_injection_attempt) injections++;
        if (item.is_code_attempt) codeAttempts++;
        if (item.status === "error" || item.error) errors++;
      } catch {}
    }

    const sizeBytes = fs.statSync(LOG_FILE).size;
    let diskUsageFormatted = (sizeBytes / 1024).toFixed(1) + " KB";
    if (sizeBytes > 1024 * 1024) {
      diskUsageFormatted = (sizeBytes / (1024 * 1024)).toFixed(2) + " MB";
    }

    return {
      total: lines.length,
      injections,
      codeAttempts,
      errors,
      logSizeBytes: sizeBytes,
      diskUsageFormatted
    };
  } catch (err) {
    return { error: err.message };
  }
}

module.exports = {
  logDialogue,
  queryLogs,
  getLogStats,
  LOG_FILE
};
