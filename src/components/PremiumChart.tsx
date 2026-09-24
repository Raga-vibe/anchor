"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { SESSION_LABEL, type Session } from "@/lib/session";
import { pct } from "@/lib/format";

export type ChartPoint = {
  t: number;
  session: Session;
  premium: number;
  staleHours: number;
  bandLo: number;
  bandHi: number;
  center: number;
};

export type ChartRange = "1D" | "7D" | "30D";

const H = 250;
const M = { top: 18, right: 14, bottom: 28, left: 50 };
const GAP_S = 3600 * 1.5;

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", ...opts });
const dayFmt = fmt({ weekday: "short" });
const hourFmt = fmt({ hour: "numeric" });
const hourNum = fmt({ hour: "numeric", hour12: false });
const dateFmt = fmt({ month: "short", day: "numeric" });
const tipFmt = fmt({ weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" });

function niceStep(range: number) {
  const raw = range / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  return (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
}

// Centered rolling median: shows the trend through hour-to-hour noise.
function rollingMedian(values: number[], k: number) {
  if (k <= 1) return values;
  const h = k >> 1;
  return values.map((_, i) => {
    const w = values.slice(Math.max(0, i - h), i + h + 1).sort((a, b) => a - b);
    return w[w.length >> 1];
  });
}

const SMOOTH: Record<ChartRange, number> = { "1D": 1, "7D": 3, "30D": 7 };

// Splits a series into runs without gaps so lines don't bridge missing hours.
function runs<T extends { t: number }>(pts: T[], ok: (p: T) => boolean) {
  const out: T[][] = [];
  let cur: T[] = [];
  for (const p of pts) {
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

function xTicks(points: ChartPoint[], range: ChartRange) {
  const ticks: { t: number; label: string }[] = [];
  let last = "";
  for (const p of points) {
    const d = new Date(p.t * 1000);
    if (range === "1D") {
      const h = Number(hourNum.format(d)) % 24;
      if (h % 4 === 0) ticks.push({ t: p.t, label: hourFmt.format(d) });
      continue;
    }
    const day = dayFmt.format(d) + dateFmt.format(d);
    if (day === last) continue;
    if (last) {
      if (range === "7D") ticks.push({ t: p.t, label: dayFmt.format(d) });
      else if (d.getUTCDay() === 1) ticks.push({ t: p.t, label: dateFmt.format(d) });
    }
    last = day;
  }
  return ticks;
}

export default function PremiumChart({ points, range }: { points: ChartPoint[]; range: ChartRange }) {
  const uid = useId().replace(/:/g, "");
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(640);
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
    // Scale to the premium and the band of hours with a live reference; ranges
    // widened by a stale reference may run off the chart ("anything goes").
    const vals = [0, ...points.map((p) => p.premium), ...points.filter((p) => p.staleHours === 0).flatMap((p) => [p.bandLo, p.bandHi])];
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const pad = (hi - lo) * 0.14 || 5;
    lo -= pad;
    hi += pad;
    const step = niceStep(hi - lo);
    const ticks: number[] = [];
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
    const iw = w - M.left - M.right;
    const ih = H - M.top - M.bottom;
    const x = (t: number) => M.left + ((t - t0) / (t1 - t0)) * iw;
    const y = (v: number) => M.top + ((hi - v) / (hi - lo)) * ih;
    return { t0, t1, ticks, x, y, iw, ih, step };
  }, [points, w]);

  if (!geo) return <div className="flex h-[250px] items-center justify-center text-sm text-muted">Not enough history yet</div>;
  const { x, y, ticks, step } = geo;

  const line = (pts: ChartPoint[], f: (p: ChartPoint) => number) =>
    pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(f(p)).toFixed(1)}`).join("");
  const segments = runs(points, () => true);
  const k = SMOOTH[range];
  const smooth = new Map<number, number>();
  for (const r of segments) {
    const m = rollingMedian(r.map((p) => p.premium), k);
    r.forEach((p, i) => smooth.set(p.t, m[i]));
  }
  // Draw the normal range where it is defined: hours with a live reference, and
  // weekend closures (where it widens). Overnight hours without equity history
  // have no meaningful range, so they are left blank.
  const bandRuns = runs(points, (p) => p.staleHours === 0 || p.session === "closed");
  const bandPaths = bandRuns.map(
    (r) => line(r, (p) => p.bandHi) + [...r].reverse().map((p) => `L${x(p.t).toFixed(1)},${y(p.bandLo).toFixed(1)}`).join("") + "Z",
  );
  const areaPaths = segments.map(
    (r) =>
      line(r, (p) => smooth.get(p.t) ?? p.premium) +
      `L${x(r[r.length - 1].t).toFixed(1)},${y(0).toFixed(1)}L${x(r[0].t).toFixed(1)},${y(0).toFixed(1)}Z`,
  );
  const closedRuns = runs(points, (p) => p.session === "closed");
  const lastP = points[points.length - 1];
  const hp = hover !== null ? points[hover] : null;
  const decimals = step < 10 ? 2 : 1;

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const t = geo!.t0 + ((e.clientX - rect.left - M.left) / geo!.iw) * (geo!.t1 - geo!.t0);
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
    setHover(best);
  }

  const nowX = x(lastP.t);
  const nowY = y(lastP.premium);

  return (
    <div ref={wrap} className="relative w-full select-none">
      <svg width={w} height={H} role="img" aria-label="Token premium over the real stock">
        <defs>
          <clipPath id={`plot-${uid}`}>
            <rect x={M.left} y={M.top} width={geo.iw} height={geo.ih} />
          </clipPath>
          <pattern id={`hatch-${uid}`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="7" stroke="var(--hairline)" strokeWidth="2" />
          </pattern>
          <linearGradient id={`area-${uid}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {/* closed-market periods */}
        {closedRuns.map((r, i) => {
          const x0 = x(r[0].t);
          const x1 = Math.min(x(r[r.length - 1].t + 3600), M.left + geo.iw);
          return (
            <g key={i} clipPath={`url(#plot-${uid})`}>
              <rect x={x0} y={M.top} width={Math.max(1, x1 - x0)} height={geo.ih} fill="var(--closed)" />
              <rect x={x0} y={M.top} width={Math.max(1, x1 - x0)} height={geo.ih} fill={`url(#hatch-${uid})`} opacity={0.7} />
              {x1 - x0 > 48 && (
                <text x={(x0 + x1) / 2} y={M.top + 12} textAnchor="middle" fontSize={10} fill="var(--muted)" className="font-mono">
                  CLOSED
                </text>
              )}
            </g>
          );
        })}

        {/* grid + y labels */}
        {ticks.map((v) => (
          <g key={v}>
            <line x1={M.left} x2={w - M.right} y1={y(v)} y2={y(v)} stroke={Math.abs(v) < 1e-9 ? "var(--muted)" : "var(--hairline)"} strokeOpacity={Math.abs(v) < 1e-9 ? 0.55 : 1} strokeWidth={1} />
            <text x={M.left - 10} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--muted)" className="tabular font-mono">
              {pct(v, decimals)}
            </text>
          </g>
        ))}
        {xTicks(points, range).map((d) => (
          <text key={d.t} x={x(d.t)} y={H - 8} textAnchor="middle" fontSize={11} fill="var(--muted)">
            {d.label}
          </text>
        ))}

        <g clipPath={`url(#plot-${uid})`}>
          {bandPaths.map((d, i) => (
            <path key={i} d={d} fill="var(--band)" />
          ))}
          {areaPaths.map((d, i) => (
            <path key={i} d={d} fill={`url(#area-${uid})`} />
          ))}
          {k > 1 &&
            segments.map((r, i) => (
              <path key={`raw${i}`} d={line(r, (p) => p.premium)} fill="none" stroke="var(--accent)" strokeOpacity={0.3} strokeWidth={1} strokeLinejoin="round" />
            ))}
          {segments.map((r, i) => (
            <path key={i} d={line(r, (p) => smooth.get(p.t) ?? p.premium)} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {/* live "now" marker */}
          <circle cx={nowX} cy={nowY} r={4} fill="var(--accent)" opacity={0.5}>
            <animate attributeName="r" from="4" to="13" dur="1.8s" repeatCount="indefinite" />
            <animate attributeName="opacity" from="0.45" to="0" dur="1.8s" repeatCount="indefinite" />
          </circle>
          <circle cx={nowX} cy={nowY} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
        </g>

        {hp && (
          <g pointerEvents="none">
            <line x1={x(hp.t)} x2={x(hp.t)} y1={M.top} y2={M.top + geo.ih} stroke="var(--muted)" strokeOpacity={0.6} strokeWidth={1} />
            <circle cx={x(hp.t)} cy={y(hp.premium)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
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
          className="pointer-events-none absolute top-1 z-10 min-w-[196px] rounded-xl border border-hairline bg-surface/95 px-3 py-2.5 text-xs shadow-float backdrop-blur"
          style={{ left: Math.min(Math.max(x(hp.t) - 98, 0), w - 200) }}
        >
          <div className="font-medium">{tipFmt.format(new Date(hp.t * 1000))}</div>
          <div className="mb-1.5 text-muted">{SESSION_LABEL[hp.session]}</div>
          <TipRow swatch={<span className="h-0.5 w-3 rounded bg-accent" />} label="Token vs real stock" value={pct(hp.premium)} />
          <TipRow
            swatch={<span className="h-2.5 w-2.5 rounded-sm" style={{ background: "var(--band)" }} />}
            label="Normal range"
            value={`${pct(hp.bandLo, 1)} to ${pct(hp.bandHi, 1)}`}
          />
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-2">
        <Legend swatch={<span className="h-0.5 w-4 rounded bg-accent" />} label={k > 1 ? `Token vs real stock (${k}-hour median)` : "Token vs real stock"} />
        <Legend swatch={<span className="h-px w-4 bg-muted" />} label="0% = same as the real stock" />
        <Legend swatch={<span className="h-3 w-3 rounded-sm" style={{ background: "var(--band)" }} />} label="Normal range (±2σ)" />
        <Legend
          swatch={
            <span
              className="h-3 w-3 rounded-sm border border-hairline"
              style={{ background: "repeating-linear-gradient(45deg, var(--hairline) 0 2px, transparent 2px 5px)" }}
            />
          }
          label="US market closed"
        />
      </div>
    </div>
  );
}

function TipRow({ swatch, label, value }: { swatch: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-0.5">
      <span className="flex items-center gap-1.5 text-ink-2">
        {swatch}
        {label}
      </span>
      <span className="tabular font-medium">{value}</span>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: React.ReactNode; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      {swatch}
      {label}
    </span>
  );
}
