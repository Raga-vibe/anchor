# Anchor

**Own US stocks in dollars, and never overpay for the token.**

Anchor is a mobile-first app for buying tokenized US stocks (xStocks) with USDC on Solana. Before every buy, its **fair-price guard** checks the token against the real US-listed stock, priced by Pyth on Solana, and tells you in plain words whether the price is fair, cheaper than usual, or one to wait on.

**[Live demo](https://anchor-phi-dusky.vercel.app)** · Built for [Stocklana](https://hackathons.solana.com/hackathons/stocklana): main track and *Best use of Pyth market data*

![Anchor](https://anchor-phi-dusky.vercel.app/opengraph-image)

---

## The problem

A young professional in Lagos, Accra or Istanbul saves in stablecoins to protect against a weak local currency and wants long-term US stock exposure, but can't open a US brokerage account. Tokenized stocks on Solana solve that.

They also add a hidden risk. The token trades 24/7 and the real market doesn't, so at night and on weekends the token can drift away from the share it represents. A retail buyer can't see this, and pays whatever the pool quotes.

## What Anchor does

- **Markets.** 9 stocks and ETFs (SPY, QQQ, AAPL, NVDA, MSFT, GOOGL, AMZN, META, TSLA), each with a live **fair-price meter** showing where the token's price sits against its normal range.
- **A plain-language verdict** for each stock (**Fair**, **Discount**, **Pricey** or **Wait**) with the cost in dollars, for example "about $1.40 extra per $100".
- **Guarded buy.** Your actual Jupiter quote is checked before you sign. It separates the token premium from the swap's spread and price impact, and a **Wait** verdict needs an explicit confirmation.
- **On-chain receipts.** The guard's verdict is written in a Solana memo in the **same transaction** as the swap. The Activity tab reads these memos back from the chain, so anyone can verify what the guard said at the moment of each trade.

## Why Solana

- **The problem is on-chain.** Premiums appear because tokenized stocks trade when US exchanges are closed. Solana is where xStocks have their liquidity.
- **Small buys make sense.** Sub-cent fees make $10–$25 purchases practical, which fits people saving a little each week.
- **Dollars are already here.** Users hold USDC on Solana, so there's no FX conversion or bank wire.
- **Verifiable data and decisions.** The fair price comes from Pyth accounts on Solana, and every verdict is recorded on-chain.

## How the guard works

| Input | Source |
|---|---|
| Real stock price | **Pyth** `Equity.US.<T>/USD`, read directly from its price account on Solana, with its confidence interval |
| Token price | Midpoint of a live $100 **Jupiter** buy quote and the matching sell quote |
| Shares per token | The xStock mint's Token-2022 *ScaledUiAmount* multiplier (dividends are reinvested) |
| What's normal | 30 days of hourly prices from the token's main pool and the US-listed stock, including pre/post market |

```
premium  = ln( token price / (stock price × shares per token) )

live market:    z = (premium − typical) / √(σ_session² + c_pyth²)
market closed:  z = (premium − typical) / √(σ_extended² + σ_hourly² · hours_closed + c_pyth²)

Fair |z| < 2 · Discount z ≤ −2 · Pricey 2 ≤ z < 3 (or swap cost > 0.5%) · Wait z ≥ 3
```

- **Dividend-aware.** One raw xStock is slightly more than one share (≈1.0057 for SPYx). Without this correction there would be a permanent fake premium. On real data, the 30-day median pool/stock ratio for SPYx is **1.00568**, which matches its on-chain multiplier.
- **Two-sided mid, not last trade.** Pool "last trade" prices bounce between buy and sell prints, by as much as ±0.35%. Using the midpoint of executable quotes removes that noise.
- **Robust baselines.** Separate baselines for regular and extended hours, built from the median and MAD of hourly averages. Averaging halves the noise compared with closing prices (SPY σ 29 → 14 bp).
- **Uncertainty grows while the market sleeps.** When the US market is closed, the fair range widens like a random walk, σ·√hours, so a weekend premium isn't flagged just because Friday's close is stale.
- **One-sided for buyers.** A discount is good news; a premium is a cost.

## Architecture

```
Next.js (App Router, TypeScript, Tailwind), deployed on Vercel
├─ src/lib/guard.ts       the model: baselines, z-scores, verdicts (pure, tested)
├─ src/lib/pyth.ts        decodes Pyth PriceUpdateV2 accounts on Solana
├─ src/lib/sources.ts     market data: Pyth, Jupiter quotes, pool + stock history, caching
├─ src/lib/trade.ts       Jupiter swap + guard memo in one v0 transaction
└─ src/app/api/*          guard, quote, swap, send, balance, audit
```

All data is fetched on the server. The wallet signs in the browser through Wallet Standard (Phantom, Solflare, Backpack). No API keys are needed.

## Run it locally

```bash
npm install
cp .env.example .env.local   # optional: a faster Solana RPC URL
npm run dev
```

- `npm run test:guard` runs the model against simulated premiums with known answers.
- `npm run seed` refreshes the fallback history snapshot in `data/seed.json`, which is used only if a history source is unavailable.

Swaps are mainnet only, because xStocks don't exist on devnet. xStocks are not available to US persons.

## What's next

- **Guard-timed recurring buys.** A weekly USDC buy that waits, within a set window, for a Fair or Discount verdict.
- **Guided portfolios.** A short risk questionnaire leading to a diversified basket.
- **Embedded wallet** so first-time users don't need a seed phrase.
- **Price alerts:** "tell me when NVDAx is back to fair."

## Credits

Pyth Network (prices), Jupiter (quotes and routing), Backed xStocks, GeckoTerminal and Yahoo Finance (history), Solana Wallet Adapter. Open-source libraries are used as npm dependencies. All application code was written for this hackathon.

*Anchor is a hackathon prototype, not investment advice.*
