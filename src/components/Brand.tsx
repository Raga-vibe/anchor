// The Anchor mark: an anchor glyph on the accent gradient.
export function AnchorGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <circle cx="12" cy="5.2" r="2.3" />
      <path d="M12 7.5v13" />
      <path d="M8.3 11h7.4" />
      <path d="M4.6 13.8a7.4 7.4 0 0 0 14.8 0" />
      <path d="M4.6 13.8l-1.4 1.6M19.4 13.8l1.4 1.6" />
    </svg>
  );
}

export function LogoMark({ size = 32 }: { size?: number }) {
  return (
    <span
      className="accent-gradient relative inline-flex shrink-0 items-center justify-center text-white shadow-[0_6px_20px_-6px_var(--accent)]"
      style={{ width: size, height: size, borderRadius: size * 0.31 }}
    >
      <span className="absolute inset-0 rounded-[inherit] bg-gradient-to-b from-white/25 to-transparent" />
      <AnchorGlyph className="relative h-[58%] w-[58%]" />
    </span>
  );
}
