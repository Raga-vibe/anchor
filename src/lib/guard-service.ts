import "server-only";
import { ASSETS, type Asset } from "./assets";
import { buildBaseline, evaluate, LOOKBACK_DAYS, type Baseline, type GuardResult } from "./guard";
import { fetchCandles, fetchLatest, type LatestSnapshot } from "./pyth";
import type { Session } from "./session";

const BASELINE_TTL_MS = 10 * 60 * 1000;
const baselineCache = new Map<string, { at: number; value: Promise<Baseline> }>();

export function getBaseline(asset: Asset): Promise<Baseline> {
  const hit = baselineCache.get(asset.ticker);
  if (hit && Date.now() - hit.at < BASELINE_TTL_MS) return hit.value;

  const to = Date.now() / 1000;
  const from = to - LOOKBACK_DAYS * 86400;
  const value = Promise.all([
    fetchCandles(asset.symbols.equity, from, to),
    fetchCandles(asset.symbols.xstock, from, to),
    fetchCandles(asset.symbols.rr, from, to),
    asset.symbols.ondo ? fetchCandles(asset.symbols.ondo, from, to).catch(() => null) : Promise.resolve(null),
  ]).then(([equity, xstock, rr, ondo]) => buildBaseline({ equity, xstock, rr, ondo }));

  baselineCache.set(asset.ticker, { at: Date.now(), value });
  value.catch(() => baselineCache.delete(asset.ticker));
  return value;
}

function feedIds(assets: Asset[]) {
  return assets.flatMap((a) => [a.feeds.equity, a.feeds.xstock, a.feeds.rr, ...(a.feeds.ondo ? [a.feeds.ondo] : [])]);
}

export type AssetGuard = {
  ticker: string;
  name: string;
  xstockSymbol: string;
  session: Session;
  guard: GuardResult | null;
  error?: string;
};

function assemble(asset: Asset, snap: LatestSnapshot, baseline: Baseline): AssetGuard {
  const eq = snap.feeds.get(asset.feeds.equity);
  const x = snap.feeds.get(asset.feeds.xstock);
  const rr = snap.feeds.get(asset.feeds.rr);
  const on = asset.feeds.ondo ? snap.feeds.get(asset.feeds.ondo) : undefined;
  const session: Session = (eq?.marketSession as Session) ?? "closed";

  if (!eq?.price || !x?.price || !rr?.price) {
    return { ticker: asset.ticker, name: asset.name, xstockSymbol: asset.xstockSymbol, session, guard: null, error: "Missing live price" };
  }
  const guard = evaluate(baseline, {
    nowMs: snap.timestampMs,
    session,
    equity: { price: eq.price, confidence: eq.confidence, updatedAtMs: eq.updatedAtMs },
    xstock: { price: x.price, confidence: x.confidence },
    rr: rr.price,
    ondo: on?.price ? { price: on.price } : null,
  });
  return { ticker: asset.ticker, name: asset.name, xstockSymbol: asset.xstockSymbol, session, guard };
}

export async function guardAll(): Promise<AssetGuard[]> {
  const [snap, baselines] = await Promise.all([
    fetchLatest(feedIds(ASSETS)),
    Promise.allSettled(ASSETS.map(getBaseline)),
  ]);
  return ASSETS.map((a, i) => {
    const b = baselines[i];
    if (b.status === "rejected") {
      return { ticker: a.ticker, name: a.name, xstockSymbol: a.xstockSymbol, session: "closed", guard: null, error: String(b.reason) };
    }
    return assemble(a, snap, b.value);
  });
}

export async function guardOne(asset: Asset) {
  const [snap, baseline] = await Promise.all([fetchLatest(feedIds([asset])), getBaseline(asset)]);
  return { ...assemble(asset, snap, baseline), baseline };
}
