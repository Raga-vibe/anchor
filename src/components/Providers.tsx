"use client";

import { useMemo, type ReactNode } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";

// All RPC traffic goes through our API routes; the client connection is only a
// required context for the wallet adapter.
const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";

export default function Providers({ children }: { children: ReactNode }) {
  // Wallet Standard auto-detects Phantom, Solflare, Backpack, etc.
  const wallets = useMemo(() => [], []);
  return (
    <ConnectionProvider endpoint={PUBLIC_RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
