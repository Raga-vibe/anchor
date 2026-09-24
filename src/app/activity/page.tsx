"use client";

import Link from "next/link";
import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Verdict } from "@/lib/guard";
import type { AssetGuard } from "@/lib/guard-service";
import { shortAddr, usd } from "@/lib/format";
import { LogoMark } from "@/components/Brand";
import WalletButton from "@/components/WalletButton";
import { Card, ErrorNotice, Eyebrow, Skeleton, TokenLogo, usePolling, VerdictBadge } from "@/components/ui";

type Audit = {
  wallet: string;
  entries: { signature: string; blockTime: number | null; failed: boolean; symbol: string; fields: Record<string, string>; memo: string }[];
};
type Balance = { sol: number; usdc: number; holdings: { ticker: string; xstockSymbol: string; shares: number }[] };
type GuardList = { assets: AssetGuard[] };

const timeFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const VERDICTS = new Set<Verdict>(["fair", "discount", "caution", "wait"]);

export default function Activity() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const audit = usePolling<Audit>(wallet ? `/api/audit?wallet=${wallet}` : null, 30_000);
  const bal = usePolling<Balance>(wallet ? `/api/balance?wallet=${wallet}` : null, 30_000);
  const prices = usePolling<GuardList>(wallet ? "/api/guard" : null, 30_000);

  if (!wallet) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center pt-10 text-center animate-fade-up">
        <div className="relative">
          <div className="absolute inset-0 scale-150 rounded-full bg-accent opacity-25 blur-3xl" aria-hidden />
          <LogoMark size={72} />
        </div>
        <h1 className="mt-8 font-serif text-5xl leading-none tracking-tight">Your receipts live on-chain.</h1>
        <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
          Connect your wallet to see what you own and every guard decision. Each one is written into the same Solana
          transaction as your trade, so anyone can check it.
        </p>
        <div className="mt-7">
          <WalletButton />
        </div>
      </div>
    );
  }

  const byTicker = new Map(prices.data?.assets.map((a) => [a.ticker, a]) ?? []);
  const holdings = (bal.data?.holdings ?? []).map((h) => {
    const g = byTicker.get(h.ticker)?.guard;
    return { ...h, value: g ? h.shares * g.tokenPricePerShare : null, verdict: g?.verdict };
  });
  const invested = holdings.reduce((s, h) => s + (h.value ?? 0), 0);
  const total = (bal.data?.usdc ?? 0) + invested;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-3 animate-fade-up">
        <div>
          <Eyebrow>Your activity</Eyebrow>
          <h1 className="mt-2 font-serif text-5xl leading-none tracking-tight">Portfolio</h1>
        </div>
        <CopyAddress address={wallet} />
      </div>

      {/* portfolio */}
      <Card className="relative overflow-hidden p-6 shadow-float sm:p-7 animate-fade-up [animation-delay:60ms]">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-accent opacity-20 blur-3xl" aria-hidden />
        {bal.loading && !bal.data ? (
          <Skeleton className="h-24 w-full" />
        ) : bal.error && !bal.data ? (
          <ErrorNotice error={bal.error} />
        ) : (
          <>
            <div className="relative text-sm text-ink-2">Total value</div>
            <div className="tabular relative mt-1 text-5xl font-semibold tracking-tight">{usd(total)}</div>
            <div className="relative mt-5 grid grid-cols-3 gap-3">
              <Mini label="In stocks" value={usd(invested)} />
              <Mini label="Cash (USDC)" value={usd(bal.data?.usdc ?? 0)} />
              <Mini label="SOL for fees" value={(bal.data?.sol ?? 0).toFixed(4)} />
            </div>
          </>
        )}
      </Card>

      {/* holdings */}
      <section className="space-y-3 animate-fade-up [animation-delay:120ms]">
        <h2 className="font-serif text-3xl tracking-tight">Holdings</h2>
        {bal.data && holdings.length === 0 ? (
          <Card className="p-5 text-sm text-ink-2">
            No stocks yet.{" "}
            <Link href="/" className="font-medium text-accent hover:underline">
              Pick one on Markets →
            </Link>
          </Card>
        ) : (
          <Card className="divide-y divide-[var(--hairline)] overflow-hidden">
            {holdings.map((h) => (
              <Link key={h.ticker} href={`/stock/${h.ticker}`} className="flex items-center gap-3 px-4 py-4 hover:bg-surface-2 sm:px-5">
                <TokenLogo symbol={h.xstockSymbol} ticker={h.ticker} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{h.ticker}</div>
                  <div className="tabular text-sm text-ink-2">
                    {h.shares.toFixed(5)} {h.xstockSymbol}
                  </div>
                </div>
                <div className="text-right">
                  <div className="tabular font-semibold">{h.value !== null ? usd(h.value) : "—"}</div>
                  {h.verdict && (
                    <div className="mt-1">
                      <VerdictBadge verdict={h.verdict} />
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </Card>
        )}
      </section>

      {/* receipts */}
      <section className="space-y-3 animate-fade-up [animation-delay:180ms]">
        <div>
          <h2 className="font-serif text-3xl tracking-tight">Guard receipts</h2>
          <p className="mt-1 text-sm text-ink-2">Read straight from Solana, not from our servers.</p>
        </div>
        {audit.error && <ErrorNotice error={audit.error} />}
        {audit.loading && !audit.data && <Skeleton className="h-40 w-full rounded-[20px]" />}
        {audit.data && audit.data.entries.length === 0 && (
          <Card className="p-5 text-sm text-ink-2">No guarded buys yet. Your first receipt will appear here after you buy.</Card>
        )}
        <div className="grid gap-4 sm:grid-cols-2">
          {audit.data?.entries.map((e) => (
            <Receipt key={e.signature} e={e} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Receipt({ e }: { e: Audit["entries"][number] }) {
  const verdict = (VERDICTS.has(e.fields.v as Verdict) ? e.fields.v : "unknown") as Verdict;
  const ticker = e.symbol?.replace(/x$/, "") ?? "";
  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-4">
        <TokenLogo symbol={e.symbol} ticker={ticker} size={36} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Bought {e.symbol}</div>
          <div className="text-xs text-muted">{e.blockTime ? timeFmt.format(new Date(e.blockTime * 1000)) : "Pending"}</div>
        </div>
        <VerdictBadge verdict={verdict} />
      </div>
      {/* perforation */}
      <div className="relative h-px">
        <div className="absolute inset-x-4 top-0 border-t border-dashed border-hairline" />
        <div className="absolute -left-2.5 -top-2.5 h-5 w-5 rounded-full border border-hairline bg-page" />
        <div className="absolute -right-2.5 -top-2.5 h-5 w-5 rounded-full border border-hairline bg-page" />
      </div>
      <dl className="tabular grid grid-cols-3 gap-2 p-4 text-sm">
        <Field k="Token premium" v={e.fields.prem ?? "—"} />
        <Field k="Paid vs real" v={e.fields.exec ?? "—"} />
        <Field k="z-score" v={e.fields.z ?? "—"} />
      </dl>
      <div className="flex items-center justify-between gap-3 border-t border-hairline bg-surface-2 px-4 py-3">
        <code className="truncate font-mono text-[10.5px] text-muted">{e.memo}</code>
        <a
          href={`https://solscan.io/tx/${e.signature}`}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 text-xs font-semibold text-accent hover:underline"
        >
          {e.failed ? "Failed ↗" : "Solscan ↗"}
        </a>
      </div>
    </div>
  );
}

function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{k}</dt>
      <dd className="mt-0.5 font-medium">{v.replace("bp", " bp")}</dd>
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-hairline bg-surface-2 px-3 py-2.5">
      <div className="text-[11px] text-muted">{label}</div>
      <div className="tabular mt-0.5 font-semibold">{value}</div>
    </div>
  );
}

function CopyAddress({ address }: { address: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        navigator.clipboard?.writeText(address).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 font-mono text-xs text-ink-2 hover:text-ink"
    >
      <span className="h-2 w-2 rounded-full bg-good" />
      {copied ? "Copied" : shortAddr(address)}
    </button>
  );
}
