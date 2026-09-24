import "server-only";

const JUP_URL = process.env.JUPITER_API_URL || "https://lite-api.jup.ag/swap/v1";

function headers(): HeadersInit {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (process.env.JUPITER_API_KEY) h["x-api-key"] = process.env.JUPITER_API_KEY;
  return h;
}

export type JupQuote = {
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  otherAmountThreshold: string;
  priceImpactPct: string;
  routePlan: { swapInfo: { label: string } }[];
  [k: string]: unknown;
};

export async function getQuote(inputMint: string, outputMint: string, amount: bigint, slippageBps = 100) {
  const url = new URL(`${JUP_URL}/quote`);
  url.searchParams.set("inputMint", inputMint);
  url.searchParams.set("outputMint", outputMint);
  url.searchParams.set("amount", amount.toString());
  url.searchParams.set("slippageBps", String(slippageBps));
  url.searchParams.set("restrictIntermediateTokens", "true");
  // Leave room in the transaction for our memo instruction.
  url.searchParams.set("maxAccounts", "50");
  const res = await fetch(url, { headers: headers(), cache: "no-store" });
  if (!res.ok) throw new Error(`Jupiter quote ${res.status}: ${await res.text()}`);
  return (await res.json()) as JupQuote;
}

export type JupIx = {
  programId: string;
  accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[];
  data: string; // base64
};

export type JupSwapInstructions = {
  computeBudgetInstructions: JupIx[];
  setupInstructions: JupIx[];
  swapInstruction: JupIx;
  cleanupInstruction?: JupIx | null;
  otherInstructions?: JupIx[];
  addressLookupTableAddresses: string[];
};

export async function getSwapInstructions(quote: JupQuote, userPublicKey: string) {
  const res = await fetch(`${JUP_URL}/swap-instructions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      quoteResponse: quote,
      userPublicKey,
      wrapAndUnwrapSol: true,
      dynamicComputeUnitLimit: true,
      prioritizationFeeLamports: { priorityLevelWithMaxLamports: { maxLamports: 200_000, priorityLevel: "high" } },
    }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Jupiter swap-instructions ${res.status}: ${await res.text()}`);
  return (await res.json()) as JupSwapInstructions;
}
