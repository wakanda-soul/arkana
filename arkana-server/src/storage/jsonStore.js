/**
 * Crash-safe JSON files for data/*.json.
 *
 * Writes go to `${file}.tmp` first and are then renamed over the real file, so a crash mid-write
 * never leaves a truncated file behind. A file that exists but does not parse is never treated as
 * empty: returning {} there would let the next save wipe every user, session or used payment.
 */
const fs = require("fs");

function readJson(file, fallback = {}) {
  let text;
  try {
    text = fs.readFileSync(file, "utf8");
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
  if (!text.trim()) return fallback;
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error(`[jsonStore] CORRUPT JSON in ${file}: ${err.message}. Refusing to use or overwrite it.`);
    throw new Error(`Corrupt data file ${file}`);
  }
}

function writeJsonAtomic(file, data) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tmp, file);
}

module.exports = { readJson, writeJsonAtomic };
