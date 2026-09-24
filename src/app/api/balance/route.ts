import { NextResponse, type NextRequest } from "next/server";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { errorResponse } from "@/lib/api";
import { ASSETS, USDC_MINT } from "@/lib/assets";
import { connection } from "@/lib/solana";

export const dynamic = "force-dynamic";

const TOKEN_2022_PROGRAM = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

type ParsedAmount = { mint: string; tokenAmount: { uiAmount: number | null } };

export async function GET(req: NextRequest) {
  let owner: PublicKey;
  try {
    owner = new PublicKey(req.nextUrl.searchParams.get("wallet") ?? "");
  } catch {
    return NextResponse.json({ error: "Invalid wallet" }, { status: 400 });
  }
  try {
    const conn = connection();
    const [lamports, spl, t22] = await Promise.all([
      conn.getBalance(owner),
      conn.getParsedTokenAccountsByOwner(owner, { mint: new PublicKey(USDC_MINT) }),
      conn.getParsedTokenAccountsByOwner(owner, { programId: TOKEN_2022_PROGRAM }),
    ]);
    const amount = (a: { account: { data: { parsed: { info: ParsedAmount } } } }) =>
      a.account.data.parsed.info.tokenAmount.uiAmount ?? 0;
    const usdc = spl.value.reduce((s, a) => s + amount(a), 0);

    // xStock uiAmount already includes the dividend multiplier, i.e. it is in shares.
    const holdings = ASSETS.map((asset) => ({
      ticker: asset.ticker,
      xstockSymbol: asset.xstockSymbol,
      shares: t22.value
        .filter((a) => a.account.data.parsed.info.mint === asset.xstockMint)
        .reduce((s, a) => s + amount(a), 0),
    })).filter((h) => h.shares > 0);

    return NextResponse.json({ sol: lamports / LAMPORTS_PER_SOL, usdc, holdings });
  } catch (e) {
    return errorResponse(e);
  }
}
