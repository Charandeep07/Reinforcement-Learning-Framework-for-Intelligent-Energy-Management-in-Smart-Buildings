import { stepBuilding, type Action, type BuildingParams, type Overrides, type StepResult } from "../sim/building";
import {
  hourOf,
  isWeekend,
  occupancy,
  outdoorTemp,
  price,
  solarFactor,
  type OccupancyProfile,
  type Tariff,
  type WeatherProfile,
} from "../sim/profiles";
import { computeReward, type RewardWeights } from "./reward";

export interface EnvConfig {
  building: BuildingParams;
  seed: number;
  weather: WeatherProfile;
  occupancy: OccupancyProfile;
  tariff: Tariff;
  flatPrice?: number;
  startT: number; // local hours since epoch
  hours: number; // episode length in hours
  dt: number; // step in hours
  weights: RewardWeights;
  tIn0?: number;
  soc0?: number;
  /** scenario modifiers used by What-If analysis */
  mods?: { occScale?: number; tOutDelta?: number; priceScale?: number };
}

export const SETPOINTS: (number | null)[] = [null, 22, 24, 26];
export const LIGHT_LEVELS = [0, 0.6, 1];
export const BATTERY_CMDS = [-1, 0, 1];

/** Discrete action set for DQN: 4 setpoints × 3 lighting × 3 battery = 36 actions. */
export const DISCRETE_ACTIONS: Action[] = SETPOINTS.flatMap((setpoint) =>
  LIGHT_LEVELS.flatMap((lighting) => BATTERY_CMDS.map((battery) => ({ setpoint, lighting, battery }))),
);

/** Continuous action → physical action. u ∈ [-1,1]^3; u0 < -0.8 means HVAC off. */
export function continuousToAction(u: [number, number, number]): Action {
  const c = (x: number) => Math.max(-1, Math.min(1, x));
  return {
    setpoint: c(u[0]) < -0.8 ? null : 21 + ((c(u[0]) + 1) / 2) * 6,
    lighting: (c(u[1]) + 1) / 2,
    battery: c(u[2]),
  };
}

export const OBS_DIM = 12;

export interface EnvContext {
  t: number;
  hour: number;
  weekend: boolean;
  isOpen: boolean;
  occ: number;
  tOut: number;
  price: number;
  nextPrice: number;
  solarFactor: number;
  tIn: number;
  soc: number;
}

export interface StepInfo {
  ctx: EnvContext;
  action: Action;
  result: StepResult;
  parts: ReturnType<typeof computeReward>["parts"];
}

export class BuildingEnv {
  cfg: EnvConfig;
  t = 0;
  tIn = 24;
  soc = 0.5;
  stepsTaken = 0;
  lastEnergy = 0;
  lastAction: Action = { setpoint: null, lighting: 0, battery: 0 };
  overrides: Overrides = {};
  private t0 = 0;

  constructor(cfg: EnvConfig) {
    this.cfg = cfg;
  }

  reset(offsetHours = 0): number[] {
    this.t0 = this.cfg.startT + offsetHours;
    this.t = this.t0;
    this.tIn = this.cfg.tIn0 ?? 25;
    this.soc = this.cfg.soc0 ?? 0.5;
    this.stepsTaken = 0;
    this.lastEnergy = 0;
    this.lastAction = { setpoint: null, lighting: 0, battery: 0 };
    return this.observe();
  }

  context(t = this.t): EnvContext {
    const { building: b, seed, weather, tariff, flatPrice, mods } = this.cfg;
    const occ = Math.min(1, occupancy(seed, this.cfg.occupancy, t, b.openHour, b.closeHour) * (mods?.occScale ?? 1));
    const ps = mods?.priceScale ?? 1;
    const h = hourOf(t);
    return {
      t,
      hour: h,
      weekend: isWeekend(t),
      isOpen: h >= b.openHour && h < b.closeHour,
      occ,
      tOut: outdoorTemp(seed, weather, t) + (mods?.tOutDelta ?? 0),
      price: price(tariff, t, seed, flatPrice) * ps,
      nextPrice: price(tariff, t + 1, seed, flatPrice) * ps,
      solarFactor: solarFactor(seed, weather, t),
      tIn: this.tIn,
      soc: this.soc,
    };
  }

  observe(): number[] {
    const c = this.context();
    const scale = this.cfg.building.area * 0.05 * this.cfg.dt;
    const a = this.lastAction;
    return [
      (c.tIn - 24) / 5,
      (c.tOut - 25) / 10,
      c.occ,
      Math.sin((2 * Math.PI * c.hour) / 24),
      Math.cos((2 * Math.PI * c.hour) / 24),
      c.weekend ? 1 : 0,
      c.price / 15,
      c.nextPrice / 15,
      this.lastEnergy / scale,
      c.soc,
      a.setpoint === null ? -1 : (a.setpoint - 24) / 4,
      a.lighting,
    ];
  }

  get done() {
    return this.t - this.t0 >= this.cfg.hours - 1e-9;
  }

  step(action: Action | number): { obs: number[]; reward: number; done: boolean; info: StepInfo } {
    const a = typeof action === "number" ? DISCRETE_ACTIONS[action] : action;
    const ctx = this.context();
    const b = this.cfg.building;
    const result = stepBuilding(
      b,
      { tIn: this.tIn, soc: this.soc },
      a,
      { tOut: ctx.tOut, occ: ctx.occ, price: ctx.price, solarFactor: ctx.solarFactor },
      this.cfg.dt,
      this.overrides,
    );
    const effLighting = this.overrides.lightingOn === false ? 0 : a.lighting;
    const { reward, parts } = computeReward(
      result,
      { occ: ctx.occ, comfortMin: b.comfortMin, comfortMax: b.comfortMax, area: b.area, dt: this.cfg.dt, lighting: effLighting },
      this.cfg.weights,
    );
    this.tIn = result.tIn;
    this.soc = result.soc;
    this.lastEnergy = result.energyKwh;
    this.lastAction = a;
    this.t += this.cfg.dt;
    this.stepsTaken++;
    return { obs: this.observe(), reward, done: this.done, info: { ctx, action: a, result, parts } };
  }
}
