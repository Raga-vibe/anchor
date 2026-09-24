import { NextResponse, type NextRequest } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { errorResponse } from "@/lib/api";
import { connection, MEMO_PREFIX } from "@/lib/solana";

export const dynamic = "force-dynamic";

// Reads the guard's decisions back from chain: every Anchor buy carries a memo
// like "anchor-guard:v1|AAPLx|v=fair|z=0.84|prem=+12.3bp|...".
export async function GET(req: NextRequest) {
  let wallet: PublicKey;
  try {
    wallet = new PublicKey(req.nextUrl.searchParams.get("wallet") ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }
  try {
    const sigs = await connection().getSignaturesForAddress(wallet, { limit: 200 });
    const entries = sigs
      .filter((s) => s.memo?.includes(MEMO_PREFIX))
      .map((s) => {
        const text = s.memo!.slice(s.memo!.indexOf(MEMO_PREFIX));
        const [, symbol, ...kv] = text.split("|");
        const fields = Object.fromEntries(kv.map((p) => p.split("=") as [string, string]));
        return { signature: s.signature, blockTime: s.blockTime, failed: Boolean(s.err), symbol, fields, memo: text };
      });
    return NextResponse.json({ wallet: wallet.toBase58(), entries });
  } catch (e) {
    return errorResponse(e);
  }
}
