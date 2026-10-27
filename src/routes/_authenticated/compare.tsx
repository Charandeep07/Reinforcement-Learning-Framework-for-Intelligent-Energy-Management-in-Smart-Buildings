import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Loader2, Play, Info } from "lucide-react";
import { useApp } from "@/hooks/use-app";
import { CHART, ChartCard, Empty, PageHeader, tooltipStyle } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { envConfigFor, fmt } from "@/lib/domain";
import { runEpisode, savingsPct, type EpisodeResult } from "@/lib/rl/evaluate";
import { baselineController, CONTROLLER_LABELS, rlController, smartRuleController } from "@/lib/rl/controllers";

export const Route = createFileRoute("/_authenticated/compare")({
  head: () => ({ meta: [{ title: "Baseline vs RL — SmartGrid RL" }, { name: "description", content: "Evaluate controllers on identical scenarios." }] }),
  component: Compare,
});

function Compare() {
  const { building, profile, activeNet, activeModel } = useApp();
  const [days, setDays] = useState("7");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<EpisodeResult[] | null>(null);
  if (!building) return <Empty title="Select a building first" />;

  const run = () => {
    setBusy(true);
    setTimeout(() => {
      const cfg = envConfigFor(building, profile, { hours: Number(days) * 24 });
      const out = [runEpisode(cfg, baselineController, CONTROLLER_LABELS.baseline), runEpisode(cfg, smartRuleController, CONTROLLER_LABELS.rule)];
      if (activeNet) out.push(runEpisode(cfg, rlController(activeNet), CONTROLLER_LABELS.rl));
      setRes(out);
      setBusy(false);
    }, 20);
  };

  const base = res?.[0].metrics;
  const rows: [string, (m: EpisodeResult["metrics"]) => string, boolean?][] = [
    ["Total energy (kWh)", (m) => m.energyKwh.toFixed(1)],
    ["Total cost (₹)", (m) => fmt.inr(m.cost)],
    ["Energy savings vs baseline (%)", (m) => fmt.pct(savingsPct(base!.energyKwh, m.energyKwh)), true],
    ["Cost reduction vs baseline (%)", (m) => fmt.pct(savingsPct(base!.cost, m.cost)), true],
    ["Avg comfort deviation (°C, occupied)", (m) => m.avgComfortDev.toFixed(2)],
    ["Hours outside comfort band (h)", (m) => m.hoursOutside.toFixed(1)],
    ["Peak demand (kW)", (m) => m.peakKw.toFixed(1)],
    ["Total reward", (m) => m.totalReward.toFixed(1)],
    ["Evaluation time (ms)", (m) => m.ms.toFixed(1)],
  ];
  const daily = res
    ? Array.from({ length: Number(days) }, (_, d) => {
        const o: Record<string, number | string> = { day: `Day ${d + 1}` };
        res.forEach((r) => (o[r.name] = r.steps.slice(d * 24, d * 24 + 24).reduce((a, s) => a + s.energy, 0)));
        return o;
      })
    : [];
  const hourly = res ? res[0].steps.slice(0, 48).map((s, i) => { const o: Record<string, number | string> = { h: `${Math.round(s.hour)}:00` }; res.forEach((r) => (o[r.name] = r.steps[i].gridKw)); return o; }) : [];
  const colors = [CHART.c5, CHART.c2, CHART.c1];
  const rlLoses = res && res.length === 3 && res[2].metrics.energyKwh > res[1].metrics.energyKwh;

  return (
    <div>
      <PageHeader
        title="Baseline vs RL"
        description="All controllers run on identical weather, occupancy, prices and horizon."
        actions={
          <>
            <Label>Horizon</Label>
            <Select value={days} onValueChange={setDays}><SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger><SelectContent>{["1", "3", "7", "14"].map((d) => <SelectItem key={d} value={d}>{d} days</SelectItem>)}</SelectContent></Select>
            <Button onClick={run} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Play />} Run evaluation</Button>
          </>
        }
      />
      {!activeNet && <div className="mb-4 rounded-xl border border-warning/50 bg-warning/15 p-3 text-sm">No trained RL model is loaded, so only the baseline and rule-based controllers are compared. Train and load one in the RL Control Center.</div>}
      {!res ? <Empty title="No evaluation yet">Press “Run evaluation”.</Empty> : (
        <>
          <Card className="shadow-card">
            <CardHeader><CardTitle className="text-base">Metrics {activeModel && <span className="text-xs font-normal text-muted-foreground">· RL model: {activeModel.name}</span>}</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Metric</TableHead>{res.map((r) => <TableHead key={r.name} className="text-right">{r.name}</TableHead>)}</TableRow></TableHeader>
                <TableBody>
                  {rows.map(([l, f, signed]) => (
                    <TableRow key={l}><TableCell>{l}</TableCell>{res.map((r, i) => { const v = f(r.metrics); return <TableCell key={r.name} className={`text-right tabular ${signed && i > 0 ? (v.startsWith("−") ? "text-destructive" : "text-success") : ""}`}>{v}</TableCell>; })}</TableRow>
                  ))}
                </TableBody>
              </Table>
              {rlLoses && <p className="mt-3 text-sm text-destructive">On this scenario the trained RL agent used more energy than the rule-based controller. This is reported as-is.</p>}
            </CardContent>
          </Card>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Daily energy (kWh)">
              <ResponsiveContainer><BarChart data={daily}><CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" /><XAxis dataKey="day" stroke={CHART.axis} fontSize={11} /><YAxis stroke={CHART.axis} fontSize={11} /><Tooltip {...tooltipStyle} formatter={(v: any) => v.toFixed(0)} /><Legend />{res.map((r, i) => <Bar key={r.name} dataKey={r.name} fill={colors[i]} />)}</BarChart></ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Grid power, first 48 h (kW)">
              <ResponsiveContainer><LineChart data={hourly}><CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" /><XAxis dataKey="h" stroke={CHART.axis} fontSize={11} interval={5} /><YAxis stroke={CHART.axis} fontSize={11} /><Tooltip {...tooltipStyle} formatter={(v: any) => v.toFixed(1)} /><Legend />{res.map((r, i) => <Line key={r.name} dataKey={r.name} stroke={colors[i]} dot={false} />)}</LineChart></ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
      <Card className="mt-6 shadow-card">
        <CardContent className="flex gap-3 p-4 text-sm text-muted-foreground">
          <Info className="mt-0.5 size-4 shrink-0" />
          <div><b className="text-foreground">Limitations of the simulated environment.</b> Single-zone first-order thermal model, synthetic seeded weather/occupancy/prices, no humidity or ventilation modelling, and a small DQN trained briefly in the browser. Results show relative behaviour in this simulator only and do not guarantee savings in a real building.</div>
        </CardContent>
      </Card>
    </div>
  );
}
