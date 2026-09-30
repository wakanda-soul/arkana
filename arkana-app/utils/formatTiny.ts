const SUBSCRIPT = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

/**
 * Tiny amounts in the notation exchanges use: 0.00000005229 -> "0.0₇5229", the subscript being the
 * number of zeros after the decimal point. Amounts with fewer than `minZeros` leading zeros keep a
 * plain `fixed`-decimal form.
 */
export function formatTiny(value: number, { fixed = 4, minZeros = 3, digits = 4 } = {}): string {
  if (!Number.isFinite(value) || value <= 0) return (0).toFixed(fixed);
  if (value >= 10 ** -minZeros) return value.toFixed(fixed);

  let zeros = Math.floor(-Math.log10(value));
  let scaled = Math.round(value * 10 ** (zeros + digits));
  // Rounding up to the next power of ten (0.0₇99999 -> 0.0₆1) removes one leading zero
  if (scaled >= 10 ** digits) {
    zeros -= 1;
    scaled = Math.round(value * 10 ** (zeros + digits));
  }
  // Significant digits after the zeros, trailing zeros dropped (0.0₇5200 -> 0.0₇52)
  const significant = String(scaled)
    .slice(0, digits)
    .replace(/0+$/, '');
  const subscript = String(zeros)
    .split('')
    .map((d) => SUBSCRIPT[Number(d)])
    .join('');
  return `0.0${subscript}${significant || '0'}`;
}
