// Snapshots 30 days of hourly history into data/seed.json, so the deployed app
// still has a baseline if Yahoo or GeckoTerminal rate-limit the server.
// Run: npm run seed
import { writeFileSync, mkdirSync } from "node:fs";
import { ASSETS } from "../src/lib/assets";
import { fetchEquityHistory, fetchPoolHistory, type Candles } from "../src/lib/sources";

async function main() {
  const out: Record<string, { equity: Candles; pool: Candles }> = {};
  for (const a of ASSETS) {
    const equity = await fetchEquityHistory(a);
    const pool = await fetchPoolHistory(a);
    out[a.ticker] = { equity, pool };
    console.log(`${a.ticker.padEnd(6)} equity ${equity.t.length} h, pool ${pool.t.length} h`);
    await new Promise((r) => setTimeout(r, 4000)); // stay well under GeckoTerminal's 30 req/min
  }
  mkdirSync("data", { recursive: true });
  writeFileSync("data/seed.json", JSON.stringify(out));
  console.log("wrote data/seed.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
