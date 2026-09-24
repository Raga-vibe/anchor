"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useWallet } from "@solana/wallet-adapter-react";
import { VersionedTransaction } from "@solana/web3.js";
import type { GuardedQuote } from "@/lib/trade";
import { VERDICT_COPY } from "@/lib/explain";
import { pct, usd } from "@/lib/format";
import { Card, VerdictBadge, verdictWash } from "./ui";

const WalletMultiButton = dynamic(
  () => import("@solana/wallet-adapter-react-ui").then((m) => m.WalletMultiButton),
  { ssr: false },
);

const PRESETS = [10, 25, 50];

type SendResult = { signature: string; status: "confirmed" | "pending" | "failed"; error?: string; memo: string };

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

export default function BuyPanel({ ticker, xstockSymbol }: { ticker: string; xstockSymbol: string }) {
  const { publicKey, signTransaction, connected } = useWallet();
  const [amount, setAmount] = useState("25");
  const [quote, setQuote] = useState<GuardedQuote | null>(null);
  const [busy, setBusy] = useState<null | "quote" | "sign" | "send">(null);
  const [err, setErr] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [result, setResult] = useState<SendResult | null>(null);
  const [usdcBal, setUsdcBal] = useState<number | null>(null);

  const usdc = Number(amount);

  useEffect(() => {
    if (!publicKey) return setUsdcBal(null);
    getJson<{ usdc: number }>(`/api/balance?wallet=${publicKey.toBase58()}`)
      .then((b) => setUsdcBal(b.usdc))
      .catch(() => setUsdcBal(null));
  }, [publicKey, result]);

  // A changed amount invalidates the quote.
  useEffect(() => {
    setQuote(null);
    setAck(false);
  }, [amount]);

  async function check() {
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
      const sent = await getJson<Omit<SendResult, "memo">>("/api/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transaction: bytesToB64(signed.serialize()) }),
      });
      setResult({ ...sent, memo: built.memo });
      if (sent.status === "failed") setErr(`Transaction failed: ${sent.error}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  }

  const v = quote?.exec.verdict;
  const needsAck = v === "wait";

  return (
    <Card className="p-4">
      <div className="flex items-baseline justify-between">
        <h2 className="font-semibold">Buy {ticker}</h2>
        {usdcBal !== null && <span className="tabular text-xs text-ink-2">Balance {usd(usdcBal)} USDC</span>}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <label className="flex flex-1 items-center rounded-xl border border-hairline bg-page px-3 focus-within:border-ink">
          <span className="text-ink-2">$</span>
          <input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
            className="tabular w-full bg-transparent px-1 py-2.5 text-lg outline-none"
            aria-label="Amount in USDC"
          />
          <span className="text-sm text-muted">USDC</span>
        </label>
      </div>
      <div className="mt-2 flex gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            onClick={() => setAmount(String(p))}
            className={`rounded-full border px-3 py-1 text-sm ${usdc === p ? "border-ink bg-ink text-page" : "border-hairline text-ink-2 hover:border-ink"}`}
          >
            ${p}
          </button>
        ))}
      </div>

      {!quote && (
        <button
          onClick={check}
          disabled={!(usdc >= 1) || busy !== null}
          className="mt-4 w-full rounded-xl bg-button py-3 font-semibold text-button-ink disabled:opacity-40"
        >
          {busy === "quote" ? "Checking price…" : "Check price"}
        </button>
      )}

      {quote && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl p-3" style={{ background: verdictWash(quote.exec.verdict) }}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{VERDICT_COPY[quote.exec.verdict].headline}</span>
              <VerdictBadge verdict={quote.exec.verdict} />
            </div>
            <p className="mt-1 text-sm text-ink-2">
              {quote.exec.dollarsOverFair > 0.005
                ? `This order costs about ${usd(quote.exec.dollarsOverFair)} more than buying at the usual fair price.`
                : `This order is at or below the usual fair price.`}
            </p>
          </div>

          <dl className="tabular grid grid-cols-2 gap-y-1.5 text-sm">
            <dt className="text-ink-2">You pay</dt>
            <dd className="text-right">{usd(quote.usdcIn)} USDC</dd>
            <dt className="text-ink-2">You get</dt>
            <dd className="text-right">
              {quote.sharesOut.toFixed(5)} {xstockSymbol}
            </dd>
            <dt className="text-ink-2">Price per share</dt>
            <dd className="text-right">{usd(quote.exec.execPerShare)}</dd>
            <dt className="text-ink-2">Real {ticker} (Pyth)</dt>
            <dd className="text-right">{usd(quote.guard.equityPrice)}</dd>
            <dt className="text-ink-2">Token premium</dt>
            <dd className="text-right">{pct(quote.guard.premiumBps)}</dd>
            <dt className="text-ink-2">Swap cost</dt>
            <dd className="text-right">{pct(quote.exec.swapCostBps)}</dd>
            <dt className="text-ink-2">Route</dt>
            <dd className="truncate text-right">{quote.route.join(" → ")}</dd>
          </dl>

          {needsAck && (
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-1" />
              <span>I understand the token is unusually expensive right now and I still want to buy.</span>
            </label>
          )}

          {!connected ? (
            <div className="flex flex-col items-center gap-2 pt-1">
              <WalletMultiButton className="anchor-wallet" />
              <span className="text-xs text-muted">Connect a Solana wallet to buy</span>
            </div>
          ) : (
            <div className="flex gap-2">
              <button onClick={check} disabled={busy !== null} className="rounded-xl border border-hairline px-4 py-3 text-sm font-medium disabled:opacity-40">
                Refresh
              </button>
              <button
                onClick={buy}
                disabled={busy !== null || (needsAck && !ack) || (usdcBal !== null && usdcBal < usdc)}
                className="flex-1 rounded-xl bg-button py-3 font-semibold text-button-ink disabled:opacity-40"
              >
                {busy === "sign"
                  ? "Approve in your wallet…"
                  : busy === "send"
                    ? "Confirming on Solana…"
                    : busy === "quote"
                      ? "Re-checking price…"
                      : usdcBal !== null && usdcBal < usdc
                        ? "Not enough USDC"
                        : needsAck
                          ? "Buy anyway"
                          : `Buy ${usd(usdc, 0)} of ${ticker}`}
              </button>
            </div>
          )}
        </div>
      )}

      {err && <p className="mt-3 break-words text-sm" style={{ color: "var(--critical)" }}>{err}</p>}

      {result && result.status !== "failed" && (
        <div className="mt-4 rounded-xl border border-hairline p-3 text-sm">
          <p className="font-semibold">{result.status === "confirmed" ? "Bought ✓" : "Submitted, waiting for confirmation"}</p>
          <p className="mt-1 text-ink-2">The guard&apos;s verdict was written on-chain with your trade:</p>
          <code className="mt-1 block break-all rounded-lg bg-page p-2 text-xs">{result.memo}</code>
          <a
            href={`https://solscan.io/tx/${result.signature}`}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block font-medium text-accent underline underline-offset-2"
          >
            View on Solscan
          </a>
        </div>
      )}
    </Card>
  );
}
