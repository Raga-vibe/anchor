import { NextResponse } from "next/server";
import { errorResponse } from "@/lib/api";
import { connection } from "@/lib/solana";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const POLL_MS = 1500;
const TIMEOUT_MS = 50_000;

// Broadcasts a wallet-signed transaction and waits for confirmation by polling
// (no websockets needed, so it works on serverless hosts).
export async function POST(req: Request) {
  const { transaction } = (await req.json()) as { transaction?: string };
  if (!transaction) return NextResponse.json({ error: "transaction is required" }, { status: 400 });
  try {
    const conn = connection();
    const raw = Buffer.from(transaction, "base64");
    const signature = await conn.sendRawTransaction(raw, { skipPreflight: false, maxRetries: 3 });

    const started = Date.now();
    while (Date.now() - started < TIMEOUT_MS) {
      const { value } = await conn.getSignatureStatuses([signature]);
      const s = value[0];
      if (s?.err) return NextResponse.json({ signature, status: "failed", error: JSON.stringify(s.err) }, { status: 200 });
      if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") {
        return NextResponse.json({ signature, status: "confirmed" });
      }
      // Re-broadcast while pending; duplicate sends are harmless.
      await conn.sendRawTransaction(raw, { skipPreflight: true, maxRetries: 0 }).catch(() => {});
      await new Promise((r) => setTimeout(r, POLL_MS));
    }
    return NextResponse.json({ signature, status: "pending" });
  } catch (e) {
    return errorResponse(e);
  }
}
