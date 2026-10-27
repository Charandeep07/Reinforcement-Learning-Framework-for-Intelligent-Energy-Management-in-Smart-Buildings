export type Severity = "info" | "warning" | "critical";

export interface AnomalyInput {
  totalKw: number;
  isOpen: boolean;
  occupancy: number;
  indoorC: number;
  comfortMin: number;
  comfortMax: number;
  area: number;
  /** expected power for this hour from the baseline model */
  expectedKw?: number;
  /** recent total-kW history (rolling window), oldest first */
  history: number[];
  equipment: { name: string; on: boolean; kw: number }[];
}

export interface Detected {
  rule: "high_use" | "off_draw" | "overnight" | "zscore" | "comfort";
  severity: Severity;
  equipment: string | null;
  message: string;
}

export function zScore(x: number, hist: number[]): number | null {
  if (hist.length < 12) return null;
  const m = hist.reduce((a, b) => a + b, 0) / hist.length;
  const v = hist.reduce((a, b) => a + (b - m) ** 2, 0) / hist.length;
  const sd = Math.sqrt(v);
  if (sd < 1e-6) return null;
  return (x - m) / sd;
}

export function detectAnomalies(i: AnomalyInput): Detected[] {
  const out: Detected[] = [];
  if (i.expectedKw !== undefined && i.expectedKw > 0 && i.totalKw > 1.5 * i.expectedKw) {
    out.push({
      rule: "high_use",
      severity: i.totalKw > 2 * i.expectedKw ? "critical" : "warning",
      equipment: null,
      message: `Power ${i.totalKw.toFixed(1)} kW is ${(i.totalKw / i.expectedKw).toFixed(1)}× the expected ${i.expectedKw.toFixed(1)} kW.`,
    });
  }
  for (const e of i.equipment) {
    if (!e.on && e.kw > 0.05) {
      out.push({
        rule: "off_draw",
        severity: "warning",
        equipment: e.name,
        message: `${e.name} is switched off but drawing ${e.kw.toFixed(2)} kW.`,
      });
    }
  }
  if (!i.isOpen && i.occupancy < 0.05 && i.totalKw > i.area * 0.006) {
    out.push({
      rule: "overnight",
      severity: "warning",
      equipment: null,
      message: `Unusual after-hours use: ${i.totalKw.toFixed(1)} kW while the building is closed and empty.`,
    });
  }
  const z = zScore(i.totalKw, i.history);
  if (z !== null && z > 3) {
    out.push({
      rule: "zscore",
      severity: z > 4 ? "critical" : "warning",
      equipment: null,
      message: `Usage is ${z.toFixed(1)} standard deviations above the rolling baseline.`,
    });
  }
  if (i.occupancy > 0.05) {
    const dev = i.indoorC < i.comfortMin ? i.comfortMin - i.indoorC : i.indoorC > i.comfortMax ? i.indoorC - i.comfortMax : 0;
    if (dev > 1) {
      out.push({
        rule: "comfort",
        severity: dev > 2 ? "critical" : "warning",
        equipment: "HVAC",
        message: `Indoor ${i.indoorC.toFixed(1)}°C is ${dev.toFixed(1)}°C outside the comfort band (${i.comfortMin}–${i.comfortMax}°C) while occupied.`,
      });
    }
  }
  return out;
}
