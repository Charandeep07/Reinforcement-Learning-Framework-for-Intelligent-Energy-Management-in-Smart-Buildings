import { clamp } from "./random";

export interface BuildingParams {
  area: number; // m²
  openHour: number;
  closeHour: number;
  comfortMin: number;
  comfortMax: number;
  batteryKwh: number;
  batteryKw: number;
  solarKw: number;
  batteryEff?: number;
  socMin?: number;
  socMax?: number;
}

export interface Action {
  /** HVAC setpoint in °C, or null = HVAC off */
  setpoint: number | null;
  /** lighting dimming level 0..1 */
  lighting: number;
  /** battery command -1 (full discharge) .. +1 (full charge) */
  battery: number;
}

export interface Inputs {
  tOut: number;
  occ: number;
  price: number;
  solarFactor: number;
}

export interface Overrides {
  hvacOn?: boolean;
  lightingOn?: boolean;
  appliancesOn?: boolean;
  batteryOn?: boolean;
  solarOn?: boolean;
  /** simulated fault: equipment keeps drawing standby power while switched off */
  faults?: Partial<Record<"hvac" | "lighting" | "appliances", boolean>>;
}

export interface SimState {
  tIn: number;
  soc: number; // 0..1
}

export interface StepResult {
  tIn: number;
  soc: number;
  hvacKw: number;
  lightingKw: number;
  applianceKw: number;
  solarKw: number;
  batteryKw: number; // + charging, - discharging
  loadKw: number;
  gridKw: number;
  energyKwh: number;
  cost: number;
  cop: number;
  hvacThermalKw: number;
}

export function derive(p: BuildingParams) {
  return {
    UA: p.area * 0.003, // kW/K
    C: p.area * 0.05, // kWh/K
    Qmax: p.area * 0.12, // kW thermal
    lightKw: p.area * 0.01,
    applBase: p.area * 0.002,
    applOcc: p.area * 0.008,
    peopleKw: p.area * 0.01, // occupant heat at full occupancy
    fanKw: p.area * 0.002,
  };
}

export function coolingCop(tOut: number) {
  return clamp(5.5 - 0.1 * tOut, 2, 5);
}
export function heatingCop(tOut: number) {
  return clamp(2 + 0.08 * tOut, 1.5, 4);
}

/** One step of the single-zone RC thermal + electrical model. dt in hours. */
export function stepBuilding(
  p: BuildingParams,
  s: SimState,
  a: Action,
  inp: Inputs,
  dt: number,
  ov: Overrides = {},
): StepResult {
  const d = derive(p);
  const eff = p.batteryEff ?? 0.92;
  const socMin = p.socMin ?? 0.1;
  const socMax = p.socMax ?? 0.95;
  const faults = ov.faults ?? {};

  const lightsOn = ov.lightingOn !== false;
  const applOn = ov.appliancesOn !== false;
  const hvacOn = ov.hvacOn !== false && a.setpoint !== null;

  let lightingKw = lightsOn ? clamp(a.lighting, 0, 1) * d.lightKw : faults.lighting ? 0.15 * d.lightKw : 0;
  let applianceKw = applOn ? d.applBase + inp.occ * d.applOcc : faults.appliances ? 0.15 * (d.applBase + d.applOcc) : 0;
  lightingKw = Math.max(0, lightingKw);
  applianceKw = Math.max(0, applianceKw);

  const gains = inp.occ * d.peopleKw + lightingKw + applianceKw;
  const passive = d.UA * (inp.tOut - s.tIn) + gains;

  let Q = 0;
  let cop = coolingCop(inp.tOut);
  if (hvacOn && a.setpoint !== null) {
    const sp = a.setpoint;
    const qCool = Math.max(0, passive - ((sp - s.tIn) * d.C) / dt);
    const hs = sp - 3;
    const qHeat = Math.min(0, passive - ((hs - s.tIn) * d.C) / dt);
    Q = clamp(qCool > 0 ? qCool : qHeat, -d.Qmax, d.Qmax);
    cop = Q >= 0 ? coolingCop(inp.tOut) : heatingCop(inp.tOut);
  }
  let hvacKw = hvacOn ? Math.abs(Q) / cop + d.fanKw : 0;
  if (!hvacOn && faults.hvac) hvacKw = d.fanKw * 1.5;

  const tIn = s.tIn + (dt / d.C) * (passive - Q);

  const solarKw = ov.solarOn === false ? 0 : p.solarKw * inp.solarFactor;
  const loadKw = hvacKw + lightingKw + applianceKw;

  let batteryKw = 0;
  let soc = s.soc;
  if (ov.batteryOn !== false && p.batteryKwh > 0) {
    const cmd = clamp(a.battery, -1, 1) * p.batteryKw;
    if (cmd > 0) {
      const maxCharge = Math.max(0, ((socMax - soc) * p.batteryKwh) / (eff * dt));
      batteryKw = Math.min(cmd, maxCharge);
      soc += (batteryKw * eff * dt) / p.batteryKwh;
    } else if (cmd < 0) {
      const maxDis = Math.max(0, ((soc - socMin) * p.batteryKwh * eff) / dt);
      const dis = Math.min(-cmd, maxDis, Math.max(0, loadKw - solarKw));
      batteryKw = -dis;
      soc -= (dis * dt) / (eff * p.batteryKwh);
    }
  }
  soc = clamp(soc, 0, 1);

  const gridKw = Math.max(0, loadKw - solarKw + batteryKw);
  const energyKwh = gridKw * dt;
  return {
    tIn,
    soc,
    hvacKw,
    lightingKw,
    applianceKw,
    solarKw,
    batteryKw,
    loadKw,
    gridKw,
    energyKwh,
    cost: energyKwh * inp.price,
    cop,
    hvacThermalKw: Q,
  };
}
