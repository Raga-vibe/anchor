// Synthetic check of the guard model: known premium regimes in, verdicts out.
import { buildBaseline, evaluate, fairBandAt } from "../src/lib/guard";
import { sessionAt } from "../src/lib/session";

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 2 ** 32) / 2 ** 32);
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand());

const RR = 1.0033;
const now = Date.UTC(2026, 8, 24, 7, 0) / 1000; // Thu 03:00 ET (overnight)
const start = Math.floor((now - 30 * 86400) / 3600) * 3600;

const eq = { t: [] as number[], c: [] as number[] };
const xs = { t: [] as number[], c: [] as number[] };
const rr = { t: [] as number[], c: [] as number[] };
let E = 250;
for (let t = start; t <= now; t += 3600) {
  const s = sessionAt(t * 1000 + 1800_000);
  E *= Math.exp((s === "closed" ? 15 : 30) * 1e-4 * gauss()); // true price keeps moving
  const noise = s === "regular" ? 3 + 5 * gauss() : s === "closed" ? 10 + 20 * gauss() : 5 + 15 * gauss();
  if (s !== "closed") {
    eq.t.push(t);
    eq.c.push(E);
  }
  xs.t.push(t);
  xs.c.push(E * RR * Math.exp(noise * 1e-4));
  rr.t.push(t);
  rr.c.push(RR);
}

const b = buildBaseline({ equity: eq, xstock: xs, rr });
const fmt = (x: number) => x.toFixed(1);
console.log("convention:", b.convention, "(expect perRawToken)");
console.log("regular median/scale:", fmt(b.buckets.regular.median), fmt(b.buckets.regular.scale), "(expect ~3 / ~5)");
console.log("extended median/scale:", fmt(b.buckets.extended.median), fmt(b.buckets.extended.scale), "(expect ~5 / ~15)");
console.log("hourly vol bps:", fmt(b.hourlyVolBps), "(expect ~30)");
console.log("closed hours:", b.closedZ.length, "closedZ |median|:", fmt(Math.abs(b.closedZ.sort((a, c) => a - c)[b.closedZ.length >> 1])));

const lastClosed = b.series.filter((p) => p.session === "closed").at(-1)!;
const band = fairBandAt(b, lastClosed);
console.log(`band at end of weekend (${fmt(lastClosed.staleHours)}h stale): ${fmt(band.lo)}..${fmt(band.hi)} bps`);

const eqP = 250;
const cases: [string, Parameters<typeof evaluate>[1], string][] = [
  ["regular, normal premium", { nowMs: now * 1000, session: "regular", equity: { price: eqP, confidence: 0.02, updatedAtMs: now * 1000 - 1000 }, xstock: { price: eqP * RR * Math.exp(4e-4), confidence: 0.05 }, rr: RR, ondo: null }, "fair"],
  ["regular, +25bp premium", { nowMs: now * 1000, session: "regular", equity: { price: eqP, confidence: 0.02, updatedAtMs: now * 1000 - 1000 }, xstock: { price: eqP * RR * Math.exp(25e-4), confidence: 0.05 }, rr: RR, ondo: null }, "wait"],
  ["regular, -20bp discount", { nowMs: now * 1000, session: "regular", equity: { price: eqP, confidence: 0.02, updatedAtMs: now * 1000 - 1000 }, xstock: { price: eqP * RR * Math.exp(-20e-4), confidence: 0.05 }, rr: RR, ondo: null }, "discount"],
  ["closed 50h, +150bp", { nowMs: now * 1000, session: "closed", equity: { price: eqP, confidence: 0.02, updatedAtMs: now * 1000 - 50 * 3600e3 }, xstock: { price: eqP * RR * Math.exp(150e-4), confidence: 0.05 }, rr: RR, ondo: null }, "fair"],
  ["closed 1h, +150bp", { nowMs: now * 1000, session: "closed", equity: { price: eqP, confidence: 0.02, updatedAtMs: now * 1000 - 1 * 3600e3 }, xstock: { price: eqP * RR * Math.exp(150e-4), confidence: 0.05 }, rr: RR, ondo: null }, "wait"],
];
let fails = 0;
for (const [name, inp, expect] of cases) {
  const g = evaluate(b, inp);
  const ok = g.verdict === expect;
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: verdict=${g.verdict} (expect ${expect}) z=${g.z.toFixed(2)} prem=${fmt(g.premiumBps)} scale=${fmt(g.scaleBps)} pctile=${g.percentile.toFixed(2)}`);
}
process.exit(fails ? 1 : 0);
