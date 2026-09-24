// Small robust-statistics toolkit. Premiums are heavy-tailed (a single bad
// print or a Monday-open gap can be 50x the usual spread), so everything here
// uses medians and MAD instead of means and standard deviations.

export const MAD_TO_SIGMA = 1.4826; // MAD * 1.4826 ≈ σ for a normal distribution

export function median(xs: number[]): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function mad(xs: number[], center = median(xs)): number {
  return median(xs.map((x) => Math.abs(x - center)));
}

export function robustScale(xs: number[], floor = 0): number {
  return Math.max(MAD_TO_SIGMA * mad(xs), floor);
}

// Share of the sample at or below x, in [0, 1].
export function percentileRank(xs: number[], x: number): number {
  if (xs.length === 0) return NaN;
  let below = 0;
  for (const v of xs) if (v <= x) below++;
  return below / xs.length;
}

export function quantile(xs: number[], q: number): number {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  const pos = (s.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return s[lo] + (s[hi] - s[lo]) * (pos - lo);
}

// Log-premium in basis points: 10_000 * ln(token / fair).
export function premiumBps(tokenPrice: number, fairPrice: number): number {
  return 10_000 * Math.log(tokenPrice / fairPrice);
}

// Converts a log-premium in bps to "dollars over fair on a $100 buy".
export function bpsToDollarsPer100(bps: number): number {
  return 100 * (Math.exp(bps / 10_000) - 1);
}
