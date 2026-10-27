import { describe, expect, it } from "vitest";
import { stepBuilding, type BuildingParams } from "@/lib/sim/building";
import { occupancy, outdoorTemp, price } from "@/lib/sim/profiles";
import { computeReward, comfortDeviation, DEFAULT_WEIGHTS } from "@/lib/rl/reward";
import { savingsPct, runEpisode } from "@/lib/rl/evaluate";
import { baselineController, smartRuleController } from "@/lib/rl/controllers";
import { BuildingEnv, DISCRETE_ACTIONS } from "@/lib/rl/env";
import { detectAnomalies, zScore } from "@/lib/anomaly";
import { DQNAgent, DEFAULT_DQN, trainEpisode } from "@/lib/rl/dqn";
import { MLP } from "@/lib/rl/mlp";

const B: BuildingParams = {
  area: 1000, openHour: 8, closeHour: 18, comfortMin: 22, comfortMax: 26,
  batteryKwh: 50, batteryKw: 15, solarKw: 20,
};
const T = 490_000 + 8; // some Monday-ish local hour
const cfg = {
  building: B, seed: 42, weather: "hot" as const, occupancy: "office" as const, tariff: "tou" as const,
  startT: Math.floor(T / 24) * 24, hours: 48, dt: 1, weights: DEFAULT_WEIGHTS,
};

describe("simulator", () => {
  it("generators are deterministic for same seed + time", () => {
    expect(outdoorTemp(42, "hot", T)).toBe(outdoorTemp(42, "hot", T));
    expect(occupancy(42, "office", T, 8, 18)).toBe(occupancy(42, "office", T, 8, 18));
    expect(outdoorTemp(42, "hot", T)).not.toBe(outdoorTemp(43, "hot", T));
  });
  it("occupancy is zero outside opening hours", () => {
    const day = Math.floor(T / 24) * 24;
    expect(occupancy(1, "office", day + 3, 8, 18)).toBe(0);
    expect(occupancy(1, "office", day + 20, 8, 18)).toBe(0);
  });
  it("TOU price: off-peak 5, peak 12", () => {
    const day = Math.floor(T / 24) * 24;
    expect(price("tou", day + 2, 1)).toBe(5);
    expect(price("tou", day + 19, 1)).toBe(12);
    expect(price("flat", day + 19, 1, 9)).toBe(9);
  });
  it("HVAC off with hot outside → indoor temp rises", () => {
    const r = stepBuilding(B, { tIn: 24, soc: 0.5 }, { setpoint: null, lighting: 0, battery: 0 }, { tOut: 38, occ: 0, price: 8, solarFactor: 0 }, 1);
    expect(r.tIn).toBeGreaterThan(24);
    expect(r.hvacKw).toBe(0);
  });
  it("HVAC cooling pulls toward setpoint and uses power", () => {
    const r = stepBuilding(B, { tIn: 28, soc: 0.5 }, { setpoint: 24, lighting: 1, battery: 0 }, { tOut: 36, occ: 0.8, price: 8, solarFactor: 0 }, 1);
    expect(r.tIn).toBeLessThan(28);
    expect(r.hvacKw).toBeGreaterThan(0);
  });
  it("battery respects SoC upper bound", () => {
    const r = stepBuilding(B, { tIn: 24, soc: 0.95 }, { setpoint: null, lighting: 0, battery: 1 }, { tOut: 25, occ: 0, price: 5, solarFactor: 0 }, 1);
    expect(r.batteryKw).toBeCloseTo(0, 6);
    expect(r.soc).toBeLessThanOrEqual(0.95 + 1e-9);
  });
  it("grid power never negative", () => {
    const r = stepBuilding(B, { tIn: 24, soc: 0.5 }, { setpoint: null, lighting: 0, battery: 0 }, { tOut: 25, occ: 0, price: 5, solarFactor: 1 }, 1);
    expect(r.gridKw).toBeGreaterThanOrEqual(0);
  });
});

describe("reward", () => {
  it("comfort deviation is zero inside band and positive outside", () => {
    expect(comfortDeviation(24, 22, 26)).toBe(0);
    expect(comfortDeviation(28, 22, 26)).toBe(2);
    expect(comfortDeviation(20, 22, 26)).toBe(2);
  });
  it("discomfort lowers reward", () => {
    const base = { tIn: 24, soc: 0.5, hvacKw: 10, lightingKw: 10, applianceKw: 5, solarKw: 0, batteryKw: 0, loadKw: 25, gridKw: 25, energyKwh: 25, cost: 200, cop: 3, hvacThermalKw: 30 };
    const ctx = { occ: 0.8, comfortMin: 22, comfortMax: 26, area: 1000, dt: 1, lighting: 1 };
    const ok = computeReward(base, ctx, DEFAULT_WEIGHTS).reward;
    const hot = computeReward({ ...base, tIn: 29 }, ctx, DEFAULT_WEIGHTS).reward;
    expect(hot).toBeLessThan(ok);
  });
  it("lights on in empty room is penalised", () => {
    const base = { tIn: 24, soc: 0.5, hvacKw: 0, lightingKw: 10, applianceKw: 2, solarKw: 0, batteryKw: 0, loadKw: 12, gridKw: 12, energyKwh: 12, cost: 60, cop: 3, hvacThermalKw: 0 };
    const ctx = { occ: 0, comfortMin: 22, comfortMax: 26, area: 1000, dt: 1, lighting: 1 };
    const r = computeReward(base, ctx, DEFAULT_WEIGHTS);
    expect(r.parts.equipment).toBeGreaterThan(0);
  });
});

describe("savings formula", () => {
  it("computes (baseline - x)/baseline*100", () => {
    expect(savingsPct(100, 80)).toBe(20);
    expect(savingsPct(100, 120)).toBe(-20);
  });
  it("guards division by zero", () => {
    expect(savingsPct(0, 10)).toBe(0);
  });
});

describe("environment & evaluation", () => {
  it("has 36 discrete actions and Gym-style step", () => {
    expect(DISCRETE_ACTIONS.length).toBe(36);
    const env = new BuildingEnv(cfg);
    const obs = env.reset();
    expect(obs.length).toBe(12);
    const s = env.step(0);
    expect(typeof s.reward).toBe("number");
    expect(s.done).toBe(false);
  });
  it("identical inputs give identical baseline results", () => {
    const a = runEpisode(cfg, baselineController, "a").metrics.energyKwh;
    const b = runEpisode(cfg, baselineController, "b").metrics.energyKwh;
    expect(a).toBe(b);
  });
  it("smart rule controller runs and reports metrics", () => {
    const m = runEpisode(cfg, smartRuleController, "r").metrics;
    expect(m.energyKwh).toBeGreaterThan(0);
    expect(m.peakKw).toBeGreaterThan(0);
  });
});

describe("DQN", () => {
  it("trains an episode and serialises weights", () => {
    const agent = new DQNAgent({ ...DEFAULT_DQN, hidden: 16 });
    const s = trainEpisode(agent, { ...cfg, hours: 24 }, 0);
    expect(Number.isFinite(s.reward)).toBe(true);
    const j = agent.online.toJSON();
    const m = MLP.fromJSON(j);
    const x = new Array(12).fill(0.1);
    expect(m.predict(x)[0]).toBeCloseTo(agent.online.predict(x)[0], 3);
  });
});

describe("anomaly rules", () => {
  const base = { totalKw: 20, isOpen: true, occupancy: 0.5, indoorC: 24, comfortMin: 22, comfortMax: 26, area: 1000, history: [], equipment: [] };
  it("flags high use vs expected", () => {
    expect(detectAnomalies({ ...base, totalKw: 40, expectedKw: 20 }).some((d) => d.rule === "high_use")).toBe(true);
    expect(detectAnomalies({ ...base, totalKw: 25, expectedKw: 20 }).some((d) => d.rule === "high_use")).toBe(false);
  });
  it("flags equipment drawing power while off", () => {
    const d = detectAnomalies({ ...base, equipment: [{ name: "Lighting", on: false, kw: 1.5 }] });
    expect(d.find((x) => x.rule === "off_draw")?.equipment).toBe("Lighting");
  });
  it("flags overnight use", () => {
    expect(detectAnomalies({ ...base, isOpen: false, occupancy: 0, totalKw: 10 }).some((d) => d.rule === "overnight")).toBe(true);
    expect(detectAnomalies({ ...base, isOpen: false, occupancy: 0, totalKw: 3 }).some((d) => d.rule === "overnight")).toBe(false);
  });
  it("z-score needs 12 samples and flags > 3σ", () => {
    expect(zScore(10, [1, 2, 3])).toBeNull();
    const hist = [10, 11, 9, 10, 11, 9, 10, 11, 9, 10, 11, 9];
    expect(detectAnomalies({ ...base, totalKw: 30, history: hist }).some((d) => d.rule === "zscore")).toBe(true);
  });
  it("flags comfort only when occupied", () => {
    expect(detectAnomalies({ ...base, indoorC: 29 }).some((d) => d.rule === "comfort")).toBe(true);
    expect(detectAnomalies({ ...base, indoorC: 29, occupancy: 0 }).some((d) => d.rule === "comfort")).toBe(false);
  });
});
