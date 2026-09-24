import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { getAsset } from "@/lib/assets";
import { fairBandAt } from "@/lib/guard";
import { guardOne } from "@/lib/guard-service";

export const dynamic = "force-dynamic";

const CHART_DAYS = 7;

export async function GET(_req: Request, { params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  const asset = getAsset(ticker);
  if (!asset) return NextResponse.json({ error: "Unknown ticker" }, { status: 404 });
  try {
    const { baseline, ...rest } = await guardOne(asset);
    const since = Date.now() / 1000 - CHART_DAYS * 86400;
    return NextResponse.json({
      asOf: Date.now(),
      ...rest,
      xstockMint: asset.xstockMint,
      pool: asset.pool,
      baseline: {
        convention: baseline.convention,
        hourlyVolBps: baseline.hourlyVolBps,
        regular: { n: baseline.buckets.regular.n, median: baseline.buckets.regular.median, scale: baseline.buckets.regular.scale },
        extended: { n: baseline.buckets.extended.n, median: baseline.buckets.extended.median, scale: baseline.buckets.extended.scale },
        closedHours: baseline.closedZ.length,
      },
      series: baseline.series
        .filter((p) => p.t >= since)
        .map((p) => {
          const band = fairBandAt(baseline, p);
          return { ...p, bandLo: band.lo, bandHi: band.hi, center: band.center };
        }),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
