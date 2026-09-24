// Market data sources, all free and keyless:
//   real stock, live     -> Pyth price account on Solana (./pyth)
//   real stock, history  -> Yahoo Finance 30-minute bars incl. pre/post market
//   xStock, live         -> mid of two-sided Jupiter quotes (pool last price as fallback)
//   xStock, history      -> hourly averages of its main xStock/USDC pool on GeckoTerminal
//   shares per token     -> the xStock mint's Token-2022 ScaledUiAmount config
import "server-only";
import { PublicKey } from "@solana/web3.js";
import { USDC_DECIMALS, USDC_MINT, type Asset } from "./assets";
import { getQuote } from "./jupiter";
import { readPythPrices, type PythPrice } from "./pyth";
import { connection } from "./solana";

// t = hour start (unix seconds); c = that hour's average price (mean of OHLC).
// Hourly averages rather than closes: a pool's close is a single trade that
// bounces between buy and sell prints, which roughly doubles the premium noise.
export type Candles = { t: number[]; c: number[] };

const GT = "https://api.geckoterminal.com/api/v2/networks/solana";
const JUP_PRICE = "https://lite-api.jup.ag/price/v3";

const cache = new Map<string, { at: number; value: Promise<unknown> }>();
function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.value as Promise<T>;
  const value = fn();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

async function getJson<T>(url: string, init?: RequestInit, retries = 3): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { ...init, cache: "no-store" });
    if (res.ok) return (await res.json()) as T;
    if (res.status === 429 && attempt < retries) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt)); // 2s, 4s, 8s
      continue;
    }
    throw new Error(`${new URL(url).host} ${res.status}`);
  }
}

// ---------- live ----------

export function liveEquity(assets: Asset[]): Promise<(PythPrice | null)[]> {
  return cached(`eq:${assets.map((a) => a.ticker)}`, 5_000, () =>
    readPythPrices(assets.map((a) => ({ address: a.pythAccount, feedId: a.pythFeedId }))),
  );
}

export type Multiplier = { current: number; at: (unixSec: number) => number };

type ScaledUi = { multiplier: string; newMultiplier: string; newMultiplierEffectiveTimestamp: number | string };

// xStocks reinvest dividends by raising a multiplier: 1 raw token = multiplier shares.
export function multipliers(assets: Asset[]): Promise<Multiplier[]> {
  return cached(`mult:${assets.map((a) => a.ticker)}`, 10 * 60_000, async () => {
    const infos = await connection().getMultipleParsedAccounts(assets.map((a) => new PublicKey(a.xstockMint)));
    return infos.value.map((info) => {
      const data = info?.data;
      const ext =
        data && "parsed" in data
          ? (data.parsed.info.extensions as { extension: string; state: ScaledUi }[] | undefined)?.find(
              (e) => e.extension === "scaledUiAmountConfig",
            )
          : undefined;
      if (!ext) return { current: 1, at: () => 1 };
      const oldM = Number(ext.state.multiplier);
      const newM = Number(ext.state.newMultiplier);
      const switchAt = Number(ext.state.newMultiplierEffectiveTimestamp);
      const at = (t: number) => (t >= switchAt ? newM : oldM);
      return { current: at(Date.now() / 1000), at };
    });
  });
}

export type TokenPrice = { perRawToken: number; spreadBps: number | null; source: "jupiter-mid" | "pool-last" };

const REF_USDC = 100; // reference trade size for the live two-sided price

// Live xStock price per raw token: the midpoint of a real $100 buy quote and
// the matching sell quote on Jupiter. Pool "last trade" prices bounce between
// buy and sell prints (tens of bps), which would fake premiums and discounts.
export function liveTokenPrices(assets: Asset[]): Promise<(TokenPrice | null)[]> {
  return cached(`tok:${assets.map((a) => a.ticker)}`, 20_000, async () => {
    const mids = await Promise.all(
      assets.map(async (a) => {
        try {
          const buy = await getQuote(USDC_MINT, a.xstockMint, BigInt(REF_USDC * 10 ** USDC_DECIMALS), 50);
          const sell = await getQuote(a.xstockMint, USDC_MINT, BigInt(buy.outAmount), 50);
          const tokens = Number(buy.outAmount) / 10 ** a.xstockDecimals;
          const ask = REF_USDC / tokens;
          const bid = Number(sell.outAmount) / 10 ** USDC_DECIMALS / tokens;
          return { perRawToken: Math.sqrt(ask * bid), spreadBps: 10_000 * Math.log(ask / bid), source: "jupiter-mid" as const };
        } catch {
          return null;
        }
      }),
    );
    if (mids.every(Boolean)) return mids;
    const last = await livePoolPrices(assets.filter((_, i) => !mids[i]));
    let k = 0;
    return mids.map((m) => {
      if (m) return m;
      const p = last[k++];
      return p ? { perRawToken: p, spreadBps: null, source: "pool-last" as const } : null;
    });
  });
}

// xStock price per raw token (USD), from its main pool; Jupiter if the pool is unavailable.
export function livePoolPrices(assets: Asset[]): Promise<(number | null)[]> {
  return cached(`px:${assets.map((a) => a.ticker)}`, 15_000, async () => {
    const byPool = new Map<string, number>();
    try {
      const body = await getJson<{ data: { attributes: { address: string; base_token_price_usd: string } }[] }>(
        `${GT}/pools/multi/${assets.map((a) => a.pool).join(",")}`,
      );
      for (const p of body.data) byPool.set(p.attributes.address, Number(p.attributes.base_token_price_usd));
    } catch {
      // fall through to Jupiter
    }
    const missing = assets.filter((a) => !byPool.has(a.pool));
    if (missing.length) {
      const [jup, mults] = await Promise.all([
        getJson<Record<string, { usdPrice: number } | null>>(`${JUP_PRICE}?ids=${missing.map((a) => a.xstockMint).join(",")}`),
        multipliers(missing),
      ]);
      // Jupiter quotes per UI unit (= per share); convert to per raw token.
      missing.forEach((a, i) => {
        const p = jup[a.xstockMint]?.usdPrice;
        if (p) byPool.set(a.pool, p * mults[i].current);
      });
    }
    return assets.map((a) => byPool.get(a.pool) ?? null);
  });
}

// ---------- history ----------

type YahooChart = {
  chart: {
    result?: {
      timestamp?: number[];
      indicators: { quote: { open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[] }[] };
    }[];
    error?: { description: string } | null;
  };
};

type Seed = Record<string, { equity: Candles; pool: Candles }>;

// Snapshot written by `npm run seed`, used only if a live history source is down.
async function seedFor(ticker: string) {
  const seed = (await import("../../data/seed.json")).default as Seed;
  const s = seed[ticker];
  if (!s) throw new Error(`No seed history for ${ticker}`);
  return s;
}

async function yahooChart(ticker: string): Promise<YahooChart> {
  let last: unknown;
  for (const host of ["query1", "query2", "query1"]) {
    try {
      return await getJson<YahooChart>(
        `https://${host}.finance.yahoo.com/v8/finance/chart/${ticker}?interval=30m&range=1mo&includePrePost=true`,
        { headers: { "User-Agent": "Mozilla/5.0 (compatible; Anchor/0.1)" } },
      );
    } catch (e) {
      last = e;
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw last;
}

// Hourly average prices of the real stock, pre-market through after-hours (04:00-20:00 ET).
export function equityHistory(asset: Asset): Promise<Candles> {
  return cached(`eqh:${asset.ticker}`, 10 * 60_000, () =>
    fetchEquityHistory(asset).catch(async (e) => {
      console.warn(`equity history live fetch failed for ${asset.ticker}, using seed`, e);
      return (await seedFor(asset.ticker)).equity;
    }),
  );
}

export async function fetchEquityHistory(asset: Asset): Promise<Candles> {
  const body = await yahooChart(asset.ticker);
  const r = body.chart.result?.[0];
  if (!r?.timestamp) throw new Error(`No equity history for ${asset.ticker}`);
  const q = r.indicators.quote[0];
  const halfHours = new Map<number, number>();
  r.timestamp.forEach((start, i) => {
    const [o, h, l, c] = [q.open[i], q.high[i], q.low[i], q.close[i]];
    if (o != null && h != null && l != null && c != null) halfHours.set(start, (o + h + l + c) / 4);
  });
  // An hour counts only if both of its 30-minute bars traded.
  const out: Candles = { t: [], c: [] };
  for (const [start, first] of halfHours) {
    const second = halfHours.get(start + 1800);
    if (start % 3600 === 0 && second !== undefined) {
      out.t.push(start);
      out.c.push((first + second) / 2);
    }
  }
  return out;
}

// Hourly average prices of the xStock's main pool, per raw token.
export function poolHistory(asset: Asset): Promise<Candles> {
  return cached(`pxh:${asset.ticker}`, 10 * 60_000, () =>
    fetchPoolHistory(asset).catch(async (e) => {
      console.warn(`pool history live fetch failed for ${asset.ticker}, using seed`, e);
      return (await seedFor(asset.ticker)).pool;
    }),
  );
}

export async function fetchPoolHistory(asset: Asset, hours = 24 * 30): Promise<Candles> {
  const body = await getJson<{ data: { attributes: { ohlcv_list: [number, number, number, number, number, number][] } } }>(
    `${GT}/pools/${asset.pool}/ohlcv/hour?aggregate=1&limit=${hours}&currency=usd&token=base`,
  );
  const list = [...body.data.attributes.ohlcv_list].sort((a, b) => a[0] - b[0]);
  return { t: list.map((x) => x[0]), c: list.map(([, o, h, l, c]) => (o + h + l + c) / 4) };
}
