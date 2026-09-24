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

      <Section n="1" title="Measure the gap with Pyth">
        <p>
          For each stock Anchor reads four Pyth feeds: the real US equity (e.g. <Code>Equity.US.AAPL/USD</Code>), the xStock (
          <Code>Crypto.AAPLX/USD</Code>), the xStock redemption rate (<Code>Crypto.AAPLX/AAPL.RR</Code>) and, where available,
          Ondo&apos;s version (<Code>Crypto.AAPLON/USD</Code>).
        </p>
        <p>
          The redemption rate matters. xStocks reinvest dividends by raising a Token-2022 multiplier, so one AAPLx is slightly
          more than one Apple share (about 1.003 today). Ignoring it would show a permanent fake premium.
        </p>
        <Formula>premium = ln( token price ÷ (stock price × shares per token) )</Formula>
      </Section>

      <Section n="2" title="Compare with what's normal for this hour">
        <p>
          Premiums behave differently when the market is open, in extended hours, and closed. Anchor builds a 30-day hourly
          history from the Pyth History API and keeps separate baselines for each session. It uses the median and the median
          absolute deviation (MAD) instead of the mean and standard deviation, because one bad print or a Monday-open gap would
          distort ordinary averages.
        </p>
        <Formula>z = (premium − typical premium) ÷ σ</Formula>
        <p>
          σ also includes Pyth&apos;s live confidence interval for both prices. When Pyth&apos;s publishers disagree, Anchor
          becomes more cautious about calling a price unusual.
        </p>
      </Section>

      <Section n="3" title="Widen the range while the market sleeps">
        <p>
          When the US market is closed, the &ldquo;real&rdquo; price is Friday&apos;s last trade, and the true value could have
          moved since then. Anchor treats that uncertainty like a random walk: the fair range grows with the square root of the
          time since the last trade, scaled by the stock&apos;s own hourly volatility.
        </p>
        <Formula>σ(closed) = √( σ(extended)² + σ(hourly)² × hours since last trade )</Formula>
        <p>After a 60-hour weekend the fair range is several times wider than on a Tuesday afternoon, which is correct.</p>
      </Section>

      <Section n="4" title="Decide, from a buyer's point of view">
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
          Before you sign, Anchor prices the actual Jupiter quote the same way. It shows how much of the cost is the token premium
          and how much is the swap&apos;s spread and price impact, and what that means in dollars on your order.
        </p>
      </Section>

      <Section n="5" title="Leave an audit trail">
        <p>
          Each buy includes a Solana memo in the same transaction as the swap, for example{" "}
          <Code>anchor-guard:v1|AAPLx|v=fair|z=0.84|prem=+12.3bp|exec=+25.1bp|sess=overNight</Code>. The guard&apos;s decision is
          therefore public and permanent, and anyone can check it. The Activity tab reads these memos directly from the chain.
        </p>
      </Section>

      <Section n="6" title="Second opinion">
        <p>
          Where Ondo also issues the stock, Anchor runs the same test on Ondo&apos;s token. If both issuers show the same unusual
          move, it probably reflects real demand. If only one does, the problem is probably specific to that token&apos;s
          liquidity.
        </p>
      </Section>
    </article>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="flex items-center gap-2 text-lg font-semibold">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-xs text-page">{n}</span>
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
