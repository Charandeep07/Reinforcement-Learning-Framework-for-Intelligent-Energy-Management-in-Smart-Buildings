import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Pause, Play, Square, Upload, Trash2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { CHART, ChartCard, Empty, PageHeader, tooltipStyle } from "@/components/app/ui-bits";
import { WeightSliders } from "@/components/app/WeightSliders";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { envConfigFor, fmt, type Experiment } from "@/lib/domain";
import { DEFAULT_WEIGHTS, type RewardWeights } from "@/lib/rl/reward";
import type { EpisodeStats } from "@/lib/rl/dqn";
import { MLP, type MLPJson } from "@/lib/rl/mlp";
import { runEpisode, savingsPct } from "@/lib/rl/evaluate";
import { baselineController, rlController, smartRuleController } from "@/lib/rl/controllers";
import type { OccupancyProfile, Tariff, WeatherProfile } from "@/lib/sim/profiles";

export const Route = createFileRoute("/_authenticated/rl")({
  head: () => ({ meta: [{ title: "RL Control Center — SmartGrid RL" }, { name: "description", content: "Train and manage DQN agents." }] }),
  component: RLCenter,
});

function RLCenter() {
  const { building, profile, user, activeModel } = useApp();
  const qc = useQueryClient();
  const [algo, setAlgo] = useState("dqn");
  const [days, setDays] = useState(7);
  const [episodes, setEpisodes] = useState(40);
  const [weather, setWeather] = useState<WeatherProfile>((building?.weather_profile as WeatherProfile) ?? "hot");
  const [occ, setOcc] = useState<OccupancyProfile>((building?.building_type as OccupancyProfile) ?? "office");
  const [tariff, setTariff] = useState<Tariff>((profile?.tariff as Tariff) ?? "tou");
  const [cMin, setCMin] = useState(Number(building?.comfort_min ?? 22));
  const [cMax, setCMax] = useState(Number(building?.comfort_max ?? 26));
  const [weights, setWeights] = useState<RewardWeights>(DEFAULT_WEIGHTS);
  const [status, setStatus] = useState<"idle" | "running" | "paused" | "saving">("idle");
  const [curve, setCurve] = useState<EpisodeStats[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [del, setDel] = useState<Experiment | null>(null);
  const worker = useRef<Worker | null>(null);
  const cfgRef = useRef<ReturnType<typeof envConfigFor> | null>(null);

  const exps = useQuery({
    queryKey: ["experiments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rl_experiments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const models = useQuery({
    queryKey: ["models"],
    queryFn: async () => (await supabase.from("model_artifacts").select("id,name,experiment_id,is_active,created_at")).data ?? [],
  });

  useEffect(() => () => worker.current?.terminate(), []);

  if (!building) return <Empty title="Select a building first" />;

  const start = () => {
    if (cMin >= cMax) return toast.error("Comfort min must be below max");
    const cfg = envConfigFor(building, profile, {
      hours: days * 24, weights, weather, occupancy: occ, tariff,
      building: { comfortMin: cMin, comfortMax: cMax },
    });
    cfgRef.current = cfg;
    setCurve([]);
    const w = new Worker(new URL("../../workers/dqn.worker.ts", import.meta.url), { type: "module" });
    worker.current = w;
    w.onmessage = (e) => {
      if (e.data.type === "episode") setCurve((c) => [...c, e.data.stats]);
      if (e.data.type === "done") finish(e.data.weights, e.data.seconds, e.data.episodes, e.data.stopped);
    };
    w.onerror = (e) => { toast.error(`Training worker failed: ${e.message}`); setStatus("idle"); };
    w.postMessage({ type: "start", config: cfg, episodes });
    setStatus("running");
  };

  const finish = async (weightsJson: MLPJson, seconds: number, eps: number, stopped: boolean) => {
    worker.current?.terminate();
    worker.current = null;
    if (eps === 0) { setStatus("idle"); return toast.info("Training stopped before any episode completed — nothing saved"); }
    setStatus("saving");
    try {
      const cfg = cfgRef.current!;
      const net = MLP.fromJSON(weightsJson);
      const rl = runEpisode(cfg, rlController(net), "rl").metrics;
      const base = runEpisode(cfg, baselineController, "baseline").metrics;
      const rule = runEpisode(cfg, smartRuleController, "rule").metrics;
      const metrics = { rl, base, rule, savingsVsBaseline: savingsPct(base.energyKwh, rl.energyKwh), costReduction: savingsPct(base.cost, rl.cost) };
      setCurve((c) => { void save(c); return c; });
      async function save(c: EpisodeStats[]) {
        const name = `DQN · ${weather}/${occ}/${tariff} · ${days}d × ${eps} ep`;
        const { data: exp, error } = await supabase.from("rl_experiments").insert({
          user_id: user.id, building_id: building!.id, name, algorithm: "dqn",
          config: { days, episodes: eps, weather, occupancy: occ, tariff, comfortMin: cMin, comfortMax: cMax, weights, startT: cfg.startT, stoppedEarly: stopped } as never,
          metrics: metrics as never, curve: c as never, status: stopped ? "stopped" : "completed", train_seconds: seconds,
        }).select().single();
        if (error) throw error;
        await supabase.from("model_artifacts").insert({ user_id: user.id, experiment_id: exp.id, name, algorithm: "dqn", weights: weightsJson as never, config: exp.config });
        await supabase.from("audit_logs").insert({ user_id: user.id, action: "train_dqn", details: { name, seconds } });
        toast.success(`Saved. RL vs baseline energy: ${fmt.pct(metrics.savingsVsBaseline)} ${metrics.savingsVsBaseline < 0 ? "(RL used more)" : ""}`);
        qc.invalidateQueries({ queryKey: ["experiments"] });
        qc.invalidateQueries({ queryKey: ["models"] });
        setStatus("idle");
      }
    } catch (e) {
      toast.error((e as Error).message);
      setStatus("idle");
    }
  };

  const loadModel = async (expId: string) => {
    const m = models.data?.find((x) => x.experiment_id === expId);
    if (!m) return toast.error("No weights for this experiment");
    await supabase.from("model_artifacts").update({ is_active: false }).eq("user_id", user.id);
    await supabase.from("model_artifacts").update({ is_active: true }).eq("id", m.id);
    toast.success("Model loaded — used by Optimization, Equipment and the live RL controller");
    qc.invalidateQueries({ queryKey: ["active-model"] });
    qc.invalidateQueries({ queryKey: ["models"] });
  };

  const remove = async () => {
    if (!del) return;
    await supabase.from("rl_experiments").delete().eq("id", del.id);
    setDel(null);
    qc.invalidateQueries();
  };

  const chart = curve.map((c) => ({ ...c, loss: Number(c.loss.toFixed(4)) }));
  const cmp = (exps.data ?? []).filter((e) => selected.includes(e.id));

  return (
    <div>
      <PageHeader title="RL Control Center" description="Configure the scenario and reward, then train a real DQN agent in a background Web Worker." />
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="shadow-card lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Configuration</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="space-y-1.5">
              <Label>Algorithm</Label>
              <Select value={algo} onValueChange={setAlgo}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="dqn">DQN (implemented)</SelectItem>
                  <SelectItem value="ppo" disabled>PPO — Planned: requires Python backend (Stable-Baselines3)</SelectItem>
                  <SelectItem value="sac" disabled>SAC — Planned: requires Python backend (Stable-Baselines3)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="text-xs text-muted-foreground">Building: <b className="text-foreground">{building.name}</b></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5"><Label>Sim length (days)</Label><Input type="number" min={1} max={14} value={days} onChange={(e) => setDays(Math.max(1, Math.min(14, Number(e.target.value))))} /></div>
              <div className="space-y-1.5"><Label>Episodes</Label><Input type="number" min={1} max={300} value={episodes} onChange={(e) => setEpisodes(Math.max(1, Math.min(300, Number(e.target.value))))} /></div>
              <Pick label="Weather" value={weather} onChange={(v) => setWeather(v as WeatherProfile)} opts={["mild", "hot", "monsoon", "cold"]} />
              <Pick label="Occupancy" value={occ} onChange={(v) => setOcc(v as OccupancyProfile)} opts={["office", "retail", "education"]} />
              <Pick label="Price" value={tariff} onChange={(v) => setTariff(v as Tariff)} opts={["tou", "flat", "cpp"]} />
              <div />
              <div className="space-y-1.5"><Label>Comfort min °C</Label><Input type="number" step={0.5} value={cMin} onChange={(e) => setCMin(Number(e.target.value))} /></div>
              <div className="space-y-1.5"><Label>Comfort max °C</Label><Input type="number" step={0.5} value={cMax} onChange={(e) => setCMax(Number(e.target.value))} /></div>
            </div>
            <div className="pt-2"><Label className="mb-2 block">Reward weights</Label><WeightSliders value={weights} onChange={setWeights} /></div>
            <div className="flex flex-wrap gap-2 pt-2">
              {status === "idle" && <Button onClick={start}><Play /> Start training</Button>}
              {status === "running" && <Button variant="warning" onClick={() => { worker.current?.postMessage({ type: "pause" }); setStatus("paused"); }}><Pause /> Pause</Button>}
              {status === "paused" && <Button onClick={() => { worker.current?.postMessage({ type: "resume" }); setStatus("running"); }}><Play /> Resume</Button>}
              {(status === "running" || status === "paused") && <Button variant="destructive" onClick={() => worker.current?.postMessage({ type: "stop" })}><Square /> Stop & save</Button>}
              {status === "saving" && <Button disabled>Evaluating & saving…</Button>}
            </div>
            {status !== "idle" && <div className="text-xs text-muted-foreground">Episode {curve.length} / {episodes}</div>}
          </CardContent>
        </Card>
        <div className="grid gap-4 lg:col-span-2">
          {chart.length === 0 ? (
            <Empty title="No training running">Start training to see live episode reward, loss and ε.</Empty>
          ) : (
            <>
              <ChartCard title="Episode reward">
                <ResponsiveContainer><LineChart data={chart}><CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" /><XAxis dataKey="episode" stroke={CHART.axis} fontSize={11} /><YAxis stroke={CHART.axis} fontSize={11} /><Tooltip {...tooltipStyle} /><Line dataKey="reward" stroke={CHART.c1} dot={false} strokeWidth={2} isAnimationActive={false} /></LineChart></ResponsiveContainer>
              </ChartCard>
              <div className="grid gap-4 md:grid-cols-2">
                <ChartCard title="TD loss (Huber)">
                  <ResponsiveContainer><LineChart data={chart}><CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" /><XAxis dataKey="episode" stroke={CHART.axis} fontSize={11} /><YAxis stroke={CHART.axis} fontSize={11} /><Tooltip {...tooltipStyle} /><Line dataKey="loss" stroke={CHART.c4} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
                </ChartCard>
                <ChartCard title="Exploration ε">
                  <ResponsiveContainer><LineChart data={chart}><CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" /><XAxis dataKey="episode" stroke={CHART.axis} fontSize={11} /><YAxis stroke={CHART.axis} fontSize={11} domain={[0, 1]} /><Tooltip {...tooltipStyle} /><Line dataKey="epsilon" stroke={CHART.c2} dot={false} isAnimationActive={false} /></LineChart></ResponsiveContainer>
                </ChartCard>
              </div>
            </>
          )}
        </div>
      </div>

      <Card className="mt-6 shadow-card">
        <CardHeader><CardTitle className="text-base">Saved experiments & models</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {(exps.data ?? []).length === 0 ? <Empty title="No experiments yet" /> : (
            <Table>
              <TableHeader><TableRow><TableHead /><TableHead>Name</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Train time</TableHead><TableHead className="text-right">Energy vs baseline</TableHead><TableHead className="text-right">Cost vs baseline</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {(exps.data ?? []).map((e) => {
                  const m = e.metrics as { savingsVsBaseline?: number; costReduction?: number };
                  const isActive = models.data?.some((x) => x.experiment_id === e.id && x.is_active);
                  return (
                    <TableRow key={e.id}>
                      <TableCell><Checkbox checked={selected.includes(e.id)} onCheckedChange={(v) => setSelected((s) => (v ? [...s, e.id] : s.filter((x) => x !== e.id)))} aria-label="Compare" /></TableCell>
                      <TableCell className="font-medium">{e.name}<div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString()}</div></TableCell>
                      <TableCell><Badge variant={e.status === "completed" ? "default" : "secondary"}>{e.status}</Badge></TableCell>
                      <TableCell className="text-right tabular">{Number(e.train_seconds).toFixed(1)} s</TableCell>
                      <TableCell className={`text-right tabular ${(m.savingsVsBaseline ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>{fmt.pct(m.savingsVsBaseline ?? 0)}</TableCell>
                      <TableCell className={`text-right tabular ${(m.costReduction ?? 0) >= 0 ? "text-success" : "text-destructive"}`}>{fmt.pct(m.costReduction ?? 0)}</TableCell>
                      <TableCell className="flex justify-end gap-1">
                        {isActive ? <Badge className="gap-1"><CheckCircle2 className="size-3" /> Loaded</Badge> : <Button size="sm" variant="outline" onClick={() => loadModel(e.id)}><Upload /> Load</Button>}
                        <Button size="icon" variant="ghost" className="text-destructive" onClick={() => setDel(e)} aria-label="Delete"><Trash2 /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
          {activeModel && <div className="mt-3 text-xs text-muted-foreground">Active model: {activeModel.name}</div>}
        </CardContent>
      </Card>

      {cmp.length > 0 && (
        <Card className="mt-6 shadow-card">
          <CardHeader><CardTitle className="text-base">Side-by-side comparison</CardTitle></CardHeader>
          <CardContent className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Metric</TableHead>{cmp.map((e) => <TableHead key={e.id} className="text-right">{e.name}</TableHead>)}</TableRow></TableHeader>
              <TableBody>
                {([
                  ["RL energy (kWh)", (m: any) => m.rl?.energyKwh?.toFixed(0)],
                  ["Baseline energy (kWh)", (m: any) => m.base?.energyKwh?.toFixed(0)],
                  ["RL cost (₹)", (m: any) => fmt.inr(m.rl?.cost ?? 0)],
                  ["Energy savings %", (m: any) => fmt.pct(m.savingsVsBaseline ?? 0)],
                  ["Cost reduction %", (m: any) => fmt.pct(m.costReduction ?? 0)],
                  ["Avg comfort dev (°C)", (m: any) => m.rl?.avgComfortDev?.toFixed(2)],
                  ["Hours outside band", (m: any) => m.rl?.hoursOutside?.toFixed(0)],
                  ["Peak (kW)", (m: any) => m.rl?.peakKw?.toFixed(1)],
                  ["Total reward", (m: any) => m.rl?.totalReward?.toFixed(1)],
                ] as [string, (m: any) => string][]).map(([label, f]) => (
                  <TableRow key={label}><TableCell>{label}</TableCell>{cmp.map((e) => <TableCell key={e.id} className="text-right tabular">{f(e.metrics) ?? "—"}</TableCell>)}</TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Delete experiment?</AlertDialogTitle><AlertDialogDescription>Its saved model weights will be deleted too.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={remove}>Delete</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Pick({ label, value, onChange, opts }: { label: string; value: string; onChange: (v: string) => void; opts: string[] }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>{opts.map((o) => <SelectItem key={o} value={o} className="uppercase">{o}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
