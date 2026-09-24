"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import WalletButton from "@/components/WalletButton";
import { LogoMark } from "@/components/Brand";

export const NAV = [
  { href: "/", label: "Markets", short: "Markets", icon: "markets" },
  { href: "/activity", label: "Activity", short: "Activity", icon: "activity" },
  { href: "/how", label: "How it works", short: "How it works", icon: "how" },
] as const;

export function isActive(path: string, href: string) {
  return href === "/" ? path === "/" || path.startsWith("/stock") : path.startsWith(href);
}

export default function Header() {
  const path = usePathname();
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-page/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2.5" aria-label="Anchor home">
          <LogoMark size={32} />
          <span className="font-serif text-[26px] leading-none tracking-tight">Anchor</span>
        </Link>
        <nav className="hidden items-center gap-1 rounded-full border border-hairline bg-surface/70 p-1 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={`rounded-full px-4 py-1.5 text-sm transition-colors ${
                isActive(path, n.href) ? "bg-ink font-medium text-page" : "text-ink-2 hover:text-ink"
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <WalletButton />
      </div>
    </header>
  );
}
