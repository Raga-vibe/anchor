"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import type { Verdict } from "@/lib/guard";
import type { GuardedQuote } from "@/lib/trade";
import { VERDICT_COPY } from "@/lib/explain";
import { pct, usd } from "@/lib/format";
import WalletButton from "./WalletButton";
import { VERDICT_COLOR, VerdictBadge, VerdictIcon } from "./ui";

const PRESETS = [10, 25, 50, 100];

type SendResult = { signature: string; status: "confirmed" | "pending" | "failed"; error?: string; memo: string; shares: number };

function b64ToBytes(s: string) {
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
function bytesToB64(b: Uint8Array) {
  let s = "";
  for (const x of b) s += String.fromCharCode(x);
  return btoa(s);
}

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body as T;
}

type Props = { ticker: string; xstockSymbol: string; marketVerdict?: Verdict; perShare?: number };

export default function BuyPanel({ ticker, xstockSymbol, marketVerdict, perShare }: Props) {
  const { publicKey, signTransaction, connected } = useWallet();
  const [amount, setAmount] = useState("25");
  const [quote, setQuote] = useState<GuardedQuote | null>(null);
  const [busy, setBusy] = useState<null | "quote" | "sign" | "send">(null);
  const [err, setErr] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [balance, setBalance] = useState<{ wallet: string; usdc: number } | null>(null);

  const usdc = Number(amount);
  const valid = usdc >= 1 && usdc <= 1000;
  const wallet = publicKey?.toBase58() ?? null;
  const usdcBal = balance && balance.wallet === wallet ? balance.usdc : null;

  useEffect(() => {
    if (!wallet) return;
    getJson<{ usdc: number }>(`/api/balance?wallet=${wallet}`)
      .then((b) => setBalance({ wallet, usdc: b.usdc }))
      .catch(() => setBalance(null));
  }, [wallet, result]);

  // A changed amount invalidates the quote.
  function changeAmount(value: string) {
    setAmount(value);
    setQuote(null);
    setAck(false);
    setErr(null);
  }

  async function review() {
    setErr(null);
    setResult(null);
    setBusy("quote");
    try {
      setQuote(await getJson<GuardedQuote>(`/api/quote?ticker=${ticker}&usdc=${usdc}`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  async function buy() {
    if (!publicKey || !signTransaction) return;
    setErr(null);
    try {
      // Always re-quote right before signing: Jupiter quotes go stale in seconds.
      setBusy("quote");
      const fresh = await getJson<GuardedQuote>(`/api/quote?ticker=${ticker}&usdc=${usdc}`);
      setQuote(fresh);
      if (fresh.exec.verdict === "wait" && !ack) {
        setBusy(null);
        return;
      }
      const built = await getJson<{ transaction: string; memo: string }>("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, userPublicKey: publicKey.toBase58(), quote: fresh.quote }),
      });
      setBusy("sign");
      const tx = VersionedTransaction.deserialize(b64ToBytes(built.transaction));
      const signed = await signTransaction(tx);
      setBusy("send");
      const sent = await getJson<Omit<SendResult, "memo" | "shares">>("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: bytesToB64(signed.serialize()) }),
      });
      if (sent.status === "failed") setErr(`The transaction failed on-chain: ${sent.error}`);
      else setResult({ ...sent, memo: built.memo, shares: fresh.sharesOut });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setErr(/reject|denied|cancel/i.test(msg) ? "You cancelled the signature in your wallet." : msg);
    } finally {
      setBusy(null);
    }
  }

  if (result) return <Success result={result} ticker={ticker} xstockSymbol={xstockSymbol} onAgain={() => setResult(null)} />;

  const v = quote?.exec.verdict;
  const needsAck = v === "wait";
  const short = usdcBal !== null && usdcBal < usdc;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-serif text-[28px] leading-none tracking-tight">Buy {ticker}</h2>
        {usdcBal !== null && (
          <span className="tabular rounded-full bg-surface-2 px-2.5 py-1 text-xs text-ink-2 ring-1 ring-hairline">
            {usd(usdcBal)} USDC
          </span>
        )}
      </div>

      {/* amount */}
      <div className="mt-4 rounded-2xl border border-hairline bg-surface-2 px-4 pb-4 pt-3 text-center">
        <div className="text-xs text-muted">You pay</div>
        <label className="mt-1 flex items-baseline justify-center gap-0.5">
          <span className="text-3xl font-medium text-muted">$</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => changeAmount(e.target.value.replace(/[^0-9.]/g, "").slice(0, 7))}
            className="tabular bg-transparent text-center text-5xl font-semibold tracking-tight outline-none"
            style={{ width: `${Math.max(2, amount.length) + 0.3}ch` }}
            aria-label="Amount in USDC"
          />
        </label>
        <div className="text-xs text-muted">USDC</div>
        <div className="mt-3 flex justify-center gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => changeAmount(String(p))}
              className={`rounded-full px-3 py-1 text-sm transition-colors ${
                usdc === p ? "bg-ink text-page" : "bg-surface text-ink-2 ring-1 ring-hairline hover:text-ink"
              }`}
            >
              ${p}
            </button>
          ))}
        </div>
      </div>

      {/* estimate before quoting */}
      {!quote && perShare && valid && (
        <div className="mt-3 flex items-center justify-between px-1 text-sm">
          <span className="text-ink-2">You get about</span>
          <span className="tabular font-medium">
            {(usdc / perShare).toFixed(5)} {xstockSymbol}
          </span>
        </div>
      )}
      {!quote && marketVerdict && (
        <div className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 text-sm" style={{ background: VERDICT_COLOR[marketVerdict].wash }}>
          <VerdictIcon verdict={marketVerdict} />
          <span>
            Guard says: <b>{VERDICT_COPY[marketVerdict].headline.replace(".", "")}</b> right now
          </span>
        </div>
      )}

      {!quote && (
        <button
          onClick={review}
          disabled={!valid || busy !== null}
          className="accent-gradient mt-4 w-full rounded-2xl py-3.5 font-semibold text-white shadow-[0_10px_30px_-12px_var(--accent)] transition-opacity disabled:opacity-40"
        >
          {busy === "quote" ? "Checking the price…" : "Review order"}
        </button>
      )}

      {/* receipt */}
      {quote && (
        <div className="mt-4 space-y-3 animate-fade-up">
          <div className="rounded-2xl p-4" style={{ background: VERDICT_COLOR[quote.exec.verdict].wash }}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-serif text-2xl leading-none">{VERDICT_COPY[quote.exec.verdict].headline}</span>
              <VerdictBadge verdict={quote.exec.verdict} />
            </div>
            <p className="mt-2 text-sm text-ink-2">
              {quote.exec.dollarsOverFair > 0.005
                ? `This order costs about ${usd(quote.exec.dollarsOverFair)} more than buying at the usual fair price.`
                : `This order is at or below the usual fair price. You save about ${usd(Math.abs(quote.exec.dollarsOverFair))}.`}
            </p>
          </div>

          <dl className="tabular divide-y divide-[var(--hairline)] rounded-2xl border border-hairline text-sm">
            <Line k="You get" v={`${quote.sharesOut.toFixed(5)} ${xstockSymbol}`} strong />
            <Line k="Price per share" v={usd(quote.exec.execPerShare)} />
            <Line k={`Real ${ticker} · Pyth`} v={usd(quote.guard.equityPrice)} />
            <Line k="Token premium" v={pct(quote.guard.premiumBps)} />
            <Line k="Swap cost (spread + impact)" v={pct(quote.exec.swapCostBps)} />
            <Line k="Route" v={quote.route.join(" → ")} />
          </dl>

          {needsAck && (
            <label className="flex items-start gap-2.5 rounded-xl border border-hairline p-3 text-sm">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[var(--critical)]" />
              <span>I understand the token is unusually expensive right now and I still want to buy.</span>
            </label>
          )}

          {!connected ? (
            <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-hairline p-4">
              <WalletButton />
              <span className="text-xs text-muted">Connect a Solana wallet to place this order</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={review}
                disabled={busy !== null}
                className="rounded-2xl px-4 py-3.5 text-sm font-medium text-ink-2 ring-1 ring-hairline hover:text-ink disabled:opacity-40"
                aria-label="Refresh quote"
              >
                ↻
              </button>
              <button
                onClick={buy}
                disabled={busy !== null || (needsAck && !ack) || short}
                className={`flex-1 rounded-2xl py-3.5 font-semibold transition-opacity disabled:opacity-40 ${
                  needsAck ? "bg-critical text-white" : "accent-gradient text-white shadow-[0_10px_30px_-12px_var(--accent)]"
                }`}
              >
                {busy === "sign"
                  ? "Approve in your wallet…"
                  : busy === "send"
                    ? "Confirming on Solana…"
                    : busy === "quote"
                      ? "Re-checking the price…"
                      : short
                        ? "Not enough USDC"
                        : needsAck
                          ? "Buy anyway"
                          : `Buy ${usd(usdc, usdc % 1 ? 2 : 0)} of ${ticker}`}
              </button>
            </div>
          )}
          <p className="text-center text-[11px] text-muted">The guard&apos;s verdict is written on-chain with your trade.</p>
        </div>
      )}

      {err && (
        <p className="mt-3 break-words rounded-xl p-3 text-sm" style={{ background: "var(--critical-wash)" }}>
          {err}
        </p>
      )}
    </div>
  );
}

function Line({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <dt className="text-ink-2">{k}</dt>
      <dd className={`truncate text-right ${strong ? "font-semibold" : ""}`}>{v}</dd>
    </div>
  );
}

function Success({ result, ticker, xstockSymbol, onAgain }: { result: SendResult; ticker: string; xstockSymbol: string; onAgain: () => void }) {
  return (
    <div className="animate-fade-up text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--good-wash)" }}>
        <svg viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="var(--good)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" />
        </svg>
      </div>
      <h2 className="mt-4 font-serif text-3xl tracking-tight">{result.status === "confirmed" ? "You own it." : "Submitted."}</h2>
      <p className="mt-1 text-sm text-ink-2">
        {result.status === "confirmed" ? "Bought" : "Buying"} {result.shares.toFixed(5)} {xstockSymbol}, tokenized {ticker}.
      </p>
      <div className="mt-5 rounded-2xl border border-dashed border-hairline p-4 text-left">
        <div className="font-mono text-[10.5px] uppercase tracking-[0.12em] text-muted">Guard receipt · on-chain memo</div>
        <code className="mt-2 block break-all font-mono text-xs leading-relaxed text-ink">{result.memo}</code>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <a
          href={`https://solscan.io/tx/${result.signature}`}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl bg-ink py-3 text-sm font-semibold text-page"
        >
          View on Solscan
        </a>
        <Link href="/activity" className="rounded-2xl py-3 text-sm font-medium text-ink-2 ring-1 ring-hairline hover:text-ink">
          See all your receipts
        </Link>
        <button onClick={onAgain} className="py-2 text-sm text-muted hover:text-ink">
          Buy more
        </button>
      </div>
    </div>
  );
}
