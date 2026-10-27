import { createFileRoute } from "@tanstack/react-router";
import { Area, AreaChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Pause, Play, StepForward, Zap, Thermometer, Users, IndianRupee, Battery, Sun } from "lucide-react";
import { useApp } from "@/hooks/use-app";
import { useLiveSim, type ControllerMode } from "@/hooks/use-live-sim";
import { CHART, ChartCard, Empty, Kpi, PageHeader, tooltipStyle } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fmt } from "@/lib/domain";
import { CONTROLLER_LABELS } from "@/lib/rl/controllers";

export const Route = createFileRoute("/_authenticated/monitoring")({
  head: () => ({ meta: [{ title: "Live Monitoring — SmartGrid RL" }, { name: "description", content: "Real-time simulated building telemetry." }] }),
  component: Monitoring,
});

function Monitoring() {
  const { activeNet } = useApp();
  const s = useLiveSim();
  const data = s.readings.map((r) => ({
    ...r,
    label: new Date(r.ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    socPct: r.soc * 100,
    occPct: r.occ * 100,
  }));
  const l = s.last;

  return (
    <div>
      <PageHeader
        title="Live Monitoring"
        description="The simulator advances one step per tick and writes each reading to your database. Charts update without refreshing."
        actions={
          <>
            <Button onClick={() => s.setRunning(!s.running)} variant={s.running ? "warning" : "default"}>
              {s.running ? <><Pause /> Pause</> : <><Play /> Start</>}
            </Button>
            <Button variant="outline" onClick={s.tick} disabled={s.running}><StepForward /> Single step</Button>
          </>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border bg-card p-3 text-sm shadow-card">
        <div className="flex items-center gap-2">
          <Label>Tick every</Label>
          <Select value={String(s.speedMs)} onValueChange={(v) => s.setSpeedMs(Number(v))}>
            <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
            <SelectContent>{[500, 1000, 2000, 5000].map((x) => <SelectItem key={x} value={String(x)}>{x / 1000}s</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Sim step</Label>
          <Select value={String(s.stepMinutes)} onValueChange={(v) => s.setStepMinutes(Number(v))}>
            <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
            <SelectContent>{[5, 15, 30, 60].map((x) => <SelectItem key={x} value={String(x)}>{x} min</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Label>Controller</Label>
          <Select value={s.mode} onValueChange={(v) => s.setMode(v as ControllerMode)}>
            <SelectTrigger className="h-8 w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="baseline">{CONTROLLER_LABELS.baseline}</SelectItem>
              <SelectItem value="rule">{CONTROLLER_LABELS.rule}</SelectItem>
              <SelectItem value="rl" disabled={!activeNet}>{CONTROLLER_LABELS.rl}{!activeNet && " — no model loaded"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-2">
          <Switch id="persist" checked={s.persist} onCheckedChange={s.setPersist} />
          <Label htmlFor="persist">Save readings</Label>
        </div>
        <span className="ml-auto font-mono text-xs text-muted-foreground">sim clock {l ? new Date(l.ts).toLocaleString("en-IN") : "—"}</span>
      </div>

      {!l ? (
        <Empty title="Simulation not started">Press Start (or Single step) to begin streaming simulated readings.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Kpi label="Grid power" value={fmt.kw(l.gridKw)} sub={`load ${fmt.kw(l.totalKw)}`} icon={<Zap className="size-4" />} />
            <Kpi label="Indoor / outdoor" value={fmt.c(l.tIn)} sub={`outdoor ${fmt.c(l.tOut)}`} icon={<Thermometer className="size-4" />} />
            <Kpi label="Occupancy" value={`${Math.round(l.occ * 100)}%`} icon={<Users className="size-4" />} />
            <Kpi label="Price" value={`₹${l.price.toFixed(1)}/kWh`} tone={l.price >= 12 ? "warn" : "default"} icon={<IndianRupee className="size-4" />} />
            <Kpi label="Battery SoC" value={`${Math.round(l.soc * 100)}%`} sub={`${l.batteryKw >= 0 ? "+" : ""}${l.batteryKw.toFixed(1)} kW`} icon={<Battery className="size-4" />} />
            <Kpi label="Solar" value={fmt.kw(l.solarKw)} icon={<Sun className="size-4" />} />
          </div>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard title="Power by equipment" description="kW, stacked">
              <ResponsiveContainer>
                <AreaChart data={data}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke={CHART.axis} fontSize={11} minTickGap={30} />
                  <YAxis stroke={CHART.axis} fontSize={11} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => v.toFixed(1)} />
                  <Legend />
                  <Area dataKey="hvacKw" name="HVAC" stackId="a" stroke={CHART.c2} fill={CHART.c2} fillOpacity={0.5} isAnimationActive={false} />
                  <Area dataKey="lightingKw" name="Lighting" stackId="a" stroke={CHART.c3} fill={CHART.c3} fillOpacity={0.5} isAnimationActive={false} />
                  <Area dataKey="applianceKw" name="Appliances" stackId="a" stroke={CHART.c5} fill={CHART.c5} fillOpacity={0.5} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Temperatures" description="°C">
              <ResponsiveContainer>
                <LineChart data={data}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke={CHART.axis} fontSize={11} minTickGap={30} />
                  <YAxis stroke={CHART.axis} fontSize={11} domain={["auto", "auto"]} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => v.toFixed(1)} />
                  <Legend />
                  <Line dataKey="tIn" name="Indoor" stroke={CHART.c1} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line dataKey="tOut" name="Outdoor" stroke={CHART.c4} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Grid, solar & price">
              <ResponsiveContainer>
                <LineChart data={data}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke={CHART.axis} fontSize={11} minTickGap={30} />
                  <YAxis yAxisId="l" stroke={CHART.axis} fontSize={11} />
                  <YAxis yAxisId="r" orientation="right" stroke={CHART.axis} fontSize={11} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => v.toFixed(1)} />
                  <Legend />
                  <Line yAxisId="l" dataKey="gridKw" name="Grid kW" stroke={CHART.c1} dot={false} isAnimationActive={false} />
                  <Line yAxisId="l" dataKey="solarKw" name="Solar kW" stroke={CHART.c3} dot={false} isAnimationActive={false} />
                  <Line yAxisId="r" dataKey="price" name="₹/kWh" stroke={CHART.c4} dot={false} type="stepAfter" isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            <ChartCard title="Occupancy & battery" description="%">
              <ResponsiveContainer>
                <LineChart data={data}>
                  <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke={CHART.axis} fontSize={11} minTickGap={30} />
                  <YAxis stroke={CHART.axis} fontSize={11} domain={[0, 100]} />
                  <Tooltip {...tooltipStyle} formatter={(v: any) => v.toFixed(0)} />
                  <Legend />
                  <Line dataKey="occPct" name="Occupancy %" stroke={CHART.c5} dot={false} isAnimationActive={false} />
                  <Line dataKey="socPct" name="SoC %" stroke={CHART.c2} strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>
        </>
      )}
    </div>
  );
}
