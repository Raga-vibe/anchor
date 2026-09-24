"use client";

import Link from "next/link";
import type { AssetGuard } from "@/lib/guard-service";
import type { Verdict } from "@/lib/guard";
import { gapPhrase, verdictLine, VERDICT_COPY } from "@/lib/explain";
import { pct, usd } from "@/lib/format";
import FairMeter from "@/components/FairMeter";
import {
  Card,
  ErrorNotice,
  Eyebrow,
  Flash,
  LiveDot,
  SessionPill,
  Skeleton,
  TokenLogo,
  usePolling,
  VerdictBadge,
  VerdictIcon,
} from "@/components/ui";

type GuardList = { asOf: number; assets: AssetGuard[] };
type Ready = AssetGuard & { guard: NonNullable<AssetGuard["guard"]> };

export default function Markets() {
  const { data, error, loading } = usePolling<GuardList>("/api/guard", 20_000);
  const ready = (data?.assets.filter((a) => a.guard) ?? []) as Ready[];
  const spotlight = ready.length ? ready.reduce((m, a) => (Math.abs(a.guard.z) > Math.abs(m.guard.z) ? a : m)) : null;

  return (
    <div className="space-y-10 sm:space-y-14">
      {/* ---------- Hero ---------- */}
      <section className="relative grid items-center gap-8 pt-2 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-8">
        <div className="dot-grid pointer-events-none absolute -inset-x-10 -top-10 h-80" aria-hidden />
        <div className="relative animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/80 px-3 py-1 text-xs text-ink-2">
            <LiveDot />
            Live on Solana · prices verified by Pyth
          </span>
          <h1 className="mt-5 font-serif text-[44px] leading-[1.02] tracking-tight sm:text-6xl">
            US stocks in dollars.
            <br />
            <em className="text-gradient pr-1">Never overpay</em>
            <br />
            for the token.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-relaxed text-ink-2">
            Tokenized stocks trade around the clock, but the real market doesn&apos;t, so the token can drift away from the
            share it represents. Anchor checks every buy against the real price and tells you, in plain words, when a price is
            unusual.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link
              href="/stock/SPY"
              className="accent-gradient inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-10px_var(--accent)] transition-transform hover:-translate-y-0.5"
            >
              Start with the S&amp;P 500
              <span aria-hidden>→</span>
            </Link>
            <Link href="/how" className="rounded-full px-1 py-3 text-sm font-medium text-ink-2 hover:text-ink sm:px-4">
              How the guard works
            </Link>
          </div>
        </div>

        <div className="relative animate-fade-up [animation-delay:120ms]">
          {spotlight ? <Spotlight a={spotlight} /> : error ? <ErrorNotice error={error} /> : <Skeleton className="h-[330px] w-full rounded-[20px]" />}
        </div>
      </section>

      {/* ---------- Markets ---------- */}
      <section className="space-y-4 animate-fade-up [animation-delay:200ms]">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="font-serif text-3xl tracking-tight">Markets</h2>
            <p className="mt-1 flex items-center gap-2 text-sm text-ink-2">
              <LiveDot /> Guard checks every 20 seconds
            </p>
          </div>
          {ready.length > 0 && <Tally assets={ready} />}
        </div>

        {error && !data && <ErrorNotice error={error} />}
        <Card className="overflow-hidden">
          <div className="hidden grid-cols-[40px_minmax(0,1.1fr)_minmax(0,1.4fr)_120px_104px] gap-4 border-b border-hairline px-5 py-3 font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted sm:grid">
            <span />
            <span>Asset</span>
            <span>Where the price sits</span>
            <span className="text-right">Per share</span>
            <span className="text-right">Guard</span>
          </div>
          <div className="divide-y divide-[var(--hairline)]">
            {loading && !data
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-5 py-5">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="ml-auto h-4 w-20" />
                  </div>
                ))
              : data?.assets.map((a) => <Row key={a.ticker} a={a} />)}
          </div>
        </Card>
        <p className="text-xs text-muted">
          Per-share price is the token&apos;s live market price, adjusted for reinvested dividends. The meter shows how far it
          sits from its usual gap to the real stock.
        </p>
      </section>

      {/* ---------- How ---------- */}
      <section className="grid gap-3 sm:grid-cols-3 animate-fade-up [animation-delay:260ms]">
        <Step n="01" title="The real price, on-chain">
          The US stock&apos;s price comes from Pyth, read straight from its price account on Solana. Anyone can verify it.
        </Step>
        <Step n="02" title="Compared to what you'd pay">
          The token&apos;s live buy and sell quotes are measured against that price and against 30 days of history for the same
          hour.
        </Step>
        <Step n="03" title="A verdict, with a receipt">
          Fair, cheaper, pricey or wait, in plain words. Every buy writes the guard&apos;s verdict into the same Solana
          transaction.
        </Step>
      </section>
    </div>
  );
}

function Spotlight({ a }: { a: Ready }) {
  const g = a.guard;
  const calm = Math.abs(g.z) < 1;
  return (
    <Card className="relative overflow-hidden p-6 shadow-float sm:p-7">
      <div
        className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-60 blur-3xl"
        style={{ background: `color-mix(in oklab, ${verdictGlow(g.verdict)} 35%, transparent)` }}
        aria-hidden
      />
      <div className="relative flex items-center justify-between gap-3">
        <Eyebrow>Right now</Eyebrow>
        <SessionPill session={a.session} staleHours={g.referenceStale ? g.hoursSinceReference : undefined} />
      </div>

      <div className="relative mt-5 flex items-center gap-3">
        <TokenLogo symbol={a.xstockSymbol} ticker={a.ticker} size={44} />
        <div>
          <div className="text-xs text-ink-2">{calm ? "Biggest gap" : "Most unusual price"}</div>
          <div className="font-semibold">
            {a.name} <span className="font-mono text-xs font-normal text-muted">{a.xstockSymbol}</span>
          </div>
        </div>
        <div className="ml-auto">
          <VerdictBadge verdict={g.verdict} size="md" />
        </div>
      </div>

      <p className="text-balance relative mt-5 font-serif text-[30px] leading-[1.08] tracking-tight sm:text-[34px]">
        {gapPhrase(g, a.ticker, a.xstockSymbol)}.
      </p>
      <p className="relative mt-2 text-sm leading-relaxed text-ink-2">{verdictLine(g)}</p>

      <div className="relative mt-3">
        <FairMeter
          z={g.z}
          verdict={g.verdict}
          size="lg"
          label={pct(g.premiumBps)}
          lowLabel={usd(g.fairLowPerShare)}
          highLabel={usd(g.fairHighPerShare)}
        />
      </div>

      <div className="relative grid grid-cols-2 gap-3 rounded-2xl border border-hairline bg-surface-2 p-3">
        <PriceCell label="Token, per share" value={g.tokenPricePerShare} />
        <PriceCell label={`Real ${a.ticker} · Pyth`} value={g.equityPrice} />
      </div>

      <Link
        href={`/stock/${a.ticker}`}
        className="relative mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-accent hover:underline"
      >
        Open {a.ticker} <span aria-hidden>→</span>
      </Link>
    </Card>
  );
}

function PriceCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-1">
      <div className="text-[11px] text-muted">{label}</div>
      <Flash value={value.toFixed(2)} className="tabular mt-0.5 block text-xl font-semibold">
        {usd(value)}
      </Flash>
    </div>
  );
}

function verdictGlow(v: Verdict) {
  return v === "wait" ? "var(--critical)" : v === "caution" ? "var(--warning)" : v === "discount" ? "var(--good)" : "var(--accent)";
}

function Tally({ assets }: { assets: Ready[] }) {
  const count = (v: Verdict) => assets.filter((a) => a.guard.verdict === v).length;
  const items: [Verdict, number][] = (["fair", "discount", "caution", "wait"] as Verdict[]).map((v) => [v, count(v)]);
  return (
    <div className="flex flex-wrap gap-2">
      {items
        .filter(([, n]) => n > 0)
        .map(([v, n]) => (
          <span key={v} className="inline-flex items-center gap-1.5 rounded-full border border-hairline bg-surface px-3 py-1 text-xs">
            <VerdictIcon verdict={v} className="h-3.5 w-3.5" />
            <span className="tabular font-semibold">{n}</span>
            <span className="text-ink-2">{VERDICT_COPY[v].label.toLowerCase()}</span>
          </span>
        ))}
    </div>
  );
}

function Row({ a }: { a: AssetGuard }) {
  const g = a.guard;
  return (
    <Link
      href={`/stock/${a.ticker}`}
      className="group grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 px-4 py-4 transition-colors hover:bg-surface-2 sm:grid-cols-[40px_minmax(0,1.1fr)_minmax(0,1.4fr)_120px_104px] sm:gap-x-4 sm:px-5"
    >
      <TokenLogo symbol={a.xstockSymbol} ticker={a.ticker} />
      <div className="min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="font-semibold">{a.ticker}</span>
          <span className="font-mono text-[11px] text-muted">{a.xstockSymbol}</span>
        </div>
        <div className="truncate text-sm text-ink-2">{a.name}</div>
      </div>

      <div className="col-span-3 row-start-2 sm:col-span-1 sm:row-start-auto">
        {g ? (
          <div className="flex items-center gap-3">
            <FairMeter z={g.z} verdict={g.verdict} />
            <span className="tabular w-14 shrink-0 text-right font-mono text-xs text-ink-2">{pct(g.premiumBps)}</span>
          </div>
        ) : (
          <span className="text-xs text-muted">{a.error ? "Price unavailable right now" : "—"}</span>
        )}
      </div>

      <div className="text-right">
        {g ? (
          <Flash value={g.tokenPricePerShare.toFixed(2)} className="tabular block font-semibold">
            {usd(g.tokenPricePerShare)}
          </Flash>
        ) : (
          <span className="text-muted">—</span>
        )}
        {g && (
          <div className="mt-1 sm:hidden">
            <VerdictBadge verdict={g.verdict} />
          </div>
        )}
      </div>

      <div className="hidden justify-end sm:flex">{g && <VerdictBadge verdict={g.verdict} />}</div>
    </Link>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <Card className="p-5">
      <div className="font-mono text-xs text-accent">{n}</div>
      <h3 className="mt-3 font-serif text-2xl leading-tight tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{children}</p>
    </Card>
  );
}
