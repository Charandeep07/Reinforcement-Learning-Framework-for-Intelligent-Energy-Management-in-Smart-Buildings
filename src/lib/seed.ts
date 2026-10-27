import { supabase } from "@/integrations/supabase/client";
import { envConfigFor, tzOffset, type Building, type Profile } from "./domain";
import { runEpisode } from "./rl/evaluate";
import { baselineController, smartRuleController } from "./rl/controllers";
import { price, tToTs, tsToT, type Tariff } from "./sim/profiles";
import { detectAnomalies } from "./anomaly";

export const HISTORY_DAYS = 14;

export function defaultEquipment(b: Building) {
  const area = Number(b.area_m2);
  return [
    { kind: "hvac", name: "Central HVAC (heat pump)", rated_kw: Math.round(area * 0.04), setpoint: 24, level: null },
    { kind: "lighting", name: "LED lighting", rated_kw: Math.round(area * 0.01), setpoint: null, level: 1 },
    { kind: "appliances", name: "Plug loads & appliances", rated_kw: Math.round(area * 0.01), setpoint: null, level: null },
    { kind: "battery", name: "Battery storage", rated_kw: Number(b.battery_kw), setpoint: null, level: 0 },
    { kind: "solar", name: "Rooftop solar PV", rated_kw: Number(b.solar_kw), setpoint: null, level: null },
  ].map((e) => ({ ...e, building_id: b.id, user_id: b.user_id }));
}

async function insertChunks(table: "energy_readings" | "environmental_readings", rows: object[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await supabase.from(table).insert(rows.slice(i, i + 500) as never);
    if (error) throw error;
  }
}

/** Simulates HISTORY_DAYS of hourly operation (smart rule controller) and stores it. */
export async function generateHistory(b: Building, p: Profile | null) {
  const tz = tzOffset(p?.timezone);
  const nowT = Math.floor(tsToT(Date.now(), tz));
  const startT = Math.floor(nowT / 24) * 24 - HISTORY_DAYS * 24;
  const cfg = envConfigFor(b, p, { startT, hours: nowT - startT, dt: 1 });
  const run = runEpisode(cfg, smartRuleController, "history");
  const base = runEpisode(cfg, baselineController, "baseline");
  const energy = run.steps.map((s) => ({
    user_id: b.user_id,
    building_id: b.id,
    ts: new Date(tToTs(s.t, tz)).toISOString(),
    source: "history",
    total_kw: s.hvacKw + s.lightingKw + s.applianceKw,
    hvac_kw: s.hvacKw,
    lighting_kw: s.lightingKw,
    appliance_kw: s.applianceKw,
    solar_kw: s.solarKw,
    battery_kw: s.batteryKw,
    grid_kw: s.gridKw,
    price: s.price,
    cost: s.cost,
    soc: s.soc,
  }));
  const env = run.steps.map((s) => ({
    user_id: b.user_id,
    building_id: b.id,
    ts: new Date(tToTs(s.t, tz)).toISOString(),
    indoor_c: s.tIn,
    outdoor_c: s.tOut,
    occupancy: s.occ,
    setpoint: s.setpoint ?? 0,
  }));
  await insertChunks("energy_readings", energy);
  await insertChunks("environmental_readings", env);

  // run anomaly rules over the generated history so the alert log is not empty
  const alerts: object[] = [];
  const hist: number[] = [];
  run.steps.forEach((s, i) => {
    const total = s.gridKw;
    const found = detectAnomalies({
      totalKw: total,
      isOpen: s.hour >= b.open_hour && s.hour < b.close_hour,
      occupancy: s.occ,
      indoorC: s.tIn,
      comfortMin: cfg.building.comfortMin,
      comfortMax: cfg.building.comfortMax,
      area: cfg.building.area,
      expectedKw: base.steps[i]?.gridKw,
      history: hist.slice(-24),
      equipment: [],
    });
    hist.push(total);
    for (const f of found)
      alerts.push({
        user_id: b.user_id,
        building_id: b.id,
        rule: f.rule,
        severity: f.severity,
        equipment: f.equipment,
        message: f.message,
        ts: new Date(tToTs(s.t, tz)).toISOString(),
        status: "resolved",
      });
  });
  if (alerts.length) await supabase.from("alerts").insert(alerts.slice(-25) as never);
}

export async function seedPrices(userId: string, tariff: Tariff, seed: number, flat: number) {
  await supabase.from("energy_prices").delete().eq("user_id", userId);
  const rows = Array.from({ length: 24 }, (_, h) => ({ user_id: userId, tariff, hour: h, price: price(tariff, h, seed, flat) }));
  await supabase.from("energy_prices").insert(rows);
}

export async function createBuildingWithData(
  userId: string,
  p: Profile | null,
  values: Partial<Building> & { name: string },
) {
  const { data: b, error } = await supabase
    .from("buildings")
    .insert({ ...values, user_id: userId } as never)
    .select()
    .single();
  if (error) throw error;
  await supabase.from("equipment").insert(defaultEquipment(b) as never);
  await generateHistory(b, p);
  return b;
}

export async function seedDemo(userId: string, p: Profile | null) {
  await createBuildingWithData(userId, p, {
    name: "Demo Office — Hyderabad",
    location: "HITEC City, Hyderabad",
    area_m2: 1200,
    floors: 3,
    building_type: "office",
    open_hour: 8,
    close_hour: 19,
    energy_target_kwh: 450,
    comfort_min: 22,
    comfort_max: 26,
    weather_profile: "hot",
    battery_kwh: 60,
    battery_kw: 20,
    solar_kw: 25,
  });
  await seedPrices(userId, ((p?.tariff as Tariff) ?? "tou"), p?.sim_seed ?? 42, Number(p?.flat_price ?? 8));
  await supabase.from("profiles").update({ demo_seeded: true }).eq("id", userId);
  await supabase.from("audit_logs").insert({ user_id: userId, action: "seed_demo", details: {} });
}

export async function resetDemo(userId: string, p: Profile | null) {
  await supabase.from("whatif_scenarios").delete().eq("user_id", userId);
  await supabase.from("model_artifacts").delete().eq("user_id", userId);
  await supabase.from("rl_experiments").delete().eq("user_id", userId);
  await supabase.from("buildings").delete().eq("user_id", userId);
  await supabase.from("energy_prices").delete().eq("user_id", userId);
  await seedDemo(userId, p);
  await supabase.from("audit_logs").insert({ user_id: userId, action: "reset_demo", details: {} });
}
