import "server-only";
import { NextResponse } from "next/server";

export function errorResponse(e: unknown) {
  console.error(e);
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}
