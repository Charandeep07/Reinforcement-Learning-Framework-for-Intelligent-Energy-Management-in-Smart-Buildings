import type { StepResult } from "../sim/building";

export interface RewardWeights {
  energy: number;
  cost: number;
  comfort: number;
  equipment: number;
}

export const DEFAULT_WEIGHTS: RewardWeights = { energy: 1, cost: 1, comfort: 1, equipment: 0.5 };

export interface RewardContext {
  occ: number;
  comfortMin: number;
  comfortMax: number;
  area: number;
  dt: number;
  lighting: number;
}

/** Degrees outside the comfort band (0 when inside). */
export function comfortDeviation(tIn: number, min: number, max: number): number {
  if (tIn < min) return min - tIn;
  if (tIn > max) return tIn - max;
  return 0;
}

export function computeReward(step: StepResult, ctx: RewardContext, w: RewardWeights) {
  const occupied = ctx.occ > 0.05;
  const dev = comfortDeviation(step.tIn, ctx.comfortMin, ctx.comfortMax);
  const scale = ctx.area * 0.05; // ≈ typical kWh per hour for this building
  const energy = step.energyKwh / scale;
  const cost = step.cost / (scale * 10);
  const visual = occupied && ctx.lighting < 0.5 ? (0.5 - ctx.lighting) * 2 * ctx.occ : 0;
  const comfort = (dev * dev * (occupied ? 1 : 0) + visual) * ctx.dt;
  const lightsEmpty = !occupied && ctx.lighting > 0.05 ? ctx.lighting : 0;
  const hvacEmpty = !occupied && step.hvacKw > 0 ? 0.3 : 0;
  const equipment = (lightsEmpty + hvacEmpty) * ctx.dt;
  let bonus = 0;
  if (occupied && dev === 0) bonus += 0.3 * ctx.dt;
  if (dev === 0 && energy < 0.5 * ctx.dt) bonus += 0.1 * ctx.dt;
  const reward = -(w.energy * energy + w.cost * cost + w.comfort * comfort + w.equipment * equipment) + bonus;
  return { reward, parts: { energy, cost, comfort, equipment, bonus, dev } };
}
