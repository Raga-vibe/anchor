import "server-only";
import { NextResponse } from "next/server";
import { MissingPythKeyError } from "./pyth";

export function errorResponse(e: unknown) {
  if (e instanceof MissingPythKeyError) {
    return NextResponse.json({ error: e.message, code: "NO_PYTH_KEY" }, { status: 503 });
  }
  console.error(e);
  return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
}
