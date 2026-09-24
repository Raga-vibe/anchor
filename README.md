# Anchor

**Own US stocks in dollars, and never overpay for the token.**

Anchor is a mobile-first app for buying tokenized US stocks (xStocks) with USDC on Solana. Every buy passes through a **fair-price guard**: using Pyth, it compares the token with the real US-listed stock and warns you when the gap is statistically unusual, rather than applying a fixed cutoff.

Built for the [Stocklana hackathon](https://hackathons.solana.com/hackathons/stocklana): main track and *Best use of Pyth market data*.

## The problem

A young professional in Lagos, Accra or Istanbul saves in stablecoins to protect against a weak local currency. They want long-term US equity exposure, but a US brokerage account is hard or impossible to open. Tokenized stocks on Solana solve the access problem.

They also add a new risk. The token trades 24/7 and the real market doesn't, so at night and on weekends the token can drift above or below the stock it represents. A retail buyer has no way to see this. They just pay whatever the pool quotes.

## What Anchor does

1. **Markets.** Shows 10 stocks and ETFs (SPY, QQQ, AAPL, NVDA, MSFT, GOOGL, AMZN, META, TSLA, COIN). Each shows the token's price per share, its premium over the real stock, and a verdict: **Fair**, **Discount**, **Pricey** or **Wait**.
2. **A plain-language verdict** for each stock, such as "you'd pay about $1.40 more per $100 than usual", with a 7-day chart of the premium against its fair range.
3. **Guarded buy.** Before you sign, Anchor prices the actual Jupiter quote. It separates the token premium from the swap's own spread and impact, shows the dollar cost on your order, and requires an explicit confirmation when the verdict is **Wait**.
4. **On-chain audit trail.** The guard's decision is written in a Solana memo in the **same transaction** as the swap. The Activity tab reads these memos back from the chain, so anyone can verify what the guard said at the moment of each trade.

## Why Solana

- **24/7 markets.** The premium problem exists *because* tokenized stocks trade when US exchanges don't. That's specific to on-chain stocks, and Solana is where xStocks have their liquidity.
- **Small, frequent buys.** Sub-cent fees make $10–$25 purchases practical, which fits people saving a small amount each week.
- **USDC settlement.** Users already hold dollars on Solana, so there are no FX or wire steps.

## How the guard works

For each asset Anchor reads four Pyth Pro feeds: the real equity (`Equity.US.AAPL/USD`), the xStock (`Crypto.AAPLX/USD`), the xStock **redemption rate** (`Crypto.AAPLX/AAPL.RR`) and, where available, Ondo's version (`Crypto.AAPLON/USD`).

```
premium   = ln( token / (stock × shares-per-token) )             # bps

live:      z = (premium − median_session) / √(σ_session² + cX² + cE²)
closed:    z = (premium − median_regular) / √(σ_ext² + σ_hourly² · h + cX² + cE²)
```

- **Redemption rate.** xStocks reinvest dividends through the Token-2022 *ScaledUiAmount* multiplier, so one token is slightly more than one share (≈1.003 for AAPLx). Without this correction there'd be a permanent fake premium. Anchor also detects automatically which convention Pyth quotes in.
- **Session-aware baselines.** A 30-day hourly history from the Pyth History API is split into regular, extended (pre/post/overnight) and closed hours. Each bucket uses the median and MAD, which are robust to bad prints and Monday gaps.
- **Uncertainty grows while the market sleeps.** When the equity reference is stale, the fair range widens like a random walk: σ_hourly·√h, where h is the hours since the last US trade.
- **Pyth confidence intervals** (cX, cE) widen the range when publishers disagree.
- **One-sided for buyers.** A discount is good news, and a premium is a cost. Wait = z ≥ 3, Pricey = z ≥ 2 or swap cost > 0.5%, Discount = z ≤ −2.
- **Second opinion.** The same test runs on Ondo's token. If both issuers move together, that suggests real demand. If only one moves, that suggests a liquidity problem with that token.

`npm run test:guard` runs a simulation with known premium regimes and checks that the model recovers its parameters and gives the right verdicts.

## Architecture

```
Next.js (App Router, TypeScript, Tailwind), mobile-first
├─ /api/guard, /api/guard/[ticker]   Pyth Pro REST (latest) + History API (30d hourly) → guard
├─ /api/quote                         Jupiter quote + on-chain share multiplier → execution check
├─ /api/swap                          Jupiter swap-instructions + memo → unsigned v0 transaction
├─ /api/send                          broadcast signed tx, poll for confirmation
├─ /api/audit                         read guard memos back from chain
└─ src/lib/guard.ts                   the model (pure, tested)
```

The Pyth API key stays on the server and never reaches the browser. The wallet signs in the browser via Wallet Standard (Phantom, Solflare, Backpack).

## Run it

```bash
npm install
cp .env.example .env.local   # add PYTH_PRO_API_KEY (free Pyth Terminal account)
npm run dev
```

Swaps are **mainnet only**, because xStocks don't exist on devnet. Use a small amount of USDC plus about 0.02 SOL for fees and the token account. xStocks are not available to US persons.

## What's next

- **Guard-timed recurring buys.** A weekly USDC buy that waits, within a set window, for a Fair or Discount verdict.
- **Guided portfolio.** A short risk questionnaire leading to a diversified basket weighted by risk parity with shrinkage covariance.
- **Embedded wallet** (no seed phrase) for first-time users.
- **Alerts:** "tell me when NVDAx is back to fair."

## Credits

Pyth Network (prices), Jupiter (routing), Backed xStocks, Ondo Global Markets, Solana Wallet Adapter. Open-source components are used as npm dependencies. All application code was written for this hackathon.
