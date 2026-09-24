// The fair-price guard.
//
// Model. For a tokenized stock with price X, a redemption rate RR (shares per
// token, grows as dividends are reinvested) and the real equity price E:
//
//   premium p = 10_000 * ln( X / (E * RR) )          [bps]
//
// "Unusual" is judged against the asset's own history, per market session,
// because premiums behave very differently when the US market is open vs
// overnight vs the weekend:
//
//   live reference (regular / extended hours):
//       z = (p - median_b) / sqrt( s_b^2 + cX^2 + cE^2 )
//   stale reference (US market closed, E is the last traded price):
//       z = (p - median_regular) / sqrt( s_ext^2 + σ_h^2 * h + cX^2 + cE^2 )
//
// where s_b is a MAD-based scale of the premium in bucket b, cX / cE are Pyth's
// live confidence intervals (in bps), σ_h is the equity's hourly volatility and
// h the hours since the reference last traded. The σ_h·√h term widens the fair
// range the longer the market has been shut: after a 60-hour weekend the real
// stock could legitimately be several percent away from Friday's close.
//
// The guard is one-sided for a buyer: a discount is good news, a premium is a cost.

import { bpsToDollarsPer100, median, percentileRank, premiumBps, robustScale } from "./stats";
import { bucketOf, sessionAt, type Bucket, type Session } from "./session";
import type { Candles } from "./pyth";

export const LOOKBACK_DAYS = 30;
const MIN_SCALE_BPS = 3; // never claim precision tighter than 3 bps
const FRESH_MS = 10 * 60 * 1000; // an equity print older than this counts as stale

export type Verdict = "discount" | "fair" | "caution" | "wait" | "unknown";

export type BucketStats = { n: number; median: number; scale: number; values: number[] };

export type SeriesPoint = {
  t: number; // unix seconds (hour start)
  session: Session;
  premium: number; // xStock premium, bps
  ondo: number | null; // Ondo premium, bps
  staleHours: number;
};

export type Baseline = {
  builtAt: number;
  // How Pyth quotes Crypto.<T>X/USD: per raw token (needs RR) or per share.
  convention: "perRawToken" | "perShare";
  buckets: Record<Exclude<Bucket, "closed">, BucketStats>;
  ondoBuckets: Record<Exclude<Bucket, "closed">, BucketStats> | null;
  hourlyVolBps: number;
  closedZ: number[];
  series: SeriesPoint[];
};

type CandleSet = { equity: Candles; xstock: Candles; rr: Candles; ondo?: Candles | null };

function lastAtOrBefore(c: Candles, t: number, from: number): { idx: number } {
  let i = from;
  while (i + 1 < c.t.length && c.t[i + 1] <= t) i++;
  return { idx: c.t[i] <= t ? i : -1 };
}

function statsOf(values: number[]): BucketStats {
  const m = median(values);
  return { n: values.length, median: m, scale: robustScale(values, MIN_SCALE_BPS), values };
}

export function buildBaseline(c: CandleSet, now = Date.now()): Baseline {
  const eqIdx = new Map(c.equity.t.map((t, i) => [t, i]));

  // Hourly volatility of the real stock, from consecutive live hours only.
  const rets: number[] = [];
  for (let i = 1; i < c.equity.t.length; i++) {
    const t0 = c.equity.t[i - 1];
    const t1 = c.equity.t[i];
    if (t1 - t0 !== 3600) continue;
    if (sessionAt(t1 * 1000 + 1800_000) === "closed" || sessionAt(t0 * 1000 + 1800_000) === "closed") continue;
    rets.push(10_000 * Math.log(c.equity.c[i] / c.equity.c[i - 1]));
  }
  const hourlyVolBps = robustScale(rets, 5);

  // Align every xStock hour with the equity reference and redemption rate.
  type Raw = { t: number; session: Session; x: number; e: number; rr: number; on: number | null; staleHours: number };
  const raw: Raw[] = [];
  let rrCursor = 0;
  let onCursor = 0;
  let lastLiveEq: { t: number; price: number } | null = null;
  for (let i = 0; i < c.xstock.t.length; i++) {
    const t = c.xstock.t[i];
    const session = sessionAt(t * 1000 + 1800_000);
    const ei = eqIdx.get(t);
    if (ei !== undefined && session !== "closed") lastLiveEq = { t, price: c.equity.c[ei] };
    if (!lastLiveEq) continue;

    const r = lastAtOrBefore(c.rr, t, rrCursor);
    if (r.idx < 0) continue;
    rrCursor = r.idx;

    let on: number | null = null;
    if (c.ondo && c.ondo.t.length) {
      const o = lastAtOrBefore(c.ondo, t, onCursor);
      if (o.idx >= 0 && t - c.ondo.t[o.idx] <= 3600) {
        onCursor = o.idx;
        on = c.ondo.c[o.idx];
      }
    }

    const fresh = lastLiveEq.t === t;
    raw.push({
      t,
      session,
      x: c.xstock.c[i],
      e: lastLiveEq.price,
      rr: c.rr.c[r.idx],
      on,
      staleHours: fresh ? 0 : (t - lastLiveEq.t) / 3600,
    });
  }

  // Detect the quoting convention: whichever makes the regular-hours premium
  // closest to zero. With RR ≈ 1.003–1.006 the difference is 30–60 bps, far
  // larger than the regular-hours noise, so this is unambiguous.
  const reg = raw.filter((r) => r.session === "regular" && r.staleHours === 0);
  const perRaw = Math.abs(median(reg.map((r) => premiumBps(r.x, r.e * r.rr))));
  const perShare = Math.abs(median(reg.map((r) => premiumBps(r.x, r.e))));
  const convention: Baseline["convention"] = perShare < perRaw ? "perShare" : "perRawToken";
  const fair = (r: { e: number; rr: number }) => (convention === "perRawToken" ? r.e * r.rr : r.e);

  const series: SeriesPoint[] = raw.map((r) => ({
    t: r.t,
    session: r.session,
    premium: premiumBps(r.x, fair(r)),
    ondo: r.on !== null ? premiumBps(r.on, r.e) : null,
    staleHours: r.staleHours,
  }));

  const pick = (b: Bucket, f: (p: SeriesPoint) => number | null) =>
    series
      .filter((p) => bucketOf(p.session) === b && p.staleHours === 0)
      .map(f)
      .filter((v): v is number => v !== null && Number.isFinite(v));

  const buckets = {
    regular: statsOf(pick("regular", (p) => p.premium)),
    extended: statsOf(pick("extended", (p) => p.premium)),
  };
  const ondoReg = pick("regular", (p) => p.ondo);
  const ondoBuckets =
    ondoReg.length >= 10
      ? { regular: statsOf(ondoReg), extended: statsOf(pick("extended", (p) => p.ondo)) }
      : null;

  const closedZ = series
    .filter((p) => p.session === "closed")
    .map(
      (p) =>
        (p.premium - buckets.regular.median) /
        Math.sqrt(buckets.extended.scale ** 2 + hourlyVolBps ** 2 * p.staleHours),
    )
    .filter(Number.isFinite);

  return { builtAt: now, convention, buckets, ondoBuckets, hourlyVolBps, closedZ, series };
}

export type LiveInputs = {
  nowMs: number;
  session: Session;
  equity: { price: number; confidence: number | null; updatedAtMs: number | null };
  xstock: { price: number; confidence: number | null };
  rr: number;
  ondo: { price: number } | null;
};

export type GuardResult = {
  verdict: Verdict;
  z: number;
  premiumBps: number;
  typicalBps: number;
  scaleBps: number;
  percentile: number; // vs comparable history, 0..1
  dollarsOverFairPer100: number; // cost vs typical, on a $100 buy
  referenceStale: boolean;
  hoursSinceReference: number;
  fairPricePerShare: number;
  fairLowPerShare: number;
  fairHighPerShare: number;
  tokenPricePerShare: number;
  equityPrice: number;
  rr: number;
  convention: Baseline["convention"];
  confidenceBps: number;
  ondo: { premiumBps: number; z: number | null } | null;
};

export function verdictFor(z: number): Verdict {
  if (!Number.isFinite(z)) return "unknown";
  if (z >= 3) return "wait";
  if (z >= 2) return "caution";
  if (z <= -2) return "discount";
  return "fair";
}

// Scale + center for a premium observed now, given reference staleness.
function referenceModel(b: Baseline, stats: Baseline["buckets"], session: Session, staleH: number) {
  if (staleH === 0 && session !== "closed") {
    const s = stats[bucketOf(session) as "regular" | "extended"];
    return { center: s.median, scale: s.scale };
  }
  return {
    center: stats.regular.median,
    scale: Math.sqrt(stats.extended.scale ** 2 + b.hourlyVolBps ** 2 * staleH),
  };
}

// The ±2σ fair range for a historical hour, in bps (used by the chart).
export function fairBandAt(b: Baseline, p: SeriesPoint) {
  const { center, scale } = referenceModel(b, b.buckets, p.session, p.staleHours);
  return { center, lo: center - 2 * scale, hi: center + 2 * scale };
}

export function evaluate(b: Baseline, live: LiveInputs): GuardResult {
  const eqAge = live.equity.updatedAtMs ? live.nowMs - live.equity.updatedAtMs : Infinity;
  const stale = live.session === "closed" || eqAge > FRESH_MS;
  const staleH = stale ? Math.max(eqAge, 0) / 3_600_000 : 0;

  const fairUnit = b.convention === "perRawToken" ? live.equity.price * live.rr : live.equity.price;
  const p = premiumBps(live.xstock.price, fairUnit);

  const cX = live.xstock.confidence ? (10_000 * live.xstock.confidence) / live.xstock.price : 0;
  const cE = live.equity.confidence ? (10_000 * live.equity.confidence) / live.equity.price : 0;
  const confidenceBps = Math.sqrt(cX ** 2 + cE ** 2);

  const { center, scale } = referenceModel(b, b.buckets, live.session, staleH);
  const sEff = Math.sqrt(scale ** 2 + confidenceBps ** 2);
  const z = (p - center) / sEff;

  const percentile = stale
    ? percentileRank(b.closedZ, z)
    : percentileRank(b.buckets[bucketOf(live.session) as "regular" | "extended"].values, p);

  // Everything in "per share" terms so the UI can compare to the real stock.
  const perShare = (bps: number) => live.equity.price * Math.exp(bps / 10_000);

  let ondo: GuardResult["ondo"] = null;
  if (live.ondo) {
    const po = premiumBps(live.ondo.price, live.equity.price);
    let zo: number | null = null;
    if (b.ondoBuckets) {
      const m = referenceModel(b, b.ondoBuckets, live.session, staleH);
      zo = (po - m.center) / Math.sqrt(m.scale ** 2 + confidenceBps ** 2);
    }
    ondo = { premiumBps: po, z: zo };
  }

  return {
    verdict: verdictFor(z),
    z,
    premiumBps: p,
    typicalBps: center,
    scaleBps: sEff,
    percentile,
    dollarsOverFairPer100: bpsToDollarsPer100(p - center),
    referenceStale: stale,
    hoursSinceReference: staleH,
    fairPricePerShare: perShare(center),
    fairLowPerShare: perShare(center - 2 * sEff),
    fairHighPerShare: perShare(center + 2 * sEff),
    tokenPricePerShare: perShare(p),
    equityPrice: live.equity.price,
    rr: live.rr,
    convention: b.convention,
    confidenceBps,
    ondo,
  };
}

const MAX_SWAP_COST_BPS = 50; // spread + price impact above this is a warning on its own

// Execution check: what a specific Jupiter quote actually costs vs fair value.
// The market-state verdict comes from the token premium (z); the swap's own
// spread/impact is reported separately and can only make the verdict stricter.
export function evaluateQuote(g: GuardResult, usdcIn: number, sharesOut: number) {
  const execPerShare = usdcIn / sharesOut;
  const execBps = premiumBps(execPerShare, g.equityPrice);
  const swapCostBps = execBps - g.premiumBps;
  let verdict = g.verdict;
  if (swapCostBps > MAX_SWAP_COST_BPS && (verdict === "fair" || verdict === "discount")) verdict = "caution";
  return {
    execPerShare,
    execPremiumBps: execBps,
    swapCostBps,
    verdict,
    // Dollars paid above the typical fair price on this exact order.
    dollarsOverFair: usdcIn * (1 - Math.exp(-(execBps - g.typicalBps) / 10_000)),
  };
}
