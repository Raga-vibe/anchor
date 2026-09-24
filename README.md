# Anchor

**Own US stocks in dollars, and never overpay for the token.**

Anchor is a mobile-first app for buying tokenized US stocks (xStocks) with USDC on Solana. Every buy passes through a **fair-price guard**: it compares the token with the real US-listed stock, priced by Pyth on Solana, and warns you when the gap is statistically unusual, rather than applying a fixed cutoff.

Built for the [Stocklana hackathon](https://hackathons.solana.com/hackathons/stocklana): main track and *Best use of Pyth market data*.

## The problem

A young professional in Lagos, Accra or Istanbul saves in stablecoins to protect against a weak local currency. They want long-term US equity exposure, but a US brokerage account is hard or impossible to open. Tokenized stocks on Solana solve the access problem.

They also add a new risk. The token trades 24/7 and the real market doesn't, so at night and on weekends the token can drift above or below the stock it represents. A retail buyer has no way to see this. They just pay whatever the pool quotes.

## What Anchor does

1. **Markets.** Shows 9 stocks and ETFs (SPY, QQQ, AAPL, NVDA, MSFT, GOOGL, AMZN, META, TSLA). Each shows the token's price per share, its premium over the real stock, and a verdict: **Fair**, **Discount**, **Pricey** or **Wait**.
2. **A plain-language verdict** for each stock, such as "you'd pay about $1.40 more per $100 than usual", with a 7-day chart of the premium against its fair range.
3. **Guarded buy.** Before you sign, Anchor prices the actual Jupiter quote. It separates the token premium from the swap's own spread and impact, shows the dollar cost on your order, and requires an explicit confirmation when the verdict is **Wait**.
4. **On-chain audit trail.** The guard's decision is written in a Solana memo in the **same transaction** as the swap. The Activity tab reads these memos back from the chain, so anyone can verify what the guard said at the moment of each trade.

## Why Solana

- **24/7 markets.** The premium problem exists *because* tokenized stocks trade when US exchanges don't. That's specific to on-chain stocks, and Solana is where xStocks have their liquidity.
- **Small, frequent buys.** Sub-cent fees make $10–$25 purchases practical, which fits people saving a small amount each week.
- **USDC settlement.** Users already hold dollars on Solana, so there are no FX or wire steps.

## How the guard works

**Data.** Every source is free and needs no API key:

| What | Source |
|---|---|
| Real stock price (live) | **Pyth** `Equity.US.<T>/USD`, read directly from its PriceUpdateV2 account on Solana (the Pyth receiver program), including the confidence interval |
| Token price (live) | Midpoint of a real $100 **Jupiter** buy quote and the matching sell quote |
| Shares per token | The xStock mint's Token-2022 *ScaledUiAmount* multiplier (on-chain) |
| 30-day hourly history | The token's main xStock/USDC pool (GeckoTerminal) and the US-listed stock including pre/post market (Yahoo), with a committed snapshot as fallback |

```
premium   = ln( token / (stock × shares-per-token) )             # bps

live:      z = (premium − median_session) / √(σ_session² + c_pyth²)
closed:    z = (premium − median_regular) / √(σ_ext² + σ_hourly² · h + c_pyth²)
```

- **Shares per token.** xStocks reinvest dividends by raising a multiplier, so one raw token is slightly more than one share (≈1.0057 for SPYx). Without this correction there'd be a permanent fake premium of 30–60 bps. Anchor also detects automatically whether prices are quoted per raw token or per share. On real data, the 30-day median pool/stock ratio for SPYx is 1.00568, matching its on-chain multiplier.
- **Two-sided mid, not last trade.** A pool's last trade bounces between buy and sell prints, by as much as ±0.35%. Using the midpoint of executable quotes removes that noise, and the spread is reported separately as a trading cost.
- **Hourly averages for history.** Using hourly average prices (OHLC/4) instead of closes halves the premium noise, for example SPY σ 29 → 14 bp and QQQ 33 → 13 bp. That makes the guard about twice as sensitive to real mispricing.
- **Session-aware baselines** for regular and extended hours, using the median and MAD, which are robust to bad prints and gaps at the open.
- **Uncertainty grows while the market sleeps.** When the reference is stale, the fair range widens like a random walk: σ_hourly·√h.
- **Pyth's confidence interval** widens the range when publishers disagree.
- **One-sided for buyers.** A discount is good news, and a premium is a cost. Wait = z ≥ 3, Pricey = z ≥ 2 or swap cost > 0.5%, Discount = z ≤ −2.

`npm run test:guard` runs a simulation with known premium regimes and checks that the model recovers its parameters and gives the right verdicts.

## Architecture

```
Next.js (App Router, TypeScript, Tailwind), mobile-first
├─ /api/guard, /api/guard/[ticker]   Pyth on-chain + Jupiter mid + 30d hourly history → guard
├─ /api/quote                         Jupiter quote + on-chain share multiplier → execution check
├─ /api/swap                          Jupiter swap-instructions + memo → unsigned v0 transaction
├─ /api/send                          broadcast signed tx, poll for confirmation
├─ /api/audit                         read guard memos back from chain
├─ src/lib/guard.ts                   the model (pure, tested)
├─ src/lib/pyth.ts                    decodes Pyth PriceUpdateV2 accounts
└─ src/lib/sources.ts                 market data sources + caching
```

All data is fetched on the server. The wallet signs in the browser via Wallet Standard (Phantom, Solflare, Backpack).

## Run it

```bash
npm install
cp .env.example .env.local   # set SOLANA_RPC_URL (a free Helius URL is best)
npm run dev
```

`npm run seed` refreshes the fallback history snapshot in `data/seed.json`.

Swaps are **mainnet only**, because xStocks don't exist on devnet. Use a small amount of USDC plus about 0.02 SOL for fees and the token account. xStocks are not available to US persons.

## What's next

- **Guard-timed recurring buys.** A weekly USDC buy that waits, within a set window, for a Fair or Discount verdict.
- **Guided portfolio.** A short risk questionnaire leading to a diversified basket weighted by risk parity with shrinkage covariance.
- **Embedded wallet** (no seed phrase) for first-time users.
- **Alerts:** "tell me when NVDAx is back to fair."

## Credits

Pyth Network (prices), Jupiter (routing and quotes), Backed xStocks, GeckoTerminal and Yahoo Finance (history), Solana Wallet Adapter. Open-source components are used as npm dependencies. All application code was written for this hackathon.
