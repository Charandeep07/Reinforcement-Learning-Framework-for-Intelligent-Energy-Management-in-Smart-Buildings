import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "./use-app";
import { envConfigFor, tzOffset } from "@/lib/domain";
import { BuildingEnv } from "@/lib/rl/env";
import { baselineController, rlController, smartRuleController } from "@/lib/rl/controllers";
import { stepBuilding, type Action } from "@/lib/sim/building";
import { tToTs, tsToT } from "@/lib/sim/profiles";
import { detectAnomalies } from "@/lib/anomaly";

export type ControllerMode = "baseline" | "rule" | "rl";

export interface Manual {
  hvacOn: boolean;
  lightingOn: boolean;
  appliancesOn: boolean;
  batteryOn: boolean;
  solarOn: boolean;
  /** manual overrides; undefined = controller decides */
  setpoint?: number;
  lighting?: number;
  battery?: number;
  faults: { hvac: boolean; lighting: boolean; appliances: boolean };
}

export interface LiveReading {
  t: number;
  ts: number;
  totalKw: number;
  hvacKw: number;
  lightingKw: number;
  applianceKw: number;
  solarKw: number;
  batteryKw: number;
  gridKw: number;
  tIn: number;
  tOut: number;
  occ: number;
  price: number;
  soc: number;
  cost: number;
  action: Action;
}

const DEFAULT_MANUAL: Manual = {
  hvacOn: true,
  lightingOn: true,
  appliancesOn: true,
  batteryOn: true,
  solarOn: true,
  faults: { hvac: false, lighting: false, appliances: false },
};

interface LiveCtx {
  running: boolean;
  setRunning: (r: boolean) => void;
  speedMs: number;
  setSpeedMs: (n: number) => void;
  stepMinutes: number;
  setStepMinutes: (n: number) => void;
  mode: ControllerMode;
  setMode: (m: ControllerMode) => void;
  manual: Manual;
  setManual: (u: (m: Manual) => Manual) => void;
  readings: LiveReading[];
  last: LiveReading | null;
  simT: number;
  tick: () => Promise<void>;
  persist: boolean;
  setPersist: (p: boolean) => void;
}

const Ctx = createContext<LiveCtx | null>(null);

export function LiveSimProvider({ children }: { children: ReactNode }) {
  const { building, profile, activeNet, user } = useApp();
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [speedMs, setSpeedMs] = useState(2000);
  const [stepMinutes, setStepMinutes] = useState(15);
  const [mode, setMode] = useState<ControllerMode>("rule");
  const [manual, setManualState] = useState<Manual>(DEFAULT_MANUAL);
  const [readings, setReadings] = useState<LiveReading[]>([]);
  const [persist, setPersist] = useState(true);
  const envRef = useRef<BuildingEnv | null>(null);
  const histRef = useRef<number[]>([]);
  const firedRef = useRef<Map<string, number>>(new Map());
  const tickCount = useRef(0);
  const busy = useRef(false);
  const manualRef = useRef(manual);
  manualRef.current = manual;
  const [simT, setSimT] = useState(0);

  const tz = tzOffset(profile?.timezone);

  // (re)create env when building/profile changes
  useEffect(() => {
    if (!building) return;
    const cfg = envConfigFor(building, profile, { hours: 1e9, dt: stepMinutes / 60 });
    const env = new BuildingEnv(cfg);
    env.reset();
    const nowT = tsToT(Date.now(), tz);
    env.t = Math.floor(nowT * 4) / 4;
    env.tIn = 25;
    envRef.current = env;
    histRef.current = [];
    setReadings([]);
    setSimT(env.t);
    setManualState(DEFAULT_MANUAL);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [building?.id, building?.updated_at, profile?.updated_at]);

  useEffect(() => {
    if (envRef.current) envRef.current.cfg.dt = stepMinutes / 60;
  }, [stepMinutes]);

  const tick = useCallback(async () => {
    const env = envRef.current;
    if (!env || !building || busy.current) return;
    busy.current = true;
    try {
      const m = manualRef.current;
      const ctx = env.context();
      const obs = env.observe();
      const ctrl = mode === "rl" && activeNet ? rlController(activeNet) : mode === "baseline" ? baselineController : smartRuleController;
      const a0 = ctrl(obs, ctx, env.cfg.building);
      const action: Action = {
        setpoint: m.setpoint !== undefined ? m.setpoint : a0.setpoint,
        lighting: m.lighting !== undefined ? m.lighting : a0.lighting,
        battery: m.battery !== undefined ? m.battery : a0.battery,
      };
      env.overrides = {
        hvacOn: m.hvacOn,
        lightingOn: m.lightingOn,
        appliancesOn: m.appliancesOn,
        batteryOn: m.batteryOn,
        solarOn: m.solarOn,
        faults: m.faults,
      };
      const pre = { tIn: env.tIn, soc: env.soc };
      const { info } = env.step(action);
      const r = info.result;
      const ts = tToTs(ctx.t, tz);
      const reading: LiveReading = {
        t: ctx.t,
        ts,
        totalKw: r.loadKw,
        hvacKw: r.hvacKw,
        lightingKw: r.lightingKw,
        applianceKw: r.applianceKw,
        solarKw: r.solarKw,
        batteryKw: r.batteryKw,
        gridKw: r.gridKw,
        tIn: r.tIn,
        tOut: ctx.tOut,
        occ: ctx.occ,
        price: ctx.price,
        soc: r.soc,
        cost: r.cost,
        action,
      };
      setReadings((prev) => [...prev.slice(-95), reading]);
      setSimT(env.t);

      // anomaly detection
      const expected = stepBuilding(
        env.cfg.building,
        pre,
        baselineController(obs, ctx, env.cfg.building),
        { tOut: ctx.tOut, occ: ctx.occ, price: ctx.price, solarFactor: ctx.solarFactor },
        env.cfg.dt,
      );
      const found = detectAnomalies({
        totalKw: r.gridKw,
        isOpen: ctx.isOpen,
        occupancy: ctx.occ,
        indoorC: r.tIn,
        comfortMin: env.cfg.building.comfortMin,
        comfortMax: env.cfg.building.comfortMax,
        area: env.cfg.building.area,
        expectedKw: Math.max(expected.gridKw, env.cfg.building.area * 0.005),
        history: histRef.current.slice(-24),
        equipment: [
          { name: "HVAC", on: m.hvacOn, kw: m.hvacOn ? 0 : r.hvacKw },
          { name: "Lighting", on: m.lightingOn, kw: m.lightingOn ? 0 : r.lightingKw },
          { name: "Appliances", on: m.appliancesOn, kw: m.appliancesOn ? 0 : r.applianceKw },
        ],
      });
      histRef.current.push(r.gridKw);

      if (persist) {
        await supabase.from("energy_readings").insert({
          user_id: user.id,
          building_id: building.id,
          ts: new Date(ts).toISOString(),
          source: "live",
          total_kw: r.loadKw,
          hvac_kw: r.hvacKw,
          lighting_kw: r.lightingKw,
          appliance_kw: r.applianceKw,
          solar_kw: r.solarKw,
          battery_kw: r.batteryKw,
          grid_kw: r.gridKw,
          price: ctx.price,
          cost: r.cost,
          soc: r.soc,
        });
        await supabase.from("environmental_readings").insert({
          user_id: user.id,
          building_id: building.id,
          ts: new Date(ts).toISOString(),
          indoor_c: r.tIn,
          outdoor_c: ctx.tOut,
          occupancy: ctx.occ,
          setpoint: action.setpoint ?? 0,
        });
        const fresh = found.filter((f) => {
          const key = `${f.rule}:${f.equipment ?? ""}`;
          const lastT = firedRef.current.get(key);
          if (lastT !== undefined && ctx.t - lastT < 2) return false;
          firedRef.current.set(key, ctx.t);
          return true;
        });
        if (fresh.length) {
          await supabase.from("alerts").insert(
            fresh.map((f) => ({
              user_id: user.id,
              building_id: building.id,
              rule: f.rule,
              severity: f.severity,
              equipment: f.equipment,
              message: f.message,
              ts: new Date(ts).toISOString(),
            })),
          );
          if (profile?.notify_alerts !== false)
            fresh.forEach((f) => (f.severity === "critical" ? toast.error(f.message) : toast.warning(f.message)));
          qc.invalidateQueries({ queryKey: ["alerts"] });
        }
        tickCount.current++;
        if (tickCount.current % 40 === 0) {
          const cutoff = new Date(ts - 3 * 86400_000).toISOString();
          await supabase.from("energy_readings").delete().eq("building_id", building.id).eq("source", "live").lt("ts", cutoff);
        }
      }
    } catch (e) {
      toast.error(`Simulation tick failed: ${(e as Error).message}`);
      setRunning(false);
    } finally {
      busy.current = false;
    }
  }, [building, mode, activeNet, persist, tz, user.id, profile?.notify_alerts, qc]);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(tick, speedMs);
    return () => clearInterval(id);
  }, [running, speedMs, tick]);

  const value: LiveCtx = {
    running,
    setRunning,
    speedMs,
    setSpeedMs,
    stepMinutes,
    setStepMinutes,
    mode,
    setMode,
    manual,
    setManual: (u) => setManualState((m) => u(m)),
    readings,
    last: readings[readings.length - 1] ?? null,
    simT,
    tick,
    persist,
    setPersist,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLiveSim() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useLiveSim outside provider");
  return c;
}
