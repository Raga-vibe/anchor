import "server-only";
import { Connection, PublicKey } from "@solana/web3.js";

export const MEMO_PROGRAM_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
export const MEMO_PREFIX = "anchor-guard:v1";

let conn: Connection | null = null;
export function connection(): Connection {
  conn ??= new Connection(process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com", "confirmed");
  return conn;
}

type ScaledUiState = { multiplier: string; newMultiplier: string; newMultiplierEffectiveTimestamp: number | string };

// xStocks are Token-2022 mints with the ScaledUiAmount extension: dividends are
// reinvested by raising the multiplier, so 1 raw token = `multiplier` shares.
export async function getShareMultiplier(mint: string): Promise<number> {
  const info = await connection().getParsedAccountInfo(new PublicKey(mint));
  const data = info.value?.data;
  if (!data || !("parsed" in data)) throw new Error(`Mint ${mint} not found`);
  const ext = (data.parsed.info.extensions as { extension: string; state: ScaledUiState }[] | undefined)?.find(
    (e) => e.extension === "scaledUiAmountConfig",
  );
  if (!ext) return 1;
  const effective = Number(ext.state.newMultiplierEffectiveTimestamp) * 1000 <= Date.now();
  return Number(effective ? ext.state.newMultiplier : ext.state.multiplier);
}
