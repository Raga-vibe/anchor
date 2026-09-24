"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Verdict } from "@/lib/guard";
import { usd } from "@/lib/format";
import { VerdictBadge } from "./ui";

// Phone/tablet: a sticky "Buy" bar that opens the order form as a bottom sheet.
export default function BuySheet({
  ticker,
  perShare,
  verdict,
  children,
}: {
  ticker: string;
  perShare?: number;
  verdict?: Verdict;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 px-4 pb-3 md:bottom-0 md:pb-5 lg:hidden">
        <div className="mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-hairline bg-surface/90 p-2.5 pl-4 shadow-float backdrop-blur-xl">
          <div className="min-w-0 flex-1">
            <div className="tabular text-sm font-semibold">{perShare ? `${usd(perShare)} / share` : ticker}</div>
            <div className="mt-0.5">{verdict && <VerdictBadge verdict={verdict} />}</div>
          </div>
          <button
            onClick={() => setOpen(true)}
            className="accent-gradient rounded-xl px-6 py-3 text-sm font-semibold text-white shadow-[0_10px_30px_-12px_var(--accent)]"
          >
            Buy {ticker}
          </button>
        </div>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label={`Buy ${ticker}`}>
          <button className="animate-fade-in absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} aria-label="Close" />
          <div
            className="animate-sheet-up absolute inset-x-0 bottom-0 max-h-[92dvh] overflow-y-auto rounded-t-[28px] border-t border-hairline bg-surface px-5 pb-8 pt-3 shadow-float"
            style={{ paddingBottom: "calc(2rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-hairline" />
            <div className="mx-auto max-w-md">{children}</div>
          </div>
        </div>
      )}
    </>
  );
}
