// Server-only Pyth Pro client. The API key must never reach the browser, so
// everything here is imported from route handlers / server components only.
import "server-only";

const ROUTER_URL = "https://pyth-lazer.dourolabs.app/v1";
const HISTORY_URL = "https://pyth.dourolabs.app/v1";
const CHANNEL = "fixed_rate@200ms";

export class MissingPythKeyError extends Error {
  constructor() {
    super("PYTH_PRO_API_KEY is not set. Add it to .env.local (see .env.example).");
  }
}

function apiKey(): string {
  const key = process.env.PYTH_PRO_API_KEY;
  if (!key) throw new MissingPythKeyError();
  return key;
}

export type MarketSession = "regular" | "preMarket" | "postMarket" | "overNight" | "closed";

export type LatestFeed = {
  id: number;
  price: number | null;
  confidence: number | null;
  marketSession: MarketSession | null;
  // When this price was actually produced. Pyth carries the last price forward
  // off-hours, so this can be far behind `timestampMs`.
  updatedAtMs: number | null;
  publisherCount: number | null;
};

export type LatestSnapshot = {
  timestampMs: number;
  feeds: Map<number, LatestFeed>;
};

type RawFeed = {
  priceFeedId: number;
  price?: string | number | null;
  confidence?: string | number | null;
  exponent?: number | null;
  marketSession?: MarketSession | null;
  feedUpdateTimestamp?: string | number | null;
  publisherCount?: number | null;
};

function scale(mantissa: string | number | null | undefined, expo: number | null | undefined) {
  if (mantissa === null || mantissa === undefined || expo === null || expo === undefined) return null;
  return Number(mantissa) * 10 ** expo;
}

export async function fetchLatest(ids: number[]): Promise<LatestSnapshot> {
  const res = await fetch(`${ROUTER_URL}/latest_price`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      priceFeedIds: ids,
      properties: ["price", "confidence", "exponent", "marketSession", "feedUpdateTimestamp", "publisherCount"],
      formats: [],
      channel: CHANNEL,
      parsed: true,
      jsonBinaryEncoding: "hex",
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Pyth latest_price ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { parsed?: { timestampUs: string; priceFeeds: RawFeed[] } };
  if (!body.parsed) throw new Error("Pyth latest_price returned no parsed payload");

  const feeds = new Map<number, LatestFeed>();
  for (const f of body.parsed.priceFeeds) {
    feeds.set(f.priceFeedId, {
      id: f.priceFeedId,
      price: scale(f.price, f.exponent),
      confidence: scale(f.confidence, f.exponent),
      marketSession: f.marketSession ?? null,
      updatedAtMs: f.feedUpdateTimestamp ? Number(f.feedUpdateTimestamp) / 1000 : null,
      publisherCount: f.publisherCount ?? null,
    });
  }
  return { timestampMs: Number(body.parsed.timestampUs) / 1000, feeds };
}

export type Candles = { t: number[]; c: number[] }; // t in unix seconds

// Hourly (or other resolution) OHLC closes from the Pyth Pro History API.
export async function fetchCandles(
  symbol: string,
  fromSec: number,
  toSec: number,
  resolution: "5" | "15" | "60" = "60",
): Promise<Candles> {
  const url = new URL(`${HISTORY_URL}/${CHANNEL}/history`);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("from", String(Math.floor(fromSec)));
  url.searchParams.set("to", String(Math.floor(toSec)));
  url.searchParams.set("resolution", resolution);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey()}` },
    // Hourly candles barely change; cache for 5 minutes.
    next: { revalidate: 300 },
  });
  if (!res.ok) throw new Error(`Pyth history ${symbol} ${res.status}: ${await res.text()}`);
  const body = (await res.json()) as { s: string; t?: number[]; c?: number[]; errmsg?: string };
  if (body.s === "no_data") return { t: [], c: [] };
  if (body.s !== "ok" || !body.t || !body.c) throw new Error(`Pyth history ${symbol}: ${body.errmsg ?? body.s}`);
  return { t: body.t, c: body.c };
}
