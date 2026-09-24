import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { guardAll } from "@/lib/guard-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const assets = await guardAll();
    return NextResponse.json({ asOf: Date.now(), assets });
  } catch (e) {
    return errorResponse(e);
  }
}
