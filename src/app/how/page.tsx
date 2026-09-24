import type { ReactNode } from "react";

export const metadata = { title: "How the guard works · Anchor" };

export default function How() {
  return (
    <article className="space-y-6 text-[15px] leading-relaxed">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">How the fair-price guard works</h1>
        <p className="text-ink-2">
          A tokenized share should cost about the same as the real share. It often doesn&apos;t, especially at night and on
          weekends, when the token keeps trading but the US market is shut. Anchor measures that gap and tells you when it&apos;s
          unusual.
        </p>
      </header>

      <Section n="1" title="The real price, from Pyth on Solana">
        <p>
          The fair value comes from Pyth&apos;s US equity feeds (e.g. <Code>Equity.US.AAPL/USD</Code>). Anchor reads them
          directly from Pyth&apos;s price accounts on Solana, the same verified accounts a smart contract would read. It uses
          Pyth&apos;s confidence interval as well as the price, and you can verify any price on Solscan.
        </p>
      </Section>

      <Section n="2" title="The token's price, from the market">
        <p>
          The token price is the midpoint of a live $100 buy quote and the matching sell quote on Jupiter. That is what you could
          actually trade at. Using a pool&apos;s &ldquo;last trade&rdquo; price instead would bounce between buy and sell prints
          and create fake premiums and discounts.
        </p>
        <p>
          xStocks reinvest dividends by raising a Token-2022 multiplier, so one raw AAPLx is slightly more than one Apple share
          (about 1.003 today). Anchor reads the multiplier from the token mint. Ignoring it would show a permanent fake premium.
        </p>
        <Formula>premium = ln( token price ÷ (stock price × shares per token) )</Formula>
      </Section>

      <Section n="3" title="Compare with what's normal for this hour">
        <p>
          Anchor builds a 30-day hourly history of the premium from the token&apos;s main pool and the US-listed stock (including
          pre-market and after-hours). It keeps separate baselines for regular and extended hours. It uses hourly average prices
          rather than single closing trades, and the median and median absolute deviation (MAD) rather than the mean and standard
          deviation, so one bad print or a gap at the open doesn&apos;t skew what counts as normal.
        </p>
        <Formula>z = (premium − typical premium) ÷ σ</Formula>
        <p>σ also includes Pyth&apos;s live confidence interval. When Pyth&apos;s publishers disagree, Anchor is slower to call a price unusual.</p>
      </Section>

      <Section n="4" title="Widen the range while the market sleeps">
        <p>
          When the US market is closed, the &ldquo;real&rdquo; price is the last trade, and the true value may have moved since.
          Anchor treats that uncertainty like a random walk: the fair range grows with the square root of the time since the last
          trade, scaled by the stock&apos;s own hourly volatility.
        </p>
        <Formula>σ(closed) = √( σ(extended)² + σ(hourly)² × hours since last trade )</Formula>
        <p>After a 60-hour weekend, the fair range is several times wider than on a Tuesday afternoon, which is correct.</p>
      </Section>

      <Section n="5" title="Decide, from a buyer's point of view">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Fair</b>: within ±2σ of normal.
          </li>
          <li>
            <b>Discount</b>: 2σ or more below normal. Cheaper than usual, which is good news for a buyer.
          </li>
          <li>
            <b>Pricey</b>: 2–3σ above normal, or the swap itself costs more than 0.5%.
          </li>
          <li>
            <b>Wait</b>: 3σ or more above normal. You have to confirm before buying.
          </li>
        </ul>
        <p>
          Before you sign, Anchor prices the actual Jupiter quote for your amount. It shows how much of the cost is the token
          premium and how much is the swap&apos;s spread and price impact, and what that means in dollars on your order.
        </p>
      </Section>

      <Section n="6" title="Leave an audit trail">
        <p>
          Each buy includes a Solana memo in the same transaction as the swap, for example{" "}
          <Code>anchor-guard:v1|AAPLx|v=fair|z=0.84|prem=+12.3bp|exec=+25.1bp|sess=regular</Code>. The guard&apos;s decision is
          therefore public and permanent, and anyone can check it. The Activity tab reads these memos directly from the chain.
        </p>
      </Section>
    </article>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-ink text-xs text-page">{n}</span>
        {title}
      </h2>
      <div className="space-y-2 text-ink-2">{children}</div>
    </section>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-card px-1 py-0.5 text-[13px] text-ink ring-1 ring-[var(--hairline)]">{children}</code>;
}

function Formula({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto rounded-xl border border-hairline bg-card px-4 py-3 font-mono text-sm text-ink">{children}</div>;
}
