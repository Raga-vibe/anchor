// Turns the guard's numbers into sentences a first-time investor can act on.
import type { GuardResult, Verdict } from "./guard";
import { hours, pct, usd } from "./format";

export const VERDICT_COPY: Record<Verdict, { label: string; headline: string }> = {
  discount: { label: "Discount", headline: "Cheaper than usual." },
  fair: { label: "Fair", headline: "Fair price." },
  caution: { label: "Pricey", headline: "Pricier than usual." },
  wait: { label: "Wait", headline: "Consider waiting." },
  unknown: { label: "No data", headline: "Not enough data." },
};

const abs = (bps: number) => pct(Math.abs(bps)).replace("+", "");

// "AAPLx is 0.06% above real AAPL"
export function gapPhrase(g: GuardResult, ticker: string, xstockSymbol: string) {
  return `${xstockSymbol} is ${abs(g.premiumBps)} ${g.premiumBps >= 0 ? "above" : "below"} real ${ticker}`;
}

// What the verdict means for the buyer, without restating the gap.
export function verdictLine(g: GuardResult): string {
  const extra = usd(Math.abs(g.dollarsOverFairPer100));
  switch (g.verdict) {
    case "fair":
      return `That's normal ${g.referenceStale ? "while the US market is closed" : "for this time of day"}.`;
    case "discount":
      return "Cheaper than it usually trades. A good moment if you were going to buy anyway.";
    case "caution":
      return `Pricier than usual: about ${extra} extra per $100.`;
    case "wait":
      return `${
        g.referenceStale ? "Far outside even the widened range" : `Higher than ${Math.round(g.percentile * 100)}% of the last 30 days`
      }. You'd overpay about ${extra} per $100.`;
    default:
      return "There isn't enough price history to judge this token yet.";
  }
}

// The full one-liner: "AAPLx is 0.06% above real AAPL. That's normal for this time of day."
export function summary(g: GuardResult, ticker: string, xstockSymbol: string): string {
  return `${gapPhrase(g, ticker, xstockSymbol)}. ${verdictLine(g)}`;
}

// Supporting facts shown under the verdict.
export function details(g: GuardResult, ticker: string): string[] {
  const lines = [`Fair range right now: ${usd(g.fairLowPerShare)} – ${usd(g.fairHighPerShare)} per share.`];
  if (g.referenceStale) {
    lines.push(
      `The US market hasn't traded ${ticker} for ${hours(g.hoursSinceReference)}, so the real price is uncertain and the fair range is wider.`,
    );
  }
  lines.push(`Usually the token trades ${abs(g.typicalBps)} ${g.typicalBps >= 0 ? "above" : "below"} the stock at this time of day.`);
  return lines;
}
