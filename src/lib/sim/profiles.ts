import { clamp, hash01 } from "./random";

export type WeatherProfile = "mild" | "hot" | "monsoon" | "cold";
export type OccupancyProfile = "office" | "retail" | "education";
export type Tariff = "tou" | "flat" | "cpp";

export const WEATHER_PROFILES: Record<WeatherProfile, { mean: number; amp: number; cloud: number }> = {
  mild: { mean: 26, amp: 4, cloud: 0.2 },
  hot: { mean: 34, amp: 6, cloud: 0.1 },
  monsoon: { mean: 28, amp: 3, cloud: 0.6 },
  cold: { mean: 10, amp: 5, cloud: 0.3 },
};

/**
 * Time convention: `t` = local hours since the Unix epoch (float).
 * Convert from a JS timestamp with tsToT(ts, tzOffsetHours).
 */
export const tsToT = (ts: number, tz = 5.5) => ts / 3_600_000 + tz;
export const tToTs = (t: number, tz = 5.5) => (t - tz) * 3_600_000;
export const hourOf = (t: number) => ((t % 24) + 24) % 24;
export const dayOf = (t: number) => Math.floor(t / 24);
/** 0 = Sunday. 1970-01-01 was a Thursday. */
export const weekdayOf = (t: number) => (((dayOf(t) + 4) % 7) + 7) % 7;
export const isWeekend = (t: number) => {
  const w = weekdayOf(t);
  return w === 0 || w === 6;
};

function tempAtHour(seed: number, p: WeatherProfile, hIdx: number): number {
  const w = WEATHER_PROFILES[p];
  const h = hourOf(hIdx);
  const day = dayOf(hIdx);
  return (
    w.mean +
    w.amp * Math.sin((2 * Math.PI * (h - 9)) / 24) +
    (hash01(seed, 1, day) - 0.5) * 4 +
    (hash01(seed, 2, hIdx) - 0.5) * 1
  );
}

export function outdoorTemp(seed: number, p: WeatherProfile, t: number): number {
  const a = Math.floor(t);
  const f = t - a;
  return tempAtHour(seed, p, a) * (1 - f) + tempAtHour(seed, p, a + 1) * f;
}

export function cloudCover(seed: number, p: WeatherProfile, t: number): number {
  return clamp(WEATHER_PROFILES[p].cloud + (hash01(seed, 3, dayOf(t)) - 0.5) * 0.4, 0, 0.95);
}

export function solarFactor(seed: number, p: WeatherProfile, t: number): number {
  const h = hourOf(t);
  return Math.max(0, Math.sin((Math.PI * (h - 6)) / 12)) * (1 - 0.75 * cloudCover(seed, p, t));
}

export function occupancy(
  seed: number,
  type: OccupancyProfile,
  t: number,
  openHour: number,
  closeHour: number,
): number {
  const h = hourOf(Math.floor(t));
  if (h < openHour || h >= closeHour || closeHour <= openHour) return 0;
  const weekend = isWeekend(t);
  if (weekend && type !== "retail") return 0.03;
  const p = (h - openHour + 0.5) / (closeHour - openHour);
  let base: number;
  if (type === "office") {
    base = 0.9 * Math.sqrt(Math.sin(Math.PI * p));
    if (h === 13) base *= 0.7;
  } else if (type === "retail") {
    base = 0.3 + 0.6 * p;
    if (weekend) base = Math.min(1, base * 1.2);
  } else {
    base = p > 0.8 ? 0.4 : 0.85;
  }
  return clamp(base + (hash01(seed, 4, Math.floor(t)) - 0.5) * 0.1, 0, 1);
}

export function price(tariff: Tariff, t: number, seed: number, flatPrice = 8): number {
  const h = hourOf(Math.floor(t));
  if (tariff === "flat") return flatPrice;
  let p = h < 6 || h >= 22 ? 5 : h >= 18 ? 12 : 8;
  if (tariff === "cpp" && hash01(seed, 5, dayOf(t)) < 0.3 && h >= 14 && h < 18) p = 25;
  return p;
}
