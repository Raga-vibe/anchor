import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getAsset } from "@/lib/assets";
import type { JupQuote } from "@/lib/jupiter";
import { buildGuardedSwap } from "@/lib/trade";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json()) as { ticker?: string; userPublicKey?: string; quote?: JupQuote };
  const asset = getAsset(body.ticker ?? "");
  if (!asset || !body.userPublicKey || !body.quote) {
    return NextResponse.json({ error: "ticker, userPublicKey and quote are required" }, { status: 400 });
  }
  try {
    return NextResponse.json(await buildGuardedSwap(asset, body.userPublicKey, body.quote));
  } catch (e) {
    return errorResponse(e);
  }
}
