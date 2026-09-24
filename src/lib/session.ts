// US equity session calendar, mirroring the Pyth Pro schedule for Equity.US.*
// feeds (regular 09:30-16:00, pre 04:00-09:30, post 16:00-20:00, overnight
// 20:00-04:00 Sun-Thu nights; closed Fri 20:00 -> Sun 20:00 and on holidays).
// Live data uses Pyth's own `marketSession`; this is only for labelling
// historical candles.

export type Session = "regular" | "preMarket" | "postMarket" | "overNight" | "closed";
export type Bucket = "regular" | "extended" | "closed";

// Full-day NYSE closures (YYYY-MM-DD, New York time).
const HOLIDAYS = new Set([
  "2026-09-07", "2026-11-26", "2026-12-25",
  "2027-01-01", "2027-01-18", "2027-02-15", "2027-03-26", "2027-05-31", "2027-06-18", "2027-07-05",
]);

const fmt = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  weekday: "short",
  hour12: false,
});

function nyParts(ms: number) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const hour = Number(p.hour) % 24;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    weekday: p.weekday as string, // Mon..Sun
    minutes: hour * 60 + Number(p.minute),
  };
}

export function sessionAt(ms: number): Session {
  const { date, weekday, minutes } = nyParts(ms);
  const nextDay = nyParts(ms + 24 * 3600 * 1000).date;
  const m = minutes;

  if (weekday === "Sat") return "closed";
  if (weekday === "Sun") return m >= 20 * 60 && !HOLIDAYS.has(nextDay) ? "overNight" : "closed";
  if (HOLIDAYS.has(date)) {
    // Overnight session resumes the evening before the next trading day.
    return m >= 20 * 60 && weekday !== "Fri" && !HOLIDAYS.has(nextDay) ? "overNight" : "closed";
  }
  if (m < 4 * 60) return "overNight";
  if (m < 9 * 60 + 30) return "preMarket";
  if (m < 16 * 60) return "regular";
  if (m < 20 * 60) return "postMarket";
  // 20:00-24:00: overnight unless the next day is a weekend/holiday.
  if (weekday === "Fri" || HOLIDAYS.has(nextDay)) return "closed";
  return "overNight";
}

// The last moment (ms) any US session was open, at or before `ms`.
export function lastLiveMs(ms: number): number {
  const step = 5 * 60 * 1000;
  let t = ms;
  for (let i = 0; i < 12 * 24 * 7 && sessionAt(t) === "closed"; i++) t -= step;
  return t;
}

export function bucketOf(s: Session): Bucket {
  if (s === "regular") return "regular";
  if (s === "closed") return "closed";
  return "extended";
}

export const SESSION_LABEL: Record<Session, string> = {
  regular: "US market open",
  preMarket: "Pre-market",
  postMarket: "After-hours",
  overNight: "Overnight trading",
  closed: "US market closed",
};
