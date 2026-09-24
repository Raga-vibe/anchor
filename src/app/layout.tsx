import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Anchor: US stocks at a fair price",
  description:
    "Buy tokenized US stocks with dollars on Solana. Anchor's fair-price guard checks every buy against the real stock price using Pyth.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f9f9f7" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d0d" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-3xl flex-1 px-4 pb-16 pt-5">{children}</main>
          <footer className="mx-auto w-full max-w-3xl px-4 pb-8 text-xs leading-relaxed text-muted">
            Prices from Pyth Network. Swaps routed by Jupiter. xStocks are issued by Backed and are not available to US
            persons. Anchor is a hackathon prototype, not investment advice.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
