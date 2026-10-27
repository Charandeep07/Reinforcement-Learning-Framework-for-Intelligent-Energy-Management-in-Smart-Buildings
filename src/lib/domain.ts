import type { Tables } from "@/integrations/supabase/types";
import type { BuildingParams } from "./sim/building";
import type { OccupancyProfile, Tariff, WeatherProfile } from "./sim/profiles";
import { tsToT } from "./sim/profiles";
import type { EnvConfig } from "./rl/env";
import { DEFAULT_WEIGHTS, type RewardWeights } from "./rl/reward";

export type Building = Tables<"buildings">;
export type Profile = Tables<"profiles">;
export type Equipment = Tables<"equipment">;
export type EnergyReading = Tables<"energy_readings">;
export type EnvReading = Tables<"environmental_readings">;
export type Alert = Tables<"alerts">;
export type Experiment = Tables<"rl_experiments">;
export type ModelArtifact = Tables<"model_artifacts">;

export const TIMEZONES: { id: string; label: string; offset: number }[] = [
  { id: "Asia/Kolkata", label: "India (UTC+5:30)", offset: 5.5 },
  { id: "UTC", label: "UTC", offset: 0 },
  { id: "Europe/London", label: "London (UTC+0, no DST)", offset: 0 },
  { id: "Asia/Dubai", label: "Dubai (UTC+4)", offset: 4 },
  { id: "Asia/Singapore", label: "Singapore (UTC+8)", offset: 8 },
  { id: "America/New_York", label: "New York (UTC−5, no DST)", offset: -5 },
];
export const tzOffset = (id?: string | null) => TIMEZONES.find((t) => t.id === id)?.offset ?? 5.5;

export function buildingParams(b: Building, p?: Profile | null): BuildingParams {
  return {
    area: Number(b.area_m2),
    openHour: b.open_hour,
    closeHour: b.close_hour,
    comfortMin: Number(b.comfort_min ?? p?.comfort_min ?? 22),
    comfortMax: Number(b.comfort_max ?? p?.comfort_max ?? 26),
    batteryKwh: Number(b.battery_kwh),
    batteryKw: Number(b.battery_kw),
    solarKw: Number(b.solar_kw),
  };
}

export function envConfigFor(
  b: Building,
  p: Profile | null | undefined,
  o: {
    startT?: number;
    hours: number;
    dt?: number;
    weights?: RewardWeights;
    weather?: WeatherProfile;
    occupancy?: OccupancyProfile;
    tariff?: Tariff;
    building?: Partial<BuildingParams>;
    mods?: EnvConfig["mods"];
    seed?: number;
  },
): EnvConfig {
  const tz = tzOffset(p?.timezone);
  const startT = o.startT ?? Math.floor(tsToT(Date.now(), tz) / 24) * 24;
  return {
    building: { ...buildingParams(b, p), ...(o.building ?? {}) },
    seed: o.seed ?? p?.sim_seed ?? 42,
    weather: o.weather ?? (b.weather_profile as WeatherProfile),
    occupancy: o.occupancy ?? (b.building_type as OccupancyProfile),
    tariff: o.tariff ?? ((p?.tariff as Tariff) || "tou"),
    flatPrice: Number(p?.flat_price ?? 8),
    startT,
    hours: o.hours,
    dt: o.dt ?? 1,
    weights: o.weights ?? DEFAULT_WEIGHTS,
    mods: o.mods,
  };
}

export const fmt = {
  kw: (x: number) => `${x.toFixed(1)} kW`,
  kwh: (x: number) => `${x >= 1000 ? (x / 1000).toFixed(2) + " MWh" : x.toFixed(1) + " kWh"}`,
  inr: (x: number) => `₹${Math.round(x).toLocaleString("en-IN")}`,
  pct: (x: number) => `${x >= 0 ? "" : "−"}${Math.abs(x).toFixed(1)}%`,
  c: (x: number) => `${x.toFixed(1)}°C`,
};
