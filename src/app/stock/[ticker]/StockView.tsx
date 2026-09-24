"use client";

import Link from "next/link";
import type { GuardResult } from "@/lib/guard";
import type { Session } from "@/lib/session";
import { explain, VERDICT_COPY } from "@/lib/explain";
import { pct, usd } from "@/lib/format";
import PremiumChart, { type ChartPoint } from "@/components/PremiumChart";
import BuyPanel from "@/components/BuyPanel";
import { Card, ErrorNotice, SessionBanner, Skeleton, usePolling, VerdictBadge, VerdictIcon, verdictWash } from "@/components/ui";

type Detail = {
  ticker: string;
  name: string;
  xstockSymbol: string;
  session: Session;
  guard: GuardResult | null;
  error?: string;
  pythAccount: string;
  pool: string;
  spreadBps: number | null;
  baseline: {
    convention: string;
    hourlyVolBps: number;
    regular: { n: number; median: number; scale: number };
    extended: { n: number; median: number; scale: number };
    closedHours: number;
  };
  series: ChartPoint[];
};

export default function StockView({ ticker, name, xstockSymbol }: { ticker: string; name: string; xstockSymbol: string }) {
  const { data, error, loading } = usePolling<Detail>(`/api/guard/${ticker}`, 20_000);
  const g = data?.guard;

  return (
    <div className="space-y-4">
      <Link href="/" className="text-sm text-ink-2 hover:text-ink">
        ← Markets
      </Link>

      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{name}</h1>
          <p className="text-sm text-ink-2">
            {ticker} · buying {xstockSymbol} (tokenized {ticker})
          </p>
        </div>
        {g && <VerdictBadge verdict={g.verdict} size="md" />}
      </div>

      {error && !data && <ErrorNotice error={error} />}
      {loading && !data && <Skeleton className="h-40 w-full" />}

      {data && g && (
        <>
          <SessionBanner session={data.session} staleHours={g.hoursSinceReference} />

          <Card className="p-4" style={{ background: verdictWash(g.verdict) }}>
            <div className="flex items-center gap-2">
              <VerdictIcon verdict={g.verdict} className="h-6 w-6" />
              <h2 className="text-xl font-semibold">{VERDICT_COPY[g.verdict].headline}</h2>
            </div>
            <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-ink-2">
              {explain(g, ticker).map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </Card>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label={`Real ${ticker}`} value={usd(g.equityPrice)} sub={g.referenceStale ? "last US trade, Pyth" : "live, Pyth on Solana"} />
            <Stat label="Token, per share" value={usd(g.tokenPricePerShare)} sub={xstockSymbol} />
            <Stat label="Premium now" value={pct(g.premiumBps)} sub={`typical ${pct(g.typicalBps)}`} />
            <Stat
              label="How unusual"
              value={`${g.z >= 0 ? "+" : "−"}${Math.abs(g.z).toFixed(1)}σ`}
              sub={
                g.referenceStale
                  ? `fair range ±${(2 * g.scaleBps / 100).toFixed(2)}%`
                  : `higher than ${Math.round(g.percentile * 100)}% of history`
              }
            />
          </div>

          <Card className="p-4">
            <div className="mb-3">
              <h2 className="font-semibold">Token premium, last 7 days</h2>
              <p className="text-xs text-ink-2">
                How far the token traded from the real stock. The gray band is what&apos;s normal for that hour; it widens
                when the US market is closed.
              </p>
            </div>
            <PremiumChart points={data.series} />
          </Card>

          <BuyPanel ticker={ticker} xstockSymbol={xstockSymbol} />

          <Card className="p-4 text-sm">
            <h2 className="font-semibold">Where these numbers come from</h2>
            <ul className="mt-2 space-y-1.5 leading-relaxed text-ink-2">
              <li>
                Real {ticker} price: Pyth, read directly from its price account on Solana.{" "}
                <a href={`https://solscan.io/account/${data.pythAccount}`} target="_blank" rel="noreferrer" className="font-medium text-accent underline underline-offset-2">
                  Verify on Solscan
                </a>
              </li>
              <li>
                Token price: midpoint of live $100 buy and sell quotes on Jupiter
                {data.spreadBps !== null && ` (spread right now: ${(Math.max(0, data.spreadBps) / 100).toFixed(2)}%)`}.
              </li>
              <li>
                History: 30 days of hourly prices from the main {xstockSymbol}/USDC pool and the US-listed stock, including pre-market
                and after-hours.
              </li>
            </ul>
          </Card>

          <details className="rounded-2xl border border-hairline bg-card p-4 text-sm">
            <summary className="cursor-pointer font-semibold">Model details</summary>
            <dl className="tabular mt-3 grid grid-cols-[1fr_auto] gap-y-1 text-ink-2">
              <dt>z-score (robust)</dt>
              <dd className="text-right text-ink">{g.z.toFixed(2)}</dd>
              <dt>Scale used (σ, incl. Pyth confidence)</dt>
              <dd className="text-right text-ink">{pct(g.scaleBps)}</dd>
              <dt>Pyth confidence interval</dt>
              <dd className="text-right text-ink">{pct(g.confidenceBps, 3)}</dd>
              <dt>Regular hours: median / σ (n)</dt>
              <dd className="text-right text-ink">
                {pct(data.baseline.regular.median)} / {pct(data.baseline.regular.scale)} ({data.baseline.regular.n})
              </dd>
              <dt>Extended hours: median / σ (n)</dt>
              <dd className="text-right text-ink">
                {pct(data.baseline.extended.median)} / {pct(data.baseline.extended.scale)} ({data.baseline.extended.n})
              </dd>
              <dt>Closed-market hours in sample</dt>
              <dd className="text-right text-ink">{data.baseline.closedHours}</dd>
              <dt>{ticker} hourly volatility</dt>
              <dd className="text-right text-ink">{pct(data.baseline.hourlyVolBps)}</dd>
              <dt>Shares per token (dividend multiplier)</dt>
              <dd className="text-right text-ink">{g.rr.toFixed(6)}</dd>
              <dt>Pool price unit (auto-detected)</dt>
              <dd className="text-right text-ink">{data.baseline.convention}</dd>
            </dl>
            <Link href="/how" className="mt-3 inline-block font-medium text-accent underline underline-offset-2">
              How the guard works
            </Link>
          </details>
        </>
      )}

      {data && !g && <ErrorNotice error={{ error: data.error ?? "No live price right now" }} />}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-3">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
      <div className="truncate text-xs text-muted">{sub}</div>
    </Card>
  );
}
