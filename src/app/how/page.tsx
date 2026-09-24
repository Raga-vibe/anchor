import type { ReactNode } from "react";
import FairMeter from "@/components/FairMeter";

export const metadata = { title: "How the guard works · Anchor" };

export default function How() {
  return (
    <article className="space-y-12">
      <header className="max-w-2xl animate-fade-up">
        <div className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">The method</div>
        <h1 className="mt-3 font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl">How the fair-price guard works</h1>
        <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
          A tokenized share should cost about the same as the real share. It often doesn&apos;t, especially at night and on
          weekends, when the token keeps trading but the US market is shut. Anchor measures that gap, compares it with what&apos;s
          normal, and tells you when it&apos;s unusual.
        </p>
      </header>

      {/* the verdicts, visually */}
      <section className="grid gap-4 md:grid-cols-3 animate-fade-up [animation-delay:80ms]">
        <Example title="Fair" caption="Within the normal range for this hour. Buy as usual." z={0.4} label="+0.05%" verdict="fair" />
        <Example title="Discount" caption="Cheaper than it usually trades. A good moment if you were buying anyway." z={-2.6} label="−0.55%" verdict="discount" />
        <Example title="Wait" caption="Far above normal. You have to confirm before buying." z={3.4} label="+1.20%" verdict="wait" />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Step n="1" title="The real price, from Pyth on Solana">
          <p>
            The fair value comes from Pyth&apos;s US equity feeds (e.g. <Code>Equity.US.AAPL/USD</Code>). Anchor reads them
            directly from Pyth&apos;s price accounts on Solana, the same verified accounts a smart contract would read. It uses
            Pyth&apos;s confidence interval as well as the price, and you can verify any price on Solscan.
          </p>
        </Step>

        <Step n="2" title="The token's price, from the market">
          <p>
            The token price is the midpoint of a live $100 buy quote and the matching sell quote on Jupiter. That is what you
            could actually trade at. A pool&apos;s &ldquo;last trade&rdquo; price bounces between buy and sell prints and would
            create fake premiums.
          </p>
          <p>
            xStocks reinvest dividends by raising a Token-2022 multiplier, so one raw AAPLx is slightly more than one share.
            Anchor reads the multiplier from the token mint.
          </p>
          <Formula>premium = ln( token ÷ (stock × shares per token) )</Formula>
        </Step>

        <Step n="3" title="Compare with what's normal for this hour">
          <p>
            A 30-day hourly history of the premium, from the token&apos;s main pool and the US-listed stock, sets what&apos;s
            normal. Regular and extended hours get separate baselines. Anchor uses hourly averages rather than single trades, and
            the median and MAD rather than the mean, so one bad print can&apos;t distort the baseline.
          </p>
          <Formula>z = (premium − typical) ÷ σ</Formula>
          <p>σ also includes Pyth&apos;s live confidence interval. When publishers disagree, Anchor is slower to call a price unusual.</p>
        </Step>

        <Step n="4" title="Widen the range while the market sleeps">
          <p>
            When the US market is closed, the &ldquo;real&rdquo; price is the last trade, and the true value may have drifted
            since. The fair range grows like a random walk, with the square root of the hours since the last trade.
          </p>
          <WidenIllustration />
          <Formula>σ(closed) = √( σ² + σ(hourly)² × hours )</Formula>
        </Step>

        <Step n="5" title="Judge it from a buyer's side">
          <ul className="space-y-1.5">
            <Li>
              <b className="text-ink">Fair</b>: within ±2σ of normal.
            </Li>
            <Li>
              <b className="text-ink">Discount</b>: 2σ or more below normal. Good news for a buyer.
            </Li>
            <Li>
              <b className="text-ink">Pricey</b>: 2–3σ above normal, or the swap itself costs more than 0.5%.
            </Li>
            <Li>
              <b className="text-ink">Wait</b>: 3σ or more above normal. You have to confirm before buying.
            </Li>
          </ul>
          <p>
            Before you sign, Anchor prices your actual Jupiter quote the same way. It separates the token premium from the
            swap&apos;s spread and price impact, and shows what that means in dollars.
          </p>
        </Step>

        <Step n="6" title="Leave a receipt on-chain">
          <p>
            Each buy carries a Solana memo in the same transaction as the swap. The guard&apos;s decision is therefore public
            and permanent, and anyone can check it. The Activity tab reads these memos directly from the chain.
          </p>
          <Formula small>anchor-guard:v1|AAPLx|v=fair|z=0.84|prem=+12.3bp|exec=+25.1bp|sess=regular</Formula>
        </Step>
      </section>
    </article>
  );
}

function Example({ title, caption, z, label, verdict }: { title: string; caption: string; z: number; label: string; verdict: "fair" | "discount" | "wait" }) {
  return (
    <div className="card p-5">
      <div className="font-serif text-3xl tracking-tight">{title}</div>
      <FairMeter z={z} verdict={verdict} size="lg" label={label} zones={false} />
      <p className="mt-1 text-sm leading-relaxed text-ink-2">{caption}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <section className="card space-y-3 p-6 text-[15px] leading-relaxed text-ink-2">
      <div className="flex items-center gap-3">
        <span className="accent-gradient flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold text-white">
          {n}
        </span>
        <h2 className="font-serif text-[26px] leading-tight tracking-tight text-ink">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Li({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-2.5 h-1 w-1 shrink-0 rounded-full bg-muted" />
      <span>{children}</span>
    </li>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-surface-2 px-1.5 py-0.5 font-mono text-[12.5px] text-ink ring-1 ring-hairline">{children}</code>;
}

function Formula({ children, small }: { children: ReactNode; small?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-hairline bg-surface-2 px-4 py-3 font-mono text-ink ${
        small ? "break-all text-[11.5px] leading-relaxed" : "text-[13px] leading-relaxed"
      }`}
    >
      {children}
    </div>
  );
}

// The fair range over a closed weekend: ±2σ√h around the last trade.
function WidenIllustration() {
  const W = 320;
  const H = 120;
  const pts = Array.from({ length: 61 }, (_, h) => h);
  const x = (h: number) => 10 + (h / 60) * (W - 20);
  const y = (v: number) => H / 2 - v;
  const s = (h: number) => 6 + 6.2 * Math.sqrt(h);
  const upper = pts.map((h, i) => `${i ? "L" : "M"}${x(h).toFixed(1)},${y(s(h)).toFixed(1)}`).join("");
  const lower = [...pts].reverse().map((h) => `L${x(h).toFixed(1)},${y(-s(h)).toFixed(1)}`).join("");
  return (
    <figure className="rounded-xl border border-hairline bg-surface-2 p-3">
      <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label="The fair range widens with the square root of the hours the market is closed">
        <path d={upper + lower + "Z"} fill="var(--band)" />
        <line x1={x(0)} x2={x(60)} y1={H / 2} y2={H / 2} stroke="var(--muted)" strokeOpacity={0.6} />
        <circle cx={x(0)} cy={H / 2} r={4} fill="var(--accent)" />
        <text x={x(0)} y={H + 14} fontSize={10} fill="var(--muted)" className="font-mono">
          Fri close
        </text>
        <text x={x(60)} y={H + 14} fontSize={10} textAnchor="end" fill="var(--muted)" className="font-mono">
          +60 h (Mon open)
        </text>
      </svg>
      <figcaption className="mt-1 text-xs text-muted">Fair range around the last trade, widening over a weekend.</figcaption>
    </figure>
  );
}
