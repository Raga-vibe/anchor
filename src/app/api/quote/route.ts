import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api";
import { getAsset } from "@/lib/assets";
import { guardedQuote } from "@/lib/trade";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const asset = getAsset(req.nextUrl.searchParams.get("ticker") ?? "");
  const usdc = Number(req.nextUrl.searchParams.get("usdc"));
  if (!asset) return NextResponse.json({ error: "Unknown ticker" }, { status: 404 });
  try {
    return NextResponse.json(await guardedQuote(asset, usdc));
  } catch (e) {
    return errorResponse(e);
  }
}
