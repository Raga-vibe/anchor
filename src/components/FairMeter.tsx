"use client";

import type { Verdict } from "@/lib/guard";

// Anchor's signature visual: where the token's price sits relative to its fair
// range. The track is in σ units around the typical premium:
//   −4σ ── discount ── −2σ ────── fair ────── +2σ ─ pricey ─ +3σ ─ wait ─ +4σ
const ZMAX = 4;
const SEGMENTS = [
  { from: -4, to: -2, color: "color-mix(in oklab, var(--good) 55%, transparent)" },
  { from: -2, to: 2, color: "color-mix(in oklab, var(--good) 20%, var(--band))" },
  { from: 2, to: 3, color: "color-mix(in oklab, var(--warning) 70%, transparent)" },
  { from: 3, to: 4, color: "color-mix(in oklab, var(--critical) 75%, transparent)" },
];

const pos = (z: number) => ((Math.max(-ZMAX, Math.min(ZMAX, z)) + ZMAX) / (2 * ZMAX)) * 100;

type Props = {
  z: number;
  verdict: Verdict;
  size?: "sm" | "lg";
  label?: string; // bubble text above the marker (lg)
  lowLabel?: string; // price at −2σ (lg)
  highLabel?: string; // price at +2σ (lg)
  zones?: boolean; // show "Cheaper / Fair / Pricey / Wait" under the track (lg)
};

export default function FairMeter({ z, verdict, size = "sm", label, lowLabel, highLabel, zones = true }: Props) {
  const safeZ = Number.isFinite(z) ? z : 0;
  const x = pos(safeZ);
  const off = Math.abs(safeZ) > ZMAX;

  if (size === "sm") {
    return (
      <div className="relative h-3 w-full" role="img" aria-label={`Price position: ${safeZ.toFixed(1)} sigma from typical`}>
        <div className="absolute inset-x-0 top-1/2 flex h-1 -translate-y-1/2 gap-[2px] overflow-hidden rounded-full">
          {SEGMENTS.map((s) => (
            <div key={s.from} style={{ flex: s.to - s.from, background: s.color }} />
          ))}
        </div>
        <div className="absolute top-1/2 h-2.5 w-px -translate-y-1/2 bg-ink/25" style={{ left: "50%" }} />
        <div
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-2 ring-surface transition-[left] duration-700 ease-out"
          style={{ left: `${x}%` }}
        />
      </div>
    );
  }

  const bubbleX = Math.max(9, Math.min(91, x));
  const prices = Boolean(lowLabel || highLabel);
  const bottom = prices ? "pb-12" : zones ? "pb-7" : "pb-3";
  return (
    <div className={`relative select-none pt-11 ${bottom}`} role="img" aria-label={`${label ?? ""} ${verdict}`}>
      {/* bubble */}
      <div className="absolute top-0 -translate-x-1/2 transition-[left] duration-700 ease-out" style={{ left: `${bubbleX}%` }}>
        <div className="tabular whitespace-nowrap rounded-lg bg-ink px-2.5 py-1 text-xs font-semibold text-page shadow-card">
          {off && safeZ < 0 ? "◂ " : ""}
          {label}
          {off && safeZ > 0 ? " ▸" : ""}
        </div>
      </div>
      {/* track */}
      <div className="relative">
        <div className="flex h-3 gap-[3px] overflow-hidden rounded-full">
          {SEGMENTS.map((s) => (
            <div key={s.from} style={{ flex: s.to - s.from, background: s.color }} />
          ))}
        </div>
        <div className="absolute -top-1 h-5 w-px bg-ink/30" style={{ left: "50%" }} />
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 transition-[left] duration-700 ease-out"
          style={{ left: `${x}%` }}
        >
          <div className="h-5 w-5 rounded-full bg-ink ring-4 ring-surface shadow-card" />
        </div>
        {/* connector from bubble to marker */}
        <div
          className="absolute -top-4 h-3 w-px -translate-x-1/2 bg-ink/40 transition-[left] duration-700 ease-out"
          style={{ left: `${x}%` }}
        />
      </div>
      {/* zone labels */}
      {zones && (
        <div className={`absolute inset-x-0 text-[11px] font-medium text-ink-2 ${prices ? "bottom-5" : "bottom-0"}`}>
          {[
            ["Cheaper", "12.5%"],
            ["Fair", "50%"],
            ["Pricey", "81.25%"],
            ["Wait", "93.75%"],
          ].map(([name, left]) => (
            <span key={name} className="absolute -translate-x-1/2" style={{ left }}>
              {name}
            </span>
          ))}
        </div>
      )}
      {/* fair-range price labels */}
      {prices && (
        <div className="tabular absolute inset-x-0 bottom-0 font-mono text-[10.5px] text-muted">
          <span className="absolute -translate-x-1/2" style={{ left: "25%" }}>
            {lowLabel}
          </span>
          <span className="absolute -translate-x-1/2" style={{ left: "75%" }}>
            {highLabel}
          </span>
        </div>
      )}
    </div>
  );
}
