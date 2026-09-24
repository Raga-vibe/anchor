"use client";

import Link from "next/link";
import type { AssetGuard } from "@/lib/guard-service";
import { pct, usd } from "@/lib/format";
import { Card, ErrorNotice, SessionBanner, Skeleton, usePolling, VerdictBadge } from "@/components/ui";

type GuardList = { asOf: number; assets: AssetGuard[] };

export default function Markets() {
  const { data, error, loading } = usePolling<GuardList>("/api/guard", 20_000);
  const first = data?.assets.find((a) => a.guard);

  return (
    <div className="space-y-5">
      <section className="space-y-2 pt-2">
        <h1 className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          Own US stocks in dollars.
          <br />
          <span className="text-ink-2">Never overpay for the token.</span>
        </h1>
        <p className="max-w-xl text-sm leading-relaxed text-ink-2">
          Tokenized stocks trade 24/7, but the real market doesn&apos;t, so the token can drift away from the stock.
          Before every buy, Anchor checks the token against the real stock price from Pyth and tells you if the price is
          unusual.
        </p>
      </section>

      {first && <SessionBanner session={first.session} staleHours={first.guard?.hoursSinceReference} />}
      {error && !data && <ErrorNotice error={error} />}

      <Card className="divide-y divide-[var(--hairline)] overflow-hidden">
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 px-4 py-2 text-xs font-medium text-muted">
          <span>Asset</span>
          <span className="text-right">Token price / share</span>
          <span className="w-[92px] text-right">vs real stock</span>
        </div>
        {loading && !data
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-4 py-4">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-5 w-24" />
              </div>
            ))
          : data?.assets.map((a) => <Row key={a.ticker} a={a} />)}
      </Card>

      <p className="text-xs text-muted">
        Prices refresh every 20 seconds. &ldquo;vs real stock&rdquo; is the token&apos;s premium over the US-listed share,
        adjusted for reinvested dividends.
      </p>
    </div>
  );
}

function Row({ a }: { a: AssetGuard }) {
  const g = a.guard;
  return (
    <Link href={`/stock/${a.ticker}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[var(--band)]">
      <div className="min-w-0">
        <div className="font-semibold">{a.ticker}</div>
        <div className="truncate text-sm text-ink-2">
          {a.name} · {a.xstockSymbol}
        </div>
      </div>
      <div className="tabular text-right">{g ? usd(g.tokenPricePerShare) : "—"}</div>
      <div className="flex w-[92px] flex-col items-end gap-1">
        {g ? (
          <>
            <VerdictBadge verdict={g.verdict} />
            <span className="tabular text-xs text-ink-2">{pct(g.premiumBps)}</span>
          </>
        ) : (
          <span className="text-xs text-muted">{a.error ? "Unavailable" : "—"}</span>
        )}
      </div>
    </Link>
  );
}
