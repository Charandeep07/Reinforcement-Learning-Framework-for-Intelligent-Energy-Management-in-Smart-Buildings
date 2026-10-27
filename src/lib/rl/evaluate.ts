import { BuildingEnv, type EnvConfig } from "./env";
import type { Controller } from "./controllers";

export interface StepLog {
  t: number;
  hour: number;
  tIn: number;
  tOut: number;
  occ: number;
  price: number;
  gridKw: number;
  hvacKw: number;
  lightingKw: number;
  applianceKw: number;
  solarKw: number;
  batteryKw: number;
  soc: number;
  energy: number;
  cost: number;
  reward: number;
  dev: number;
  setpoint: number | null;
  lighting: number;
}

export interface Metrics {
  energyKwh: number;
  cost: number;
  avgComfortDev: number;
  hoursOutside: number;
  peakKw: number;
  totalReward: number;
  hvacKwh: number;
  lightingKwh: number;
  applianceKwh: number;
  solarKwh: number;
  ms: number;
}

export interface EpisodeResult {
  name: string;
  steps: StepLog[];
  metrics: Metrics;
}

export function runEpisode(cfg: EnvConfig, controller: Controller, name: string): EpisodeResult {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const env = new BuildingEnv(cfg);
  let obs = env.reset();
  const steps: StepLog[] = [];
  while (!env.done) {
    const ctx = env.context();
    const action = controller(obs, ctx, cfg.building);
    const { obs: o2, reward, info } = env.step(action);
    const r = info.result;
    steps.push({
      t: ctx.t,
      hour: ctx.hour,
      tIn: r.tIn,
      tOut: ctx.tOut,
      occ: ctx.occ,
      price: ctx.price,
      gridKw: r.gridKw,
      hvacKw: r.hvacKw,
      lightingKw: r.lightingKw,
      applianceKw: r.applianceKw,
      solarKw: r.solarKw,
      batteryKw: r.batteryKw,
      soc: r.soc,
      energy: r.energyKwh,
      cost: r.cost,
      reward,
      dev: info.parts.dev,
      setpoint: action.setpoint,
      lighting: action.lighting,
    });
    obs = o2;
  }
  const t1 = typeof performance !== "undefined" ? performance.now() : Date.now();
  return { name, steps, metrics: summarize(steps, cfg.dt, t1 - t0) };
}

export function summarize(steps: StepLog[], dt: number, ms = 0): Metrics {
  let energy = 0,
    cost = 0,
    devSum = 0,
    occN = 0,
    outside = 0,
    peak = 0,
    rew = 0,
    hv = 0,
    li = 0,
    ap = 0,
    so = 0;
  for (const s of steps) {
    energy += s.energy;
    cost += s.cost;
    rew += s.reward;
    peak = Math.max(peak, s.gridKw);
    hv += s.hvacKw * dt;
    li += s.lightingKw * dt;
    ap += s.applianceKw * dt;
    so += s.solarKw * dt;
    if (s.occ > 0.05) {
      devSum += s.dev;
      occN++;
      if (s.dev > 0) outside += dt;
    }
  }
  return {
    energyKwh: energy,
    cost,
    avgComfortDev: occN ? devSum / occN : 0,
    hoursOutside: outside,
    peakKw: peak,
    totalReward: rew,
    hvacKwh: hv,
    lightingKwh: li,
    applianceKwh: ap,
    solarKwh: so,
    ms,
  };
}

/** (baseline - x) / baseline × 100, guarded against division by zero. */
export function savingsPct(baseline: number, x: number): number {
  if (!Number.isFinite(baseline) || !Number.isFinite(x) || Math.abs(baseline) < 1e-9) return 0;
  return ((baseline - x) / baseline) * 100;
}
