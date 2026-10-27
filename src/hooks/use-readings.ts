import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "./use-app";
import { envConfigFor, tzOffset, type EnergyReading, type EnvReading } from "@/lib/domain";
import { tsToT } from "@/lib/sim/profiles";
import { runEpisode } from "@/lib/rl/evaluate";
import { baselineController } from "@/lib/rl/controllers";

export interface HourRow {
  t: number;
  ts: number;
  day: number;
  hour: number;
  grid: number;
  total: number;
  hvac: number;
  lighting: number;
  appliance: number;
  solar: number;
  battery: number;
  cost: number;
  price: number;
  soc: number;
  tIn: number;
  tOut: number;
  occ: number;
  baseGrid: number;
  baseCost: number;
}

/** Hourly history for the selected building, joined with a baseline simulation on identical inputs. */
export function useHistory() {
  const { building, profile } = useApp();
  const tz = tzOffset(profile?.timezone);
  return useQuery({
    queryKey: ["history", building?.id, building?.updated_at, profile?.updated_at],
    enabled: !!building,
    queryFn: async () => {
      const b = building!;
      const [e, v] = await Promise.all([
        supabase.from("energy_readings").select("*").eq("building_id", b.id).eq("source", "history").order("ts").limit(1000),
        supabase.from("environmental_readings").select("*").eq("building_id", b.id).order("ts").limit(1000),
      ]);
      if (e.error) throw e.error;
      if (v.error) throw v.error;
      const envMap = new Map<string, EnvReading>();
      (v.data ?? []).forEach((r) => envMap.set(new Date(r.ts).toISOString(), r));
      const rows = (e.data ?? []) as EnergyReading[];
      if (!rows.length) return [] as HourRow[];
      const t0 = Math.round(tsToT(new Date(rows[0].ts).getTime(), tz));
      const t1 = Math.round(tsToT(new Date(rows[rows.length - 1].ts).getTime(), tz)) + 1;
      const base = runEpisode(envConfigFor(b, profile, { startT: t0, hours: t1 - t0 }), baselineController, "baseline");
      const baseByT = new Map(base.steps.map((s) => [Math.round(s.t), s]));
      return rows.map((r) => {
        const ts = new Date(r.ts).getTime();
        const t = Math.round(tsToT(ts, tz));
        const env = envMap.get(new Date(r.ts).toISOString());
        const bs = baseByT.get(t);
        return {
          t,
          ts,
          day: Math.floor(t / 24),
          hour: ((t % 24) + 24) % 24,
          grid: Number(r.grid_kw),
          total: Number(r.total_kw),
          hvac: Number(r.hvac_kw),
          lighting: Number(r.lighting_kw),
          appliance: Number(r.appliance_kw),
          solar: Number(r.solar_kw),
          battery: Number(r.battery_kw),
          cost: Number(r.cost),
          price: Number(r.price),
          soc: Number(r.soc),
          tIn: Number(env?.indoor_c ?? NaN),
          tOut: Number(env?.outdoor_c ?? NaN),
          occ: Number(env?.occupancy ?? 0),
          baseGrid: bs?.gridKw ?? 0,
          baseCost: bs?.cost ?? 0,
        } satisfies HourRow;
      });
    },
  });
}

export interface DayRow {
  day: number;
  label: string;
  kwh: number;
  cost: number;
  baseKwh: number;
  baseCost: number;
  hvac: number;
  lighting: number;
  appliance: number;
  solar: number;
  avgTin: number;
  hoursOutside: number;
  peak: number;
}

export function byDay(rows: HourRow[], comfortMin: number, comfortMax: number): DayRow[] {
  const m = new Map<number, DayRow & { n: number }>();
  for (const r of rows) {
    let d = m.get(r.day);
    if (!d) {
      const date = new Date(r.day * 86400_000);
      d = {
        day: r.day,
        label: date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "UTC" }),
        kwh: 0, cost: 0, baseKwh: 0, baseCost: 0, hvac: 0, lighting: 0, appliance: 0, solar: 0, avgTin: 0, hoursOutside: 0, peak: 0, n: 0,
      };
      m.set(r.day, d);
    }
    d.kwh += r.grid;
    d.cost += r.cost;
    d.baseKwh += r.baseGrid;
    d.baseCost += r.baseCost;
    d.hvac += r.hvac;
    d.lighting += r.lighting;
    d.appliance += r.appliance;
    d.solar += r.solar;
    d.peak = Math.max(d.peak, r.grid);
    if (!Number.isNaN(r.tIn)) {
      d.avgTin += r.tIn;
      d.n++;
      if (r.occ > 0.05 && (r.tIn < comfortMin || r.tIn > comfortMax)) d.hoursOutside++;
    }
  }
  return [...m.values()].map(({ n, ...d }) => ({ ...d, avgTin: n ? d.avgTin / n : 0 }));
}
