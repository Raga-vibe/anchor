// The universe Anchor guards. Each asset has:
//  - a live Pyth price account on Solana for the real US equity (Pyth push
//    oracle, shard 1, sponsored and updated continuously), and
//  - an xStock whose deepest USDC pool we use for the token's market price.
//
// Pyth feed ids from https://hermes.pyth.network/v2/price_feeds?asset_type=equity
// Price accounts = PDA([shard u16 LE, feed id], pythWSnswVUd12oZpeFP8e9CVaEqJg25g1Vtc2biRsT)
// Pools from GeckoTerminal (largest xStock/USDC pool). Mints from Jupiter (verified).

export type Asset = {
  ticker: string;
  name: string;
  kind: "stock" | "etf";
  pythFeedId: string; // Equity.US.<T>/USD
  pythAccount: string; // on-chain PriceUpdateV2 account
  pool: string; // xStock/USDC pool (xStock is the base token)
  xstockMint: string;
  xstockSymbol: string;
  xstockDecimals: number;
};

export const ASSETS: Asset[] = [
  {
    ticker: "SPY",
    name: "S&P 500 ETF",
    kind: "etf",
    pythFeedId: "19e09bb805456ada3979a7d1cbb4b6d63babc3a0f8e8a9509f68afa5c4c11cd5",
    pythAccount: "CRDaGwcVnKdRNRtx6fjHtvrBgKM5U55AhbqBWhtPMDA",
    pool: "6truu3rZuiB9rKQg4VYC3Dt3QwV7DgwGqXrYUcrvnDDE",
    xstockMint: "XsoCS1TfEyfFhfvj8EtZ528L3CaKBDBRqRapnBbDF2W",
    xstockSymbol: "SPYx",
    xstockDecimals: 8,
  },
  {
    ticker: "QQQ",
    name: "Nasdaq 100 ETF",
    kind: "etf",
    pythFeedId: "9695e2b96ea7b3859da9ed25b7a46a920a776e2fdae19a7bcfdf2b219230452d",
    pythAccount: "TWtoAxPvaXy46uy3Vr4UwFxmWdgyMjpZAJSFxV4RGbF",
    pool: "GMjGLWzvK75LPetrgAmdeXnvxc4fUuQPwJxeQqTDU1aG",
    xstockMint: "Xs8S1uUs1zvS2p7iwtsG3b6fkhpvmwz4GYU3gWAmWHZ",
    xstockSymbol: "QQQx",
    xstockDecimals: 8,
  },
  {
    ticker: "AAPL",
    name: "Apple",
    kind: "stock",
    pythFeedId: "49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
    pythAccount: "D9uk39pqZMcnmtPP9WeC8cREUpKZmyXLga9mSQ79SphW",
    pool: "CKwJZwm7oj3nu4653N1EpDrqXbXAYXoPFiPeEnLouF8y",
    xstockMint: "XsbEhLAtcf6HdfpFZ5xEMdqW8nfAvcsP5bdudRLJzJp",
    xstockSymbol: "AAPLx",
    xstockDecimals: 8,
  },
  {
    ticker: "NVDA",
    name: "NVIDIA",
    kind: "stock",
    pythFeedId: "b1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593",
    pythAccount: "5VETJ8h3p4JrESYrzhjTDAWPEjDjfcnduqe9CjxgqBNd",
    pool: "49iMatQtoyabsYAQc8GafVq6aeBFVDxSRH44oiatyyw6",
    xstockMint: "Xsc9qvGR1efVDFGLrVsmkzv3qi45LTBjeUKSPmx9qEh",
    xstockSymbol: "NVDAx",
    xstockDecimals: 8,
  },
  {
    ticker: "MSFT",
    name: "Microsoft",
    kind: "stock",
    pythFeedId: "d0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1",
    pythAccount: "EKhrgXYwqsjgxF71Gxznui1zdoeqgxJzzPzfefEmm5un",
    pool: "CLu4kFM4nb67xrdN7vJnMxXXir8Z5hA4HJUzPFccXjsL",
    xstockMint: "XspzcW1PRtgf6Wj92HCiZdjzKCyFekVD8P5Ueh3dRMX",
    xstockSymbol: "MSFTx",
    xstockDecimals: 8,
  },
  {
    ticker: "GOOGL",
    name: "Alphabet",
    kind: "stock",
    pythFeedId: "5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6",
    pythAccount: "7aUtbtC3o3GVwRWvaDp5fxKjBq53QL3UrVmDzDgeNo8M",
    pool: "B8YAwjGYk6qidWzGBXMAxP7nYfG8g74EZ3Y4gFSsobRw",
    xstockMint: "XsCPL9dNWBMvFtTmwcCA5v3xWPSMEBCszbQdiLLq6aN",
    xstockSymbol: "GOOGLx",
    xstockDecimals: 8,
  },
  {
    ticker: "AMZN",
    name: "Amazon",
    kind: "stock",
    pythFeedId: "b5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a",
    pythAccount: "4eT5d4SJ7GjD8HMpMysSNoPV7RBVTBGzoSEkynmPLMPS",
    pool: "6m5aXAve4uh6Kt4ytKyCLWNMjd8PYP5vujwNCtycrUiD",
    xstockMint: "Xs3eBt7uRfJX8QUs4suhyU8p2M6DoUDrJyWBa8LLZsg",
    xstockSymbol: "AMZNx",
    xstockDecimals: 8,
  },
  {
    ticker: "META",
    name: "Meta",
    kind: "stock",
    pythFeedId: "78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe",
    pythAccount: "6NJCSCAWy1yB1jEGhPbsMTrT4WH13o8BGD5wgPbBtdY9",
    pool: "3L7KbPVaAQA4UTecaGQYsm6UCq5F3sZM9zAYkxqYt63j",
    xstockMint: "Xsa62P5mvPszXL1krVUnU5ar38bBSVcWAB6fmPCo5Zu",
    xstockSymbol: "METAx",
    xstockDecimals: 8,
  },
  {
    ticker: "TSLA",
    name: "Tesla",
    kind: "stock",
    pythFeedId: "16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
    pythAccount: "FQB8c4zB8Emrp9W8bmyk6GanCLq4aRytHYPDAnaEpq9z",
    pool: "8aDaBQkTrS6HVMjyc6EZebgdiaXhLYGriDWKWWp1NpFF",
    xstockMint: "XsDoVfqeBukxuZHWhdvWHBhgEHjGNst4MLodqsJHzoB",
    xstockSymbol: "TSLAx",
    xstockDecimals: 8,
  },
];

export const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const USDC_DECIMALS = 6;

export function getAsset(ticker: string): Asset | undefined {
  return ASSETS.find((a) => a.ticker.toLowerCase() === ticker.toLowerCase());
}
