// The universe Anchor guards. Every asset has a real US equity feed, an xStock
// feed and the xStock redemption-rate feed on Pyth Pro; some also have an Ondo
// tokenized version, which we use as an independent cross-check.
//
// Pyth Pro feed ids come from https://history.pyth-lazer.dourolabs.app/history/v1/symbols
// Mints come from Jupiter's token search (verified tokens only).

export type Asset = {
  ticker: string;
  name: string;
  kind: "stock" | "etf";
  feeds: {
    equity: number; // Equity.US.<T>/USD
    xstock: number; // Crypto.<T>X/USD
    rr: number; // Crypto.<T>X/<T>.RR  (shares per xStock token)
    ondo?: number; // Crypto.<T>ON/USD
  };
  symbols: {
    equity: string;
    xstock: string;
    rr: string;
    ondo?: string;
  };
  xstockMint: string;
  xstockSymbol: string;
  xstockDecimals: number;
  ondoMint?: string;
};

function sym(t: string, hasOndo: boolean) {
  return {
    equity: `Equity.US.${t}/USD`,
    xstock: `Crypto.${t}X/USD`,
    rr: `Crypto.${t}X/${t}.RR`,
    ...(hasOndo ? { ondo: `Crypto.${t}ON/USD` } : {}),
  };
}

export const ASSETS: Asset[] = [
  {
    ticker: "SPY",
    name: "S&P 500 ETF",
    kind: "etf",
    feeds: { equity: 1398, xstock: 1843, rr: 1842 },
    symbols: sym("SPY", false),
    xstockMint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
    xstockSymbol: "SPYx",
    xstockDecimals: 8,
  },
  {
    ticker: "QQQ",
    name: "Nasdaq 100 ETF",
    kind: "etf",
    feeds: { equity: 1363, xstock: 1837, rr: 1836 },
    symbols: sym("QQQ", false),
    xstockMint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ",
    xstockSymbol: "QQQx",
    xstockDecimals: 8,
  },
  {
    ticker: "AAPL",
    name: "Apple",
    kind: "stock",
    feeds: { equity: 922, xstock: 1792, rr: 1791, ondo: 3132 },
    symbols: sym("AAPL", true),
    xstockMint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    xstockSymbol: "AAPLx",
    xstockDecimals: 8,
    ondoMint: "123mYEnRLM2LLYsJW3K6oyYh8uP1fngj732iG638ondo",
  },
  {
    ticker: "NVDA",
    name: "NVIDIA",
    kind: "stock",
    feeds: { equity: 1314, xstock: 1833, rr: 1832, ondo: 3127 },
    symbols: sym("NVDA", true),
    xstockMint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    xstockSymbol: "NVDAx",
    xstockDecimals: 8,
    ondoMint: "gEGtLTPNQ7jcg25zTetkbmF7teoDLcrfTnQfmn2ondo",
  },
  {
    ticker: "MSFT",
    name: "Microsoft",
    kind: "stock",
    feeds: { equity: 1292, xstock: 3116, rr: 3323, ondo: 3130 },
    symbols: sym("MSFT", true),
    xstockMint: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX",
    xstockSymbol: "MSFTx",
    xstockDecimals: 8,
    ondoMint: "FRmH6iRkMr33DLG6zVLR7EM4LojBFAuq6NtFzG6ondo",
  },
  {
    ticker: "GOOGL",
    name: "Alphabet",
    kind: "stock",
    feeds: { equity: 1163, xstock: 1808, rr: 1807, ondo: 3129 },
    symbols: sym("GOOGL", true),
    xstockMint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
    xstockSymbol: "GOOGLx",
    xstockDecimals: 8,
    ondoMint: "bbahNA5vT9WJeYft8tALrH1LXWffjwqVoUbqYa1ondo",
  },
  {
    ticker: "AMZN",
    name: "Amazon",
    kind: "stock",
    feeds: { equity: 954, xstock: 3321, rr: 3322 },
    symbols: sym("AMZN", false),
    xstockMint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg",
    xstockSymbol: "AMZNx",
    xstockDecimals: 8,
  },
  {
    ticker: "META",
    name: "Meta",
    kind: "stock",
    feeds: { equity: 1272, xstock: 1824, rr: 1823 },
    symbols: sym("META", false),
    xstockMint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu",
    xstockSymbol: "METAx",
    xstockDecimals: 8,
  },
  {
    ticker: "TSLA",
    name: "Tesla",
    kind: "stock",
    feeds: { equity: 1435, xstock: 1847, rr: 1846, ondo: 3128 },
    symbols: sym("TSLA", true),
    xstockMint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    xstockSymbol: "TSLAx",
    xstockDecimals: 8,
    ondoMint: "KeGv7bsfR4MheC1CkmnAVceoApjrkvBhHYjWb67ondo",
  },
  {
    ticker: "COIN",
    name: "Coinbase",
    kind: "stock",
    feeds: { equity: 1042, xstock: 1796, rr: 1795, ondo: 3133 },
    symbols: sym("COIN", true),
    xstockMint: "Xs7ZdzSHLU9ftNJsii5fCeJhoRWSC32SQGzGQtePxNu",
    xstockSymbol: "COINx",
    xstockDecimals: 8,
    ondoMint: "5u6KDiNJXxX4rGMfYT4BApZQC5CuDNrG6MHkwp1ondo",
  },
];

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_DECIMALS = 6;

export function getAsset(ticker: string): Asset | undefined {
  return ASSETS.find((a) => a.ticker.toLowerCase() === ticker.toLowerCase());
}
