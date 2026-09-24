import { ImageResponse } from "next/og";

export const alt = "Anchor: buy US stocks in dollars, never overpay for the token";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Social preview card for links to the app.
export default function OpengraphImage() {
  const segments = [
    { flex: 2, color: "rgba(52, 211, 153, 0.6)" },
    { flex: 4, color: "rgba(52, 211, 153, 0.22)" },
    { flex: 1, color: "rgba(251, 191, 36, 0.75)" },
    { flex: 1, color: "rgba(248, 113, 113, 0.8)" },
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "radial-gradient(900px 500px at 50% -120px, rgba(110,112,255,0.35), #07080b 70%)",
          color: "#f3f4f6",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #6366f1, #a78bfa)",
            }}
          >
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="5.2" r="2.3" />
              <path d="M12 7.5v13" />
              <path d="M8.3 11h7.4" />
              <path d="M4.6 13.8a7.4 7.4 0 0 0 14.8 0" />
            </svg>
          </div>
          <div style={{ fontSize: 44, letterSpacing: -1 }}>Anchor</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 76, lineHeight: 1.04, letterSpacing: -2.5, fontWeight: 600 }}>US stocks in dollars.</div>
          <div style={{ fontSize: 76, lineHeight: 1.04, letterSpacing: -2.5, fontWeight: 600, color: "#a5a6ff" }}>
            Never overpay for the token.
          </div>
          <div style={{ marginTop: 26, fontSize: 28, color: "#a3a9b4" }}>
            A fair-price guard for tokenized stocks on Solana, checked against Pyth.
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", position: "relative", height: 20 }}>
            <div style={{ display: "flex", width: "100%", height: 14, gap: 5, marginTop: 3 }}>
              {segments.map((s, i) => (
                <div key={i} style={{ flex: s.flex, background: s.color, borderRadius: 999 }} />
              ))}
            </div>
            <div
              style={{
                position: "absolute",
                left: "52%",
                top: -6,
                width: 32,
                height: 32,
                borderRadius: 999,
                background: "#f3f4f6",
                border: "6px solid #07080b",
              }}
            />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#6b717c" }}>
            <span>Cheaper</span>
            <span>Fair</span>
            <span>Wait</span>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
