import "server-only";
import { ASSETS, type Asset } from "./assets";
import { buildBaseline, evaluate, type Baseline, type GuardResult } from "./guard";
import { lastLiveMs, sessionAt, type Session } from "./session";
import { equityHistory, liveEquity, liveTokenPrices, multipliers, poolHistory, type Candles } from "./sources";

async function baselineFor(asset: Asset): Promise<Baseline> {
  const [equity, xstock, [mult]] = await Promise.all([equityHistory(asset), poolHistory(asset), multipliers([asset])]);
  // Shares-per-token at each candle's close (the multiplier steps up on dividend dates).
  const rr: Candles = { t: xstock.t, c: xstock.t.map((t) => mult.at(t + 3600)) };
  return buildBaseline({ equity, xstock, rr });
}

export type AssetGuard = {
  ticker: string;
  name: string;
  xstockSymbol: string;
  session: Session;
  pythAccount: string;
  spreadBps: number | null; // bid/ask spread on a $100 trade
  guard: GuardResult | null;
  error?: string;
};

type Live = Awaited<ReturnType<typeof fetchLive>>;

async function fetchLive(assets: Asset[]) {
  const [eq, px, mult] = await Promise.all([liveEquity(assets), liveTokenPrices(assets), multipliers(assets)]);
  return { nowMs: Date.now(), eq, px, mult };
}

function assemble(asset: Asset, i: number, live: Live, baseline: Baseline): AssetGuard {
  const session = sessionAt(live.nowMs);
  const px = live.px[i];
  const base = {
    ticker: asset.ticker,
    name: asset.name,
    xstockSymbol: asset.xstockSymbol,
    session,
    pythAccount: asset.pythAccount,
    spreadBps: px?.spreadBps ?? null,
  };
  const eq = live.eq[i];
  if (!eq || !px) return { ...base, guard: null, error: !eq ? "Pyth price unavailable" : "Token price unavailable" };

  // While the US market is shut, Pyth keeps re-posting the last price; what
  // matters is how long ago the stock last actually traded.
  const updatedAtMs = session === "closed" ? Math.min(eq.publishTimeMs, lastLiveMs(live.nowMs)) : eq.publishTimeMs;
  const guard = evaluate(baseline, {
    nowMs: live.nowMs,
    session,
    equity: { price: eq.price, confidence: eq.confidence, updatedAtMs },
    xstock: { price: px.perRawToken, confidence: null },
    rr: live.mult[i].current,
  });
  return { ...base, guard };
}

export async function guardAll(): Promise<AssetGuard[]> {
  const [live, baselines] = await Promise.all([fetchLive(ASSETS), Promise.allSettled(ASSETS.map(baselineFor))]);
  return ASSETS.map((a, i) => {
    const b = baselines[i];
    if (b.status === "rejected") {
      return {
        ticker: a.ticker,
        name: a.name,
        xstockSymbol: a.xstockSymbol,
        session: sessionAt(live.nowMs),
        pythAccount: a.pythAccount,
        spreadBps: null,
        guard: null,
        error: String(b.reason),
      };
    }
    return assemble(a, i, live, b.value);
  });
}

export async function guardOne(asset: Asset) {
  const [live, baseline] = await Promise.all([fetchLive([asset]), baselineFor(asset)]);
  return { ...assemble(asset, 0, live, baseline), baseline };
}
