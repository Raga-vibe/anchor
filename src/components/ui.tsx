"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Verdict } from "@/lib/guard";
import { VERDICT_COPY } from "@/lib/explain";
import { SESSION_LABEL, type Session } from "@/lib/session";
import { hours } from "@/lib/format";

export type ApiError = { error: string; code?: string };

// Fetch JSON and optionally re-poll. Keeps the last good data on refresh errors.
export function usePolling<T>(url: string | null, intervalMs = 0) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(Boolean(url));
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (!url) return;
    try {
      const res = await fetch(url, { cache: "no-store" });
      const body = await res.json();
      if (!alive.current) return;
      if (!res.ok) setError(body as ApiError);
      else {
        setData(body as T);
        setError(null);
      }
    } catch (e) {
      if (alive.current) setError({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      if (alive.current) setLoading(false);
    }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    setLoading(Boolean(url));
    load();
    if (!intervalMs || !url) return () => void (alive.current = false);
    const id = setInterval(load, intervalMs);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [url, intervalMs, load]);

  return { data, error, loading, reload: load };
}

const VERDICT_STYLE: Record<Verdict, { dot: string; wash: string }> = {
  discount: { dot: "var(--good)", wash: "var(--good-wash)" },
  fair: { dot: "var(--good)", wash: "var(--good-wash)" },
  caution: { dot: "var(--warning)", wash: "var(--warning-wash)" },
  wait: { dot: "var(--critical)", wash: "var(--critical-wash)" },
  unknown: { dot: "var(--muted)", wash: "var(--band)" },
};

export function VerdictIcon({ verdict, className = "h-4 w-4" }: { verdict: Verdict; className?: string }) {
  const color = VERDICT_STYLE[verdict].dot;
  const common = { className, viewBox: "0 0 16 16", "aria-hidden": true } as const;
  if (verdict === "fair" || verdict === "discount") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="8" fill={color} />
        {verdict === "fair" ? (
          <path d="M4.5 8.2l2.3 2.3 4.7-4.9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <path d="M8 4.5v7M5 8.6L8 11.5l3-2.9" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    );
  }
  if (verdict === "caution") {
    return (
      <svg {...common}>
        <path d="M8 1l7.5 13.5H.5z" fill={color} />
        <path d="M8 6v4" stroke="#0b0b0b" strokeWidth="1.6" strokeLinecap="round" />
        <circle cx="8" cy="12.2" r="0.9" fill="#0b0b0b" />
      </svg>
    );
  }
  if (verdict === "wait") {
    return (
      <svg {...common}>
        <circle cx="8" cy="8" r="8" fill={color} />
        <path d="M6 5v6M10 5v6" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="8" cy="8" r="7" fill="none" stroke={color} strokeWidth="2" />
    </svg>
  );
}

export function VerdictBadge({ verdict, size = "sm" }: { verdict: Verdict; size?: "sm" | "md" }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold text-ink ${size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs"}`}
      style={{ background: VERDICT_STYLE[verdict].wash }}
    >
      <VerdictIcon verdict={verdict} className={size === "md" ? "h-4 w-4" : "h-3.5 w-3.5"} />
      {VERDICT_COPY[verdict].label}
    </span>
  );
}

export function verdictWash(v: Verdict) {
  return VERDICT_STYLE[v].wash;
}

export function SessionBanner({ session, staleHours }: { session: Session; staleHours?: number }) {
  const open = session === "regular";
  return (
    <div className="flex items-center gap-2 rounded-xl border border-hairline bg-card px-3 py-2 text-sm">
      <span className="relative flex h-2.5 w-2.5">
        {open && <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" style={{ background: "var(--good)" }} />}
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: open ? "var(--good)" : session === "closed" ? "var(--muted)" : "var(--warning)" }} />
      </span>
      <span className="font-medium">{SESSION_LABEL[session]}</span>
      <span className="text-ink-2">
        {session === "closed" && staleHours
          ? `· last US trade ${hours(staleHours)} ago, fair ranges are wider`
          : session === "regular"
            ? "· comparing against live prices"
            : "· thinner trading, fair ranges are wider"}
      </span>
    </div>
  );
}

export function Card({ children, className = "", style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-2xl border border-hairline bg-card ${className}`} style={style}>
      {children}
    </div>
  );
}

export function ErrorNotice({ error }: { error: ApiError }) {
  if (error.code === "NO_PYTH_KEY") {
    return (
      <Card className="p-4 text-sm">
        <p className="font-semibold">Pyth API key needed</p>
        <p className="mt-1 text-ink-2">
          Create <code>.env.local</code> in the project root with <code>PYTH_PRO_API_KEY=your_key</code>, then restart the dev server.
        </p>
      </Card>
    );
  }
  return (
    <Card className="p-4 text-sm">
      <p className="font-semibold">Something went wrong</p>
      <p className="mt-1 break-words text-ink-2">{error.error}</p>
    </Card>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-hairline ${className}`} />;
}
