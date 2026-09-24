import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";
import Header from "@/components/Header";
import TabBar from "@/components/TabBar";
import { LogoMark } from "@/components/Brand";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--font-instrument-serif",
});

export const metadata: Metadata = {
  title: "Anchor: US stocks at a fair price",
  description:
    "Buy tokenized US stocks with dollars on Solana. Anchor's fair-price guard checks every buy against the real stock price from Pyth.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f5f1" },
    { media: "(prefers-color-scheme: dark)", color: "#07080b" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable} antialiased`}>
      <body className="flex min-h-dvh flex-col font-sans">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-5xl flex-1 overflow-x-clip px-4 pb-32 pt-6 sm:px-6 md:pb-16">{children}</main>
          <footer className="mx-auto hidden w-full max-w-5xl px-6 pb-10 md:block">
            <div className="flex items-start justify-between gap-8 border-t border-hairline pt-6 text-xs leading-relaxed text-muted">
              <div className="flex items-center gap-2">
                <LogoMark size={20} />
                <span className="font-serif text-base text-ink-2">Anchor</span>
              </div>
              <p className="max-w-xl text-right">
                Real stock prices from Pyth Network, read on Solana. Swaps routed by Jupiter. xStocks are issued by Backed and
                are not available to US persons. Anchor is a hackathon prototype, not investment advice.
              </p>
            </div>
          </footer>
          <TabBar />
        </Providers>
      </body>
    </html>
  );
}
