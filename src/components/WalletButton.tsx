"use client";

import dynamic from "next/dynamic";

const LABELS = {
  "change-wallet": "Change wallet",
  connecting: "Connecting…",
  "copy-address": "Copy address",
  copied: "Copied",
  disconnect: "Disconnect",
  "has-wallet": "Connect",
  "no-wallet": "Connect wallet",
} as const;

// The wallet button reads window state; render it client-only to avoid hydration mismatches.
const Base = dynamic(() => import("@solana/wallet-adapter-react-ui").then((m) => m.BaseWalletMultiButton), {
  ssr: false,
  loading: () => <div className="h-9 w-32 rounded-full bg-hairline" />,
});

export default function WalletButton() {
  return <Base labels={LABELS} />;
}
