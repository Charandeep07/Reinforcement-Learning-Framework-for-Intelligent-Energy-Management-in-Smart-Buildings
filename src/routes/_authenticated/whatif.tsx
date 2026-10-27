import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Play, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { Empty, Kpi, PageHeader } from "@/components/app/ui-bits";
import { WeightSliders } from "@/components/app/WeightSliders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { envConfigFor, fmt } from "@/lib/domain";
import { DEFAULT_WEIGHTS } from "@/lib/rl/reward";
import { runEpisode, savingsPct, type Metrics } from "@/lib/rl/evaluate";
import { baselineController, rlController, smartRuleController, type Controller } from "@/lib/rl/controllers";

export const Route = createFileRoute("/_authenticated/whatif")({
  head: () => ({ meta: [{ title: "What-If Analysis — SmartGrid RL" }, { name: "description", content: "Run scenarios in the simulation engine." }] }),
  component: WhatIf,
});

interface Params { occ: number; tOut: number; price: number; setpoint: number; open: number; close: number; lightMax: number; batteryKwh: number; soc0: number; weights: typeof DEFAULT_WEIGHTS }
interface Results { scenario: Metrics; baseline: Metrics; controller: string; savings: number; costRed: number; hvacShare: number }

function WhatIf() {
  const { building, profile, activeNet, user } = useApp();
  const qc = useQueryClient();
  const [p, setP] = useState<Params>({ occ: 100, tOut: 0, price: 100, setpoint: 24, open: building?.open_hour ?? 8, close: building?.close_hour ?? 18, lightMax: 100, batteryKwh: Number(building?.battery_kwh ?? 50), soc0: 50, weights: DEFAULT_WEIGHTS });
  const [res, setRes] = useState<Results | null>(null);
  const [name, setName] = useState("Scenario 1");
  const [sel, setSel] = useState<string[]>([]);
  const saved = useQuery({ queryKey: ["whatif"], queryFn: async () => (await supabase.from("whatif_scenarios").select("*").order("created_at", { ascending: false })).data ?? [] });
  if (!building) return <Empty title="Select a building first" />;

  const run = () => {
    if (p.open >= p.close) return toast.error("Opening hour must be before closing hour");
    const cfg = envConfigFor(building, profile, {
      hours: 72, weights: p.weights,
      building: { openHour: p.open, closeHour: p.close, batteryKwh: p.batteryKwh },
      mods: { occScale: p.occ / 100, tOutDelta: p.tOut, priceScale: p.price / 100 },
    });
    cfg.soc0 = p.soc0 / 100;
    const inner: Controller = activeNet ? rlController(activeNet) : smartRuleController;
    const scen: Controller = (o, c, b) => {
      const a = inner(o, c, b);
      return { ...a, setpoint: a.setpoint === null ? null : Math.max(a.setpoint, p.setpoint), lighting: Math.min(a.lighting, p.lightMax / 100) };
    };
    const s = runEpisode(cfg, scen, "scenario").metrics;
    const b = runEpisode(cfg, baselineController, "baseline").metrics;
    setRes({ scenario: s, baseline: b, controller: activeNet ? "RL (DQN)" : "Rule-based (not RL)", savings: savingsPct(b.energyKwh, s.energyKwh), costRed: savingsPct(b.cost, s.cost), hvacShare: s.energyKwh > 0 ? (s.hvacKwh / (s.hvacKwh + s.lightingKwh + s.applianceKwh)) * 100 : 0 });
  };

  const save = async () => {
    if (!res) return;
    const { error } = await supabase.from("whatif_scenarios").insert({ user_id: user.id, building_id: building.id, name, params: p as never, results: res as never });
    if (error) return toast.error(error.message);
    toast.success("Scenario saved");
    qc.invalidateQueries({ queryKey: ["whatif"] });
  };
  const del = async (id: string) => { await supabase.from("whatif_scenarios").delete().eq("id", id); qc.invalidateQueries({ queryKey: ["whatif"] }); };

  const S = ({ k, label, min, max, step = 1, unit = "" }: { k: keyof Omit<Params, "weights">; label: string; min: number; max: number; step?: number; unit?: string }) => (
    <div className="space-y-1.5">
      <Label className="flex justify-between text-xs"><span>{label}</span><span className="font-mono">{p[k]}{unit}</span></Label>
      <Slider min={min} max={max} step={step} value={[p[k] as number]} onValueChange={([v]) => setP({ ...p, [k]: v })} />
    </div>
  );
  const cmp = (saved.data ?? []).filter((x) => sel.includes(x.id));

  return (
    <div>
      <PageHeader title="What-If Analysis" description="Change the scenario, run it through the engine for 72 h and compare against the fixed-rule baseline on the same modified inputs." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-2"><CardContent className="grid gap-4 p-5 sm:grid-cols-2">
          <S k="occ" label="Occupancy" min={0} max={150} unit="%" />
          <S k="tOut" label="Outdoor temp offset" min={-10} max={10} step={0.5} unit="°C" />
          <S k="price" label="Electricity price" min={50} max={200} unit="%" />
          <S k="setpoint" label="Minimum HVAC setpoint" min={20} max={27} step={0.5} unit="°C" />
          <S k="open" label="Opening hour" min={0} max={23} />
          <S k="close" label="Closing hour" min={1} max={24} />
          <S k="lightMax" label="Lighting schedule cap" min={0} max={100} step={5} unit="%" />
          <S k="batteryKwh" label="Battery size" min={0} max={200} step={5} unit=" kWh" />
          <S k="soc0" label="Battery initial charge" min={10} max={95} unit="%" />
          <div className="sm:col-span-2"><Label className="mb-2 block">Reward weights</Label><WeightSliders value={p.weights} onChange={(w) => setP({ ...p, weights: w })} /></div>
        </CardContent></Card>
        <div className="space-y-3">
          <Button className="w-full" onClick={run}><Play /> Run scenario</Button>
          {res && (
            <>
              <div className="text-xs text-muted-foreground">Controller: {res.controller}</div>
              <Kpi label="Energy" value={fmt.kwh(res.scenario.energyKwh)} sub={`baseline ${fmt.kwh(res.baseline.energyKwh)}`} />
              <Kpi label="Savings vs baseline" value={fmt.pct(res.savings)} tone={res.savings >= 0 ? "good" : "bad"} sub={`cost ${fmt.pct(res.costRed)}`} />
              <Kpi label="Cost" value={fmt.inr(res.scenario.cost)} sub={`baseline ${fmt.inr(res.baseline.cost)}`} />
              <Kpi label="Comfort" value={`${res.scenario.avgComfortDev.toFixed(2)}°C avg dev`} sub={`${res.scenario.hoursOutside} h outside band`} />
              <Kpi label="Equipment utilization" value={`HVAC ${res.hvacShare.toFixed(0)}%`} sub={`peak ${fmt.kw(res.scenario.peakKw)}`} />
              <div className="flex gap-2"><Input value={name} onChange={(e) => setName(e.target.value)} /><Button variant="outline" onClick={save}><Save /> Save</Button></div>
            </>
          )}
        </div>
      </div>
      <Card className="mt-6 shadow-card">
        <CardHeader><CardTitle className="text-base">Saved scenarios {cmp.length > 0 && <span className="text-xs font-normal text-muted-foreground">· comparing {cmp.length}</span>}</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {(saved.data ?? []).length === 0 ? <Empty title="No saved scenarios" /> : (
            <Table>
              <TableHeader><TableRow><TableHead /><TableHead>Name</TableHead><TableHead className="text-right">Energy</TableHead><TableHead className="text-right">Cost</TableHead><TableHead className="text-right">Savings</TableHead><TableHead className="text-right">Comfort dev</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(saved.data ?? []).map((s) => { const r = s.results as unknown as Results; return (
                  <TableRow key={s.id} className={sel.includes(s.id) ? "bg-accent/40" : ""}>
                    <TableCell><Checkbox checked={sel.includes(s.id)} onCheckedChange={(v) => setSel((x) => v ? [...x, s.id] : x.filter((i) => i !== s.id))} /></TableCell>
                    <TableCell>{s.name}</TableCell>
                    <TableCell className="text-right tabular">{fmt.kwh(r.scenario.energyKwh)}</TableCell>
                    <TableCell className="text-right tabular">{fmt.inr(r.scenario.cost)}</TableCell>
                    <TableCell className={`text-right tabular ${r.savings >= 0 ? "text-success" : "text-destructive"}`}>{fmt.pct(r.savings)}</TableCell>
                    <TableCell className="text-right tabular">{r.scenario.avgComfortDev.toFixed(2)}°C</TableCell>
                    <TableCell><Button size="icon" variant="ghost" onClick={() => del(s.id)} aria-label="Delete"><Trash2 /></Button></TableCell>
                  </TableRow>); })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
