// Turns the guard's numbers into sentences a first-time investor can act on.
import type { GuardResult, Verdict } from "./guard";
import { hours, pct, usd } from "./format";

export const VERDICT_COPY: Record<Verdict, { label: string; headline: string }> = {
  discount: { label: "Discount", headline: "Cheaper than usual" },
  fair: { label: "Fair", headline: "Fair price" },
  caution: { label: "Pricey", headline: "Pricier than usual" },
  wait: { label: "Wait", headline: "Consider waiting" },
  unknown: { label: "No data", headline: "Not enough data" },
};

export function explain(g: GuardResult, ticker: string): string[] {
  const lines: string[] = [];
  const diff = g.premiumBps - g.typicalBps;
  const dir = g.premiumBps >= 0 ? "above" : "below";

  lines.push(
    `The token costs ${usd(g.tokenPricePerShare)} per share, ${pct(Math.abs(g.premiumBps)).replace("+", "")} ${dir} the real ${ticker} stock (${usd(g.equityPrice)}).`,
  );

  if (g.referenceStale) {
    lines.push(
      `The US market hasn't traded ${ticker} for ${hours(g.hoursSinceReference)}, so the real price is uncertain. We allow a wider fair range: ${usd(g.fairLowPerShare)} – ${usd(g.fairHighPerShare)}.`,
    );
  } else {
    lines.push(`Fair range right now: ${usd(g.fairLowPerShare)} – ${usd(g.fairHighPerShare)} per share.`);
  }

  switch (g.verdict) {
    case "wait":
      lines.push(
        `${g.referenceStale ? "That's far outside even the widened range." : `That's higher than ${Math.round(g.percentile * 100)}% of comparable hours in the last 30 days.`} On a $100 buy you'd pay about ${usd(Math.abs(g.dollarsOverFairPer100))} more than usual. Waiting for the gap to close is usually cheaper.`,
      );
      break;
    case "caution":
      lines.push(
        `It's on the expensive side (about ${usd(Math.abs(g.dollarsOverFairPer100))} extra per $100). Fine for small buys, but you may get a better price later.`,
      );
      break;
    case "discount":
      lines.push(`It's ${pct(Math.abs(diff)).replace("+", "")} cheaper than its usual level. A good moment to buy, if you were going to anyway.`);
      break;
    case "fair":
      lines.push(`This gap is normal for this time of day. Nothing unusual.`);
      break;
    default:
      break;
  }
  return lines;
}
