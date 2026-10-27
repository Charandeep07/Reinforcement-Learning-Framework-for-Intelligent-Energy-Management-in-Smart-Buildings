import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AirVent, Battery, Lightbulb, Plug, Sun, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { useLiveSim, type Manual } from "@/hooks/use-live-sim";
import { useHistory } from "@/hooks/use-readings";
import { CHART, Empty, Loading, PageHeader, tooltipStyle } from "@/components/app/ui-bits";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { envConfigFor, type Equipment } from "@/lib/domain";
import { recommendAt } from "@/lib/rl/recommend";

export const Route = createFileRoute("/_authenticated/equipment")({
  head: () => ({ meta: [{ title: "Equipment — SmartGrid RL" }, { name: "description", content: "Simulated HVAC, lighting, appliances, battery and solar." }] }),
  component: EquipmentPage,
});

const ICON = { hvac: AirVent, lighting: Lightbulb, appliances: Plug, battery: Battery, solar: Sun } as const;
const ON_KEY = { hvac: "hvacOn", lighting: "lightingOn", appliances: "appliancesOn", battery: "batteryOn", solar: "solarOn" } as const;

function EquipmentPage() {
  const { building, profile, activeNet } = useApp();
  const live = useLiveSim();
  const hist = useHistory();
  const qc = useQueryClient();
  const eq = useQuery({
    queryKey: ["equipment", building?.id],
    enabled: !!building,
    queryFn: async () => {
      const { data, error } = await supabase.from("equipment").select("*").eq("building_id", building!.id).order("created_at");
      if (error) throw error;
      return data;
    },
  });

  const rec = useMemo(() => {
    if (!building) return null;
    const l = live.last;
    const cfg = envConfigFor(building, profile, { hours: 1, dt: live.stepMinutes / 60 });
    const t = l ? l.t + live.stepMinutes / 60 : live.simT;
    return recommendAt(cfg, t, l?.tIn ?? 25, l?.soc ?? 0.5, l?.action, activeNet);
  }, [building, profile, live.last, live.simT, live.stepMinutes, activeNet]);

  if (!building) return <Empty title="No building selected" />;
  if (eq.isLoading) return <Loading />;

  const m = live.manual;
  const l = live.last;
  const recent = (hist.data ?? []).slice(-48).map((r) => ({ h: `${r.hour}:00`, hvac: r.hvac, lighting: r.lighting, appliances: r.appliance, battery: r.battery, solar: r.solar }));

  const persist = async (e: Equipment, patch: Partial<Equipment>) => {
    const { error } = await supabase.from("equipment").update(patch).eq("id", e.id);
    if (error) toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["equipment"] });
  };

  const setM = (u: (m: Manual) => Manual) => live.setManual(u);

  const power = (k: string) =>
    !l ? null : k === "hvac" ? l.hvacKw : k === "lighting" ? l.lightingKw : k === "appliances" ? l.applianceKw : k === "battery" ? l.batteryKw : l.solarKw;

  return (
    <div>
      <PageHeader
        title="Equipment"
        description="Manual controls change the live simulation immediately. Leave a control on Auto to let the selected controller decide."
        actions={!live.running && <Button onClick={() => live.setRunning(true)}>Start live simulation</Button>}
      />
      {rec && (
        <div className="mb-4 rounded-xl border bg-accent/40 p-3 text-sm">
          <b>{rec.source === "rl" ? "RL-recommended" : "Rule-based recommendation (no trained model loaded — not RL)"}:</b>{" "}
          HVAC {rec.action.setpoint === null ? "off" : `${rec.action.setpoint}°C`} · lighting {Math.round(rec.action.lighting * 100)}% · battery{" "}
          {rec.action.battery > 0 ? "charge" : rec.action.battery < 0 ? "discharge" : "idle"}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {(eq.data ?? []).map((e) => {
          const kind = e.kind as keyof typeof ICON;
          const Icon = ICON[kind] ?? Plug;
          const onKey = ON_KEY[kind];
          const isOn = onKey ? m[onKey] : true;
          const p = power(kind);
          const faultKey = kind === "hvac" || kind === "lighting" || kind === "appliances" ? kind : null;
          return (
            <Card key={e.id} className="shadow-card">
              <CardHeader className="flex flex-row items-center gap-3 space-y-0 pb-2">
                <span className="grid size-9 place-items-center rounded-lg bg-accent text-accent-foreground"><Icon className="size-4" /></span>
                <div className="flex-1">
                  <CardTitle className="text-base">{e.name}</CardTitle>
                  <div className="text-xs text-muted-foreground">rated {e.rated_kw} kW</div>
                </div>
                <Badge variant={isOn ? "default" : "secondary"}>{isOn ? "On" : "Off"}</Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-display text-2xl font-semibold tabular">{p === null ? "—" : `${p.toFixed(1)} kW`}</span>
                  {onKey && (
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`on-${e.id}`} className="text-xs">Power</Label>
                      <Switch
                        id={`on-${e.id}`}
                        checked={isOn}
                        onCheckedChange={(v) => {
                          setM((x) => ({ ...x, [onKey]: v }));
                          persist(e, { is_on: v });
                          toast.success(`${e.name} switched ${v ? "on" : "off"} (simulated)`);
                        }}
                      />
                    </div>
                  )}
                </div>

                {kind === "hvac" && (
                  <Ctrl label={`Setpoint: ${m.setpoint === undefined ? "Auto" : `${m.setpoint}°C`}`} recommended={rec ? (rec.action.setpoint === null ? "off" : `${rec.action.setpoint}°C`) : undefined} auto={m.setpoint === undefined} onAuto={() => setM((x) => ({ ...x, setpoint: undefined }))}>
                    <Slider min={18} max={30} step={0.5} value={[m.setpoint ?? 24]} onValueChange={([v]) => setM((x) => ({ ...x, setpoint: v }))} onValueCommit={([v]) => persist(e, { setpoint: v })} />
                  </Ctrl>
                )}
                {kind === "lighting" && (
                  <Ctrl label={`Dimming: ${m.lighting === undefined ? "Auto" : `${Math.round(m.lighting * 100)}%`}`} recommended={rec ? `${Math.round(rec.action.lighting * 100)}%` : undefined} auto={m.lighting === undefined} onAuto={() => setM((x) => ({ ...x, lighting: undefined }))}>
                    <Slider min={0} max={1} step={0.05} value={[m.lighting ?? 1]} onValueChange={([v]) => setM((x) => ({ ...x, lighting: v }))} onValueCommit={([v]) => persist(e, { level: v })} />
                  </Ctrl>
                )}
                {kind === "battery" && (
                  <Ctrl label="Mode" recommended={rec ? (rec.action.battery > 0 ? "charge" : rec.action.battery < 0 ? "discharge" : "idle") : undefined} auto={m.battery === undefined} onAuto={() => setM((x) => ({ ...x, battery: undefined }))}>
                    <Select value={m.battery === undefined ? "auto" : String(m.battery)} onValueChange={(v) => setM((x) => ({ ...x, battery: v === "auto" ? undefined : Number(v) }))}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (controller)</SelectItem>
                        <SelectItem value="1">Charge</SelectItem>
                        <SelectItem value="0">Idle</SelectItem>
                        <SelectItem value="-1">Discharge</SelectItem>
                      </SelectContent>
                    </Select>
                    {l && <div className="mt-1 text-xs text-muted-foreground">SoC {Math.round(l.soc * 100)}% of {building.battery_kwh} kWh</div>}
                  </Ctrl>
                )}
                {faultKey && (
                  <div className="flex items-center justify-between rounded-lg border border-dashed p-2 text-xs">
                    <span className="flex items-center gap-1 text-muted-foreground"><TriangleAlert className="size-3" /> Simulate standby fault (draws power when off)</span>
                    <Switch checked={m.faults[faultKey]} onCheckedChange={(v) => setM((x) => ({ ...x, faults: { ...x.faults, [faultKey]: v } }))} />
                  </div>
                )}
                <div className="h-20">
                  <ResponsiveContainer>
                    <LineChart data={recent}>
                      <XAxis dataKey="h" hide />
                      <YAxis hide />
                      <Tooltip {...tooltipStyle} formatter={(v: any) => `${v.toFixed(1)} kW`} />
                      <Line dataKey={kind} stroke={CHART.c1} dot={false} strokeWidth={1.5} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
                <div className="-mt-3 text-[11px] text-muted-foreground">Usage, last 48 h of history</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Ctrl({ label, recommended, auto, onAuto, children }: { label: string; recommended?: string; auto: boolean; onAuto: () => void; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium">{label}</span>
        {!auto && <button className="text-primary underline" onClick={onAuto}>Back to Auto</button>}
      </div>
      {children}
      {recommended && <div className="text-xs text-muted-foreground">Recommended: <b className="text-foreground">{recommended}</b></div>}
    </div>
  );
}
