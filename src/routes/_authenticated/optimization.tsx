import { useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Check } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { useLiveSim } from "@/hooks/use-live-sim";
import { Empty, Kpi, PageHeader } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { envConfigFor, fmt } from "@/lib/domain";
import { project, recommendAt } from "@/lib/rl/recommend";
import type { Action } from "@/lib/sim/building";

export const Route = createFileRoute("/_authenticated/optimization")({
  head: () => ({ meta: [{ title: "Optimization — SmartGrid RL" }, { name: "description", content: "Policy recommendations with predicted savings." }] }),
  component: Optimization,
});

const HORIZON = 6;
const desc = (a: Action) => `HVAC ${a.setpoint === null ? "off" : a.setpoint + "°C"} · lights ${Math.round(a.lighting * 100)}% · battery ${a.battery > 0 ? "charge" : a.battery < 0 ? "discharge" : "idle"}`;

function Optimization() {
  const { building, profile, activeNet, user } = useApp();
  const live = useLiveSim();
  const qc = useQueryClient();
  const hist = useQuery({
    queryKey: ["recs", building?.id],
    enabled: !!building,
    queryFn: async () => (await supabase.from("recommendations").select("*").eq("building_id", building!.id).order("created_at", { ascending: false }).limit(20)).data ?? [],
  });

  const calc = useMemo(() => {
    if (!building) return null;
    const cfg = envConfigFor(building, profile, { hours: HORIZON, dt: 1 });
    const l = live.last;
    const t = l ? l.t : live.simT;
    const tIn = l?.tIn ?? 25;
    const soc = l?.soc ?? 0.5;
    const m = live.manual;
    const current: Action = l
      ? { setpoint: m.setpoint !== undefined ? m.setpoint : l.action.setpoint, lighting: m.lighting ?? l.action.lighting, battery: m.battery ?? l.action.battery }
      : { setpoint: 24, lighting: 1, battery: 0 };
    const rec = recommendAt(cfg, t, tIn, soc, current, activeNet);
    const before = project(cfg, t, tIn, soc, HORIZON, current);
    const after = project(cfg, t, tIn, soc, HORIZON, rec.action);
    return { current, rec, before, after, t };
  }, [building, profile, live.last, live.simT, live.manual, activeNet]);

  if (!building || !calc) return <Empty title="Select a building first" />;
  const dE = calc.before.energyKwh - calc.after.energyKwh;
  const dC = calc.before.cost - calc.after.cost;

  const apply = async () => {
    live.setManual((m) => ({ ...m, setpoint: calc.rec.action.setpoint ?? undefined, hvacOn: calc.rec.action.setpoint !== null, lighting: calc.rec.action.lighting, battery: calc.rec.action.battery }));
    const { error } = await supabase.from("recommendations").insert({
      user_id: user.id, building_id: building.id, source: calc.rec.source,
      current_state: calc.current as never, recommended: calc.rec.action as never,
      predicted: { energySavedKwh: dE, costSaved: dC, horizonH: HORIZON } as never,
      applied: true, applied_at: new Date().toISOString(),
      result: { before: calc.before, after: calc.after } as never,
    });
    if (error) return toast.error(error.message);
    toast.success("Applied to the simulated equipment (manual overrides set)");
    qc.invalidateQueries({ queryKey: ["recs"] });
  };

  return (
    <div>
      <PageHeader title="Optimization" description={`Recommendations for the next ${HORIZON} h from the current simulated state.`} />
      <div className="mb-4 flex items-center gap-2">
        <Badge variant={calc.rec.source === "rl" ? "default" : "secondary"}>{calc.rec.source === "rl" ? "Source: trained RL policy" : "Source: rule-based fallback (not RL) — no model loaded"}</Badge>
        {!live.last && <span className="text-xs text-muted-foreground">Live simulation not started; using default state (25°C, 50% SoC).</span>}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="shadow-card"><CardHeader><CardTitle className="text-base">Current settings</CardTitle></CardHeader><CardContent className="text-sm">{desc(calc.current)}</CardContent></Card>
        <Card className="shadow-card ring-1 ring-primary/40"><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Sparkles className="size-4 text-primary" /> Recommended</CardTitle></CardHeader><CardContent className="text-sm">{desc(calc.rec.action)}</CardContent></Card>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Energy saved" value={fmt.kwh(dE)} sub="predicted (simulated)" tone={dE >= 0 ? "good" : "bad"} />
        <Kpi label="Cost saved" value={fmt.inr(dC)} sub="predicted (simulated)" tone={dC >= 0 ? "good" : "bad"} />
        <Kpi label="Comfort dev. before" value={`${calc.before.avgComfortDev.toFixed(2)}°C`} />
        <Kpi label="Comfort dev. after" value={`${calc.after.avgComfortDev.toFixed(2)}°C`} sub="predicted (simulated)" />
      </div>
      <Button className="mt-4" onClick={apply}><Check /> Apply recommendation</Button>

      <Card className="mt-6 shadow-card">
        <CardHeader><CardTitle className="text-base">Applied recommendations (before / after)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {(hist.data ?? []).length === 0 ? <Empty title="Nothing applied yet" /> : (
            <Table>
              <TableHeader><TableRow><TableHead>When</TableHead><TableHead>Source</TableHead><TableHead>Recommended</TableHead><TableHead className="text-right">kWh before → after</TableHead><TableHead className="text-right">₹ saved</TableHead></TableRow></TableHeader>
              <TableBody>
                {(hist.data ?? []).map((r) => {
                  const res = r.result as { before: { energyKwh: number }; after: { energyKwh: number } } | null;
                  const p = r.predicted as { costSaved?: number };
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleString()}</TableCell>
                      <TableCell>{r.source === "rl" ? "RL" : "Rule-based"}</TableCell>
                      <TableCell className="text-xs">{desc(r.recommended as unknown as Action)}</TableCell>
                      <TableCell className="text-right tabular">{res ? `${res.before.energyKwh.toFixed(1)} → ${res.after.energyKwh.toFixed(1)}` : "—"}</TableCell>
                      <TableCell className="text-right tabular">{fmt.inr(p.costSaved ?? 0)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
