"use client";

import Link from "next/link";
import WalletButton from "@/components/WalletButton";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/", label: "Markets" },
  { href: "/activity", label: "Activity" },
  { href: "/how", label: "How it works" },
];

export function AnchorMark({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M12 7.5V21" />
      <path d="M8 11h8" />
      <path d="M4.5 14a7.5 7.5 0 0 0 15 0" />
    </svg>
  );
}

export default function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-20 border-b border-hairline bg-page/90 backdrop-blur">
      <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <AnchorMark />
          <span className="text-lg">Anchor</span>
        </Link>
        <WalletButton />
      </div>
      <nav className="mx-auto flex max-w-3xl gap-5 px-4 text-sm">
        {NAV.map((n) => {
          const active = n.href === "/" ? path === "/" || path.startsWith("/stock") : path.startsWith(n.href);
          return (
            <Link
              key={n.href}
              href={n.href}
              className={`-mb-px border-b-2 pb-2 ${active ? "border-ink font-semibold text-ink" : "border-transparent text-ink-2 hover:text-ink"}`}
            >
              {n.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
