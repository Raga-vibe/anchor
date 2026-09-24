"use client";

import WalletButton from "@/components/WalletButton";
import { useWallet } from "@solana/wallet-adapter-react";
import type { Verdict } from "@/lib/guard";
import { shortAddr, usd } from "@/lib/format";
import { Card, ErrorNotice, Skeleton, usePolling, VerdictBadge } from "@/components/ui";


type Audit = {
  wallet: string;
  entries: { signature: string; blockTime: number | null; failed: boolean; symbol: string; fields: Record<string, string>; memo: string }[];
};
type Balance = { sol: number; usdc: number; holdings: { ticker: string; xstockSymbol: string; shares: number }[] };

const timeFmt = new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" });

export default function Activity() {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const audit = usePolling<Audit>(wallet ? `/api/audit?wallet=${wallet}` : null);
  const bal = usePolling<Balance>(wallet ? `/api/balance?wallet=${wallet}` : null);

  if (!wallet) {
    return (
      <div className="space-y-4 pt-4 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Your activity</h1>
        <p className="text-sm text-ink-2">Connect your wallet to see your holdings and every guard decision recorded on-chain.</p>
        <div className="flex justify-center">
          <WalletButton />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Your activity</h1>
        <p className="text-sm text-ink-2">Wallet {shortAddr(wallet)}</p>
      </div>

      <Card className="p-4">
        <h2 className="font-semibold">Holdings</h2>
        {bal.loading && !bal.data ? (
          <Skeleton className="mt-3 h-12 w-full" />
        ) : bal.data ? (
          <dl className="tabular mt-2 grid grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-ink-2">USDC</dt>
            <dd className="text-right">{usd(bal.data.usdc)}</dd>
            {bal.data.holdings.map((h) => (
              <div key={h.ticker} className="contents">
                <dt className="text-ink-2">{h.xstockSymbol}</dt>
                <dd className="text-right">{h.shares.toFixed(5)} shares</dd>
              </div>
            ))}
            <dt className="text-ink-2">SOL (for fees)</dt>
            <dd className="text-right">{bal.data.sol.toFixed(4)}</dd>
          </dl>
        ) : (
          bal.error && <ErrorNotice error={bal.error} />
        )}
      </Card>

      <div>
        <h2 className="font-semibold">Guard decisions on-chain</h2>
        <p className="text-sm text-ink-2">
          Every Anchor buy carries a memo with the guard&apos;s verdict, read here straight from Solana. Anyone can verify it.
        </p>
      </div>

      {audit.error && <ErrorNotice error={audit.error} />}
      {audit.loading && !audit.data && <Skeleton className="h-24 w-full" />}
      {audit.data && audit.data.entries.length === 0 && (
        <Card className="p-4 text-sm text-ink-2">No guarded buys yet. Pick a stock on the Markets tab to make your first one.</Card>
      )}
      <div className="space-y-3">
        {audit.data?.entries.map((e) => (
          <Card key={e.signature} className="p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold">{e.symbol}</span>
              <VerdictBadge verdict={(e.fields.v as Verdict) ?? "unknown"} />
            </div>
            <dl className="tabular mt-2 grid grid-cols-2 gap-y-1 text-ink-2">
              <dt>When</dt>
              <dd className="text-right text-ink">{e.blockTime ? timeFmt.format(new Date(e.blockTime * 1000)) : "—"}</dd>
              <dt>Token premium</dt>
              <dd className="text-right text-ink">{e.fields.prem}</dd>
              <dt>Paid vs real stock</dt>
              <dd className="text-right text-ink">{e.fields.exec}</dd>
              <dt>z-score</dt>
              <dd className="text-right text-ink">{e.fields.z}</dd>
              <dt>Session</dt>
              <dd className="text-right text-ink">{e.fields.sess}</dd>
            </dl>
            <a href={`https://solscan.io/tx/${e.signature}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-accent underline underline-offset-2">
              {e.failed ? "Failed transaction" : "View transaction"}
            </a>
          </Card>
        ))}
      </div>
    </div>
  );
}
