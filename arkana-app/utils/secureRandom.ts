/**
 * Cryptographically secure randomness (crypto.getRandomValues, installed by react-native-quick-crypto
 * in polyfill.js). Used for card draws and payment nonces; never Math.random.
 */
export function secureRandomInt(maxExclusive: number): number {
  if (!Number.isInteger(maxExclusive) || maxExclusive <= 0 || maxExclusive > 2 ** 32) {
    throw new Error('secureRandomInt: bad range');
  }
  // Rejection sampling: no modulo bias
  const limit = Math.floor(2 ** 32 / maxExclusive) * maxExclusive;
  const buf = new Uint32Array(1);
  do {
    globalThis.crypto.getRandomValues(buf);
  } while (buf[0] >= limit);
  return buf[0] % maxExclusive;
}

/** `bytes` random bytes as lowercase hex. */
export function secureRandomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
}
