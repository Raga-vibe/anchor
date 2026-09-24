"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GuardResult } from "@/lib/guard";
import type { Session } from "@/lib/session";
import { details, gapPhrase, verdictLine, VERDICT_COPY } from "@/lib/explain";
import { pct, usd } from "@/lib/format";
import FairMeter from "@/components/FairMeter";
import PremiumChart, { type ChartPoint, type ChartRange } from "@/components/PremiumChart";
import BuyPanel from "@/components/BuyPanel";
import BuySheet from "@/components/BuySheet";
import {
  Card,
  ErrorNotice,
  Eyebrow,
  Flash,
  SessionPill,
  Skeleton,
  TokenLogo,
  usePolling,
  VERDICT_COLOR,
  VerdictBadge,
  VerdictIcon,
} from "@/components/ui";

type Detail = {
  ticker: string;
  name: string;
  xstockSymbol: string;
  session: Session;
  guard: GuardResult | null;
  error?: string;
  pythAccount: string;
  pool: string;
  xstockMint: string;
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

const RANGES: { id: ChartRange; hours: number }[] = [
  { id: "1D", hours: 24 },
  { id: "7D", hours: 24 * 7 },
  { id: "30D", hours: 24 * 31 },
];

function useIsDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(m.matches);
    update();
    m.addEventListener("change", update);
    return () => m.removeEventListener("change", update);
  }, []);
  return desktop;
}

export default function StockView({ ticker, name, xstockSymbol }: { ticker: string; name: string; xstockSymbol: string }) {
  const { data, error, loading } = usePolling<Detail>(`/api/guard/${ticker}`, 20_000);
  const [range, setRange] = useState<ChartRange>("7D");
  const desktop = useIsDesktop();
  const g = data?.guard;

  const points = useMemo(() => {
    if (!data) return [];
    const hrs = RANGES.find((r) => r.id === range)!.hours;
    const since = Date.now() / 1000 - hrs * 3600;
    return data.series.filter((p) => p.t >= since);
  }, [data, range]);

  const buy = <BuyPanel ticker={ticker} xstockSymbol={xstockSymbol} marketVerdict={g?.verdict} perShare={g?.tokenPricePerShare} />;

  return (
    <div className="space-y-6">
      <Link href="/" className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
        <span aria-hidden>←</span> Markets
      </Link>

      {/* header */}
      <div className="flex items-center gap-4 animate-fade-up">
        <TokenLogo symbol={xstockSymbol} ticker={ticker} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-serif text-4xl leading-none tracking-tight sm:text-5xl">{name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-2">
            <span className="font-mono text-xs">{ticker}</span>
            <span className="text-muted">·</span>
            <span className="font-mono text-xs">{xstockSymbol}</span>
            {data && <SessionPill session={data.session} staleHours={g?.referenceStale ? g.hoursSinceReference : undefined} />}
          </div>
        </div>
      </div>

      {error && !data && <ErrorNotice error={error} />}
      {loading && !data && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[420px] w-full rounded-[20px]" />
          <Skeleton className="hidden h-[420px] w-full rounded-[20px] lg:block" />
        </div>
      )}
      {data && !g && <ErrorNotice error={{ error: data.error ?? "No live price right now" }} />}

      {data && g && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-6">
            {/* verdict hero */}
            <Card className="relative overflow-hidden p-6 shadow-float sm:p-7 animate-fade-up [animation-delay:60ms]">
              <div
                className="pointer-events-none absolute -left-20 -top-28 h-72 w-72 rounded-full opacity-70 blur-3xl"
                style={{ background: `color-mix(in oklab, ${VERDICT_COLOR[g.verdict].fg} 22%, transparent)` }}
                aria-hidden
              />
              <div className="relative flex items-start justify-between gap-3">
                <Eyebrow>Fair-price guard</Eyebrow>
                <VerdictBadge verdict={g.verdict} size="md" />
              </div>
              <h2 className="relative mt-4 flex items-center gap-3 font-serif text-5xl leading-none tracking-tight sm:text-6xl">
                <VerdictIcon verdict={g.verdict} className="h-9 w-9 shrink-0 sm:h-11 sm:w-11" />
                {VERDICT_COPY[g.verdict].headline}
              </h2>
              <p className="relative mt-4 max-w-xl text-[15px] leading-relaxed text-ink-2">
                <span className="text-ink">{gapPhrase(g, ticker, xstockSymbol)}.</span> {verdictLine(g)}
              </p>

              <div className="relative mt-4">
                <FairMeter
                  z={g.z}
                  verdict={g.verdict}
                  size="lg"
                  label={pct(g.premiumBps)}
                  lowLabel={usd(g.fairLowPerShare)}
                  highLabel={usd(g.fairHighPerShare)}
                />
              </div>

              <div className="relative grid grid-cols-3 divide-x divide-[var(--hairline)] rounded-2xl border border-hairline bg-surface-2">
                <Price label="Token" value={g.tokenPricePerShare} sub="per share" />
                <Price label={`Real ${ticker}`} value={g.equityPrice} sub={g.referenceStale ? "Pyth · last" : "Pyth · live"} />
                <div className="min-w-0 px-3 py-3 sm:px-4">
                  <div className="text-[11px] text-muted">Gap</div>
                  <Flash value={g.premiumBps.toFixed(1)} className="tabular mt-0.5 block text-lg font-semibold sm:text-xl">
                    {pct(g.premiumBps)}
                  </Flash>
                  <div className="truncate font-mono text-[10.5px] text-muted">usual {pct(g.typicalBps)}</div>
                </div>
              </div>

              <ul className="relative mt-4 space-y-1.5 text-sm text-ink-2">
                {details(g, ticker).map((l) => (
                  <li key={l} className="flex gap-2">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted" />
                    {l}
                  </li>
                ))}
              </ul>
            </Card>

            {/* stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 animate-fade-up [animation-delay:120ms]">
              <Stat
                label="How unusual"
                value={`${g.z >= 0 ? "+" : "−"}${Math.abs(g.z).toFixed(1)}σ`}
                sub={g.referenceStale ? "vs the widened range" : `above ${Math.round(g.percentile * 100)}% of history`}
              />
              <Stat label="Normal range" value={`±${((2 * g.scaleBps) / 100).toFixed(2)}%`} sub="around the usual gap" />
              <Stat
                label="Swap spread"
                value={data.spreadBps !== null ? `${(Math.max(0, data.spreadBps) / 100).toFixed(2)}%` : "—"}
                sub="on a $100 trade"
              />
              <Stat label="Shares per token" value={g.rr.toFixed(4)} sub="rises with dividends" />
            </div>

            {/* chart */}
            <Card className="p-5 sm:p-6 animate-fade-up [animation-delay:160ms]">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-serif text-2xl tracking-tight">Token vs real stock</h3>
                  <p className="mt-1 max-w-md text-xs leading-relaxed text-ink-2">
                    How far {xstockSymbol} traded from real {ticker}, hour by hour. The shaded band is what&apos;s normal for that
                    hour. It widens while the US market is closed, because the real price can drift.
                  </p>
                </div>
                <div className="flex rounded-full border border-hairline bg-surface-2 p-0.5">
                  {RANGES.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => setRange(r.id)}
                      className={`rounded-full px-3 py-1 font-mono text-xs transition-colors ${
                        range === r.id ? "bg-ink text-page" : "text-ink-2 hover:text-ink"
                      }`}
                    >
                      {r.id}
                    </button>
                  ))}
                </div>
              </div>
              <PremiumChart points={points} range={range} />
            </Card>

            {/* sources */}
            <Card className="p-5 sm:p-6">
              <h3 className="font-serif text-2xl tracking-tight">Where these numbers come from</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <Source tag="Pyth" title={`Real ${ticker} price`}>
                  Read directly from Pyth&apos;s price account on Solana, with its confidence interval.{" "}
                  <a
                    href={`https://solscan.io/account/${data.pythAccount}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-accent hover:underline"
                  >
                    Verify ↗
                  </a>
                </Source>
                <Source tag="Jupiter" title="Token price">
                  Midpoint of live $100 buy and sell quotes: what you could actually trade at right now.
                </Source>
                <Source tag="30 days" title="What's normal">
                  Hourly history of the main {xstockSymbol}/USDC pool against the US-listed stock, including pre- and after-hours.
                </Source>
              </div>
            </Card>

            <details className="card group p-5 text-sm sm:p-6">
              <summary className="flex cursor-pointer list-none items-center justify-between font-medium">
                Model details
                <span className="text-lg text-muted transition-transform group-open:rotate-45">+</span>
              </summary>
              <dl className="tabular mt-4 grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-ink-2">
                <dt>z-score (robust)</dt>
                <dd className="text-right text-ink">{g.z.toFixed(2)}</dd>
                <dt>σ used (incl. Pyth confidence)</dt>
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
                <dt>Pool price unit (auto-detected)</dt>
                <dd className="text-right font-mono text-xs text-ink">{data.baseline.convention}</dd>
              </dl>
              <Link href="/how" className="mt-4 inline-block font-medium text-accent hover:underline">
                How the guard works →
              </Link>
            </details>
          </div>

          {/* desktop: sticky order panel */}
          {desktop && (
            <aside className="sticky top-24">
              <Card className="p-5 shadow-float">{buy}</Card>
            </aside>
          )}
        </div>
      )}

      {/* phone/tablet: bottom bar + sheet */}
      {data && g && !desktop && (
        <>
          <div className="h-20" aria-hidden />
          <BuySheet ticker={ticker} perShare={g.tokenPricePerShare} verdict={g.verdict}>
            {buy}
          </BuySheet>
        </>
      )}
    </div>
  );
}

function Price({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="min-w-0 px-3 py-3 sm:px-4">
      <div className="truncate text-[11px] text-muted">{label}</div>
      <Flash value={value.toFixed(2)} className="tabular mt-0.5 block text-lg font-semibold sm:text-xl">
        {usd(value)}
      </Flash>
      <div className="truncate font-mono text-[10.5px] text-muted">{sub}</div>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-ink-2">{label}</div>
      <div className="tabular mt-1 text-xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 truncate text-[11px] text-muted">{sub}</div>
    </Card>
  );
}

function Source({ tag, title, children }: { tag: string; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface-2 p-4">
      <span className="rounded-full bg-accent-wash px-2 py-0.5 font-mono text-[10.5px] font-medium text-accent">{tag}</span>
      <div className="mt-2.5 font-medium">{title}</div>
      <p className="mt-1 text-xs leading-relaxed text-ink-2">{children}</p>
    </div>
  );
}
