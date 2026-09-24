"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Verdict } from "@/lib/guard";
import { VERDICT_COPY } from "@/lib/explain";
import { SESSION_LABEL, type Session } from "@/lib/session";
import { hours } from "@/lib/format";

export type ApiError = { error: string; code?: string };

type Polled<T> = { url: string; data: T | null; error: ApiError | null };

// Fetch JSON and optionally re-poll. Keeps the last good data on refresh errors.
// Results are keyed by URL, so switching URLs never shows the previous one's data.
export function usePolling<T>(url: string | null, intervalMs = 0) {
  const [state, setState] = useState<Polled<T> | null>(null);

  useEffect(() => {
    if (!url) return;
    let alive = true;
    const keep = (prev: Polled<T> | null) => (prev?.url === url ? prev.data : null);
    const load = async () => {
      try {
        const res = await fetch(url, { cache: "no-store" });
        const body = await res.json();
        if (!alive) return;
        setState((prev) => (res.ok ? { url, data: body as T, error: null } : { url, data: keep(prev), error: body as ApiError }));
      } catch (e) {
        if (alive) setState((prev) => ({ url, data: keep(prev), error: { error: e instanceof Error ? e.message : String(e) } }));
      }
    };
    load();
    const id = intervalMs ? setInterval(load, intervalMs) : undefined;
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [url, intervalMs]);

  const current = state?.url === url ? state : null;
  return { data: current?.data ?? null, error: current?.error ?? null, loading: Boolean(url) && !current };
}

// True for a moment whenever `value` changes (not on first render).
export function useFlash(value: unknown) {
  const [on, setOn] = useState(false);
  const prev = useRef(value);
  useEffect(() => {
    if (prev.current === value) return;
    prev.current = value;
    setOn(true);
    const id = setTimeout(() => setOn(false), 1000);
    return () => clearTimeout(id);
  }, [value]);
  return on;
}

export function Flash({ value, children, className = "" }: { value: unknown; children: ReactNode; className?: string }) {
  const on = useFlash(value);
  return <span className={`${className} ${on ? "flash" : ""}`}>{children}</span>;
}

export const VERDICT_COLOR: Record<Verdict, { fg: string; wash: string }> = {
  discount: { fg: "var(--good)", wash: "var(--good-wash)" },
  fair: { fg: "var(--good)", wash: "var(--good-wash)" },
  caution: { fg: "var(--warning)", wash: "var(--warning-wash)" },
  wait: { fg: "var(--critical)", wash: "var(--critical-wash)" },
  unknown: { fg: "var(--muted)", wash: "var(--band)" },
};

export function VerdictIcon({ verdict, className = "h-4 w-4" }: { verdict: Verdict; className?: string }) {
  const color = VERDICT_COLOR[verdict].fg;
  const common = { className, viewBox: "0 0 16 16", "aria-hidden": true } as const;
  if (verdict === "fair" || verdict === "discount") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="8" fill={color} />
        {verdict === "fair" ? (
          <path d="M4.6 8.2l2.2 2.2 4.6-4.8" fill="none" stroke="var(--surface)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M8 4.4v7M5.2 8.6 8 11.4l2.8-2.8" fill="none" stroke="var(--surface)" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    );
  }
  if (verdict === "caution") {
    return (
      <svg {...common}>
        <path d="M8 1.2l7.2 13.2H.8z" fill={color} strokeLinejoin="round" />
        <path d="M8 6v3.8" stroke="#111" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="12.1" r="0.9" fill="#111" />
      </svg>
    );
  }
  if (verdict === "wait") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="8" fill={color} />
        <path d="M6.1 5v6M9.9 5v6" stroke="var(--surface)" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="6.8" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function VerdictBadge({ verdict, size = "sm" }: { verdict: Verdict; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold text-ink ${
        size === "md" ? "px-3 py-1.5 text-sm" : "px-2.5 py-1 text-xs"
      }`}
      style={{ background: VERDICT_COLOR[verdict].wash }}
    >
      <VerdictIcon verdict={verdict} className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {VERDICT_COPY[verdict].label}
    </span>
  );
}

export function LiveDot({ color = "var(--good)" }: { color?: string }) {
  return <span className="live-dot inline-block h-2 w-2 rounded-full" style={{ background: color, color }} />;
}

export function SessionPill({ session, staleHours }: { session: Session; staleHours?: number }) {
  const color = session === "regular" ? "var(--good)" : session === "closed" ? "var(--muted)" : "var(--warning)";
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-surface/80 px-3 py-1 text-xs">
      {session === "closed" ? <span className="h-2 w-2 rounded-full" style={{ background: color }} /> : <LiveDot color={color} />}
      <span className="font-medium text-ink">{SESSION_LABEL[session]}</span>
      {session === "closed" && staleHours ? <span className="text-ink-2">last trade {hours(staleHours)} ago</span> : null}
    </span>
  );
}

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: CSSProperties }) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`font-mono text-[11px] uppercase tracking-[0.14em] text-muted ${className}`}>{children}</div>;
}

export function ErrorNotice({ error }: { error: ApiError }) {
  return (
    <Card className="p-5 text-sm">
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1 break-words text-ink-2">{error.error}</p>
    </Card>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`skeleton ${className}`} />;
}

export function TokenLogo({ symbol, ticker, size = 40 }: { symbol: string; ticker: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        className="inline-flex shrink-0 items-center justify-center rounded-full bg-surface-2 font-semibold text-ink-2 ring-1 ring-hairline"
        style={{ width: size, height: size, fontSize: size * 0.32 }}
      >
        {ticker.slice(0, 2)}
      </span>
    );
  }
  return (
    // xStock token logos from the issuer's public metadata
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`https://xstocks-metadata.backed.fi/logos/tokens/${symbol}.png`}
      alt=""
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full ring-1 ring-hairline"
      style={{ width: size, height: size }}
    />
  );
}
