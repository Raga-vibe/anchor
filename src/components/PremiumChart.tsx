"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { SESSION_LABEL, type Session } from "@/lib/session";
import { pct } from "@/lib/format";

export type ChartPoint = {
  t: number;
  session: Session;
  premium: number;
  ondo: number | null;
  staleHours: number;
  bandLo: number;
  bandHi: number;
  center: number;
};

const H = 220;
const M = { top: 12, right: 12, bottom: 24, left: 48 };
const GAP_S = 3600 * 1.5;

const dayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "America/New_York" });
const tipFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/New_York",
  timeZoneName: "short",
});

function niceStep(range: number) {
  const raw = range / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

// Splits a series into runs without gaps so lines don't bridge missing hours.
function runs<T extends { t: number }>(pts: T[], ok: (p: T) => boolean) {
  const out: T[][] = [];
  let cur: T[] = [];
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const broke = cur.length > 0 && p.t - cur[cur.length - 1].t > GAP_S;
    if (!ok(p) || broke) {
      if (cur.length) out.push(cur);
      cur = [];
    }
    if (ok(p)) cur.push(p);
  }
  if (cur.length) out.push(cur);
  return out;
}

export default function PremiumChart({ points, showOndo }: { points: ChartPoint[]; showOndo: boolean }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(600);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!wrap.current) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(280, e.contentRect.width)));
    ro.observe(wrap.current);
    return () => ro.disconnect();
  }, []);

  const geo = useMemo(() => {
    if (points.length < 2) return null;
    const t0 = points[0].t;
    const t1 = points[points.length - 1].t;
    const vals = points.flatMap((p) => [p.premium, p.bandLo, p.bandHi]);
    let lo = Math.min(0, ...vals);
    let hi = Math.max(0, ...vals);
    const pad = (hi - lo) * 0.08 || 5;
    lo -= pad;
    hi += pad;
    const step = niceStep(hi - lo);
    const ticks: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    const iw = w - M.left - M.right;
    const ih = H - M.top - M.bottom;
    const x = (t: number) => M.left + ((t - t0) / (t1 - t0)) * iw;
    const y = (v: number) => M.top + ((hi - v) / (hi - lo)) * ih;

    // Day ticks at New York midnight-ish: first point of each new NY weekday.
    const days: { t: number; label: string }[] = [];
    let last = "";
    for (const p of points) {
      const d = dayFmt.format(new Date(p.t * 1000));
      if (d !== last) {
        if (last) days.push({ t: p.t, label: d });
        last = d;
      }
    }
    return { t0, t1, lo, hi, ticks, x, y, iw, ih, days, step };
  }, [points, w]);

  if (!geo) return <div className="flex h-[220px] items-center justify-center text-sm text-muted">Not enough history yet</div>;
  const { x, y, ticks, days, step } = geo;

  const line = (pts: ChartPoint[], f: (p: ChartPoint) => number) =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(f(p)).toFixed(1)}`).join("");

  const bandPaths = runs(points, () => true).map(
    (r) =>
      line(r, (p) => p.bandHi) +
      [...r].reverse().map((p) => `L${x(p.t).toFixed(1)},${y(p.bandLo).toFixed(1)}`).join("") +
      "Z",
  );
  const closedRuns = runs(points, (p) => p.session === "closed");
  const premRuns = runs(points, () => true);
  const ondoRuns = showOndo ? runs(points, (p) => p.ondo !== null) : [];
  const lastP = points[points.length - 1];
  const hp = hover !== null ? points[hover] : null;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    const t = geo!.t0 + ((px - M.left) / geo!.iw) * (geo!.t1 - geo!.t0);
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
    setHover(best);
  }

  const decimals = step < 10 ? 2 : 1;

  return (
    <div ref={wrap} className="relative w-full select-none">
      <svg width={w} height={H} role="img" aria-label="Token premium over the real stock, last 7 days">
        <defs>
          <clipPath id="plot">
            <rect x={M.left} y={M.top} width={geo.iw} height={geo.ih} />
          </clipPath>
        </defs>

        {closedRuns.map((r, i) => (
          <rect key={i} x={x(r[0].t)} y={M.top} width={Math.max(1, x(r[r.length - 1].t + 3600) - x(r[0].t))} height={geo.ih} fill="var(--closed)" clipPath="url(#plot)" />
        ))}

        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={w - M.right} y1={y(v)} y2={y(v)} stroke={Math.abs(v) < 1e-9 ? "var(--axis)" : "var(--hairline)"} strokeWidth={1} />
            <text x={M.left - 8} y={y(v)} dy="0.32em" textAnchor="end" className="tabular" fontSize={11} fill="var(--muted)">
              {pct(v, decimals)}
            </text>
          </g>
        ))}
        {days.map((d) => (
          <text key={d.t} x={x(d.t)} y={H - 6} textAnchor="middle" fontSize={11} fill="var(--muted)">
            {d.label}
          </text>
        ))}

        <g clipPath="url(#plot)">
          {bandPaths.map((d, i) => (
            <path key={i} d={d} fill="var(--band)" />
          ))}
          {ondoRuns.map((r, i) => (
            <path key={i} d={line(r, (p) => p.ondo!)} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
          ))}
          {premRuns.map((r, i) => (
            <path key={i} d={line(r, (p) => p.premium)} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          <circle cx={x(lastP.t)} cy={y(lastP.premium)} r={4} fill="var(--series-1)" stroke="var(--card)" strokeWidth={2} />
        </g>

        {hp && (
          <g pointerEvents="none">
            <line x1={x(hp.t)} x2={x(hp.t)} y1={M.top} y2={M.top + geo.ih} stroke="var(--axis)" strokeWidth={1} />
            <circle cx={x(hp.t)} cy={y(hp.premium)} r={4.5} fill="var(--series-1)" stroke="var(--card)" strokeWidth={2} />
            {showOndo && hp.ondo !== null && <circle cx={x(hp.t)} cy={y(hp.ondo)} r={4.5} fill="var(--series-2)" stroke="var(--card)" strokeWidth={2} />}
          </g>
        )}

        <rect
          x={M.left}
          y={M.top}
          width={geo.iw}
          height={geo.ih}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>

      {hp && (
        <div
          className="pointer-events-none absolute top-2 z-10 min-w-[180px] rounded-xl border border-hairline bg-card px-3 py-2 text-xs shadow-lg"
          style={{ left: Math.min(Math.max(x(hp.t) - 90, 0), w - 190) }}
        >
          <div className="font-medium">{tipFmt.format(new Date(hp.t * 1000))}</div>
          <div className="mb-1 text-muted">{SESSION_LABEL[hp.session]}</div>
          <Row color="var(--series-1)" label="xStock premium" value={pct(hp.premium)} />
          {showOndo && hp.ondo !== null && <Row color="var(--series-2)" label="Ondo premium" value={pct(hp.ondo)} />}
          <Row color="var(--band)" label="Fair range" value={`${pct(hp.bandLo)} to ${pct(hp.bandHi)}`} square />
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <Legend color="var(--series-1)" label="xStock vs real stock" />
        {showOndo && <Legend color="var(--series-2)" label="Ondo vs real stock" />}
        <Legend color="var(--band)" label="Fair range (±2σ)" square />
        <Legend color="var(--closed)" label="US market closed" square outline />
      </div>
    </div>
  );
}

function Row({ color, label, value, square }: { color: string; label: string; value: string; square?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="flex items-center gap-1.5 text-ink-2">
        <span className={square ? "h-2.5 w-2.5 rounded-sm" : "h-0.5 w-3 rounded"} style={{ background: color }} />
        {label}
      </span>
      <span className="tabular font-medium">{value}</span>
    </div>
  );
}

function Legend({ color, label, square, outline }: { color: string; label: string; square?: boolean; outline?: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span
        className={square ? "h-3 w-3 rounded-sm" : "h-0.5 w-4 rounded"}
        style={{ background: color, border: outline ? "1px solid var(--hairline)" : undefined }}
      />
      {label}
    </span>
  );
}
