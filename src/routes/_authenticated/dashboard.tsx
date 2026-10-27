import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bot, Gauge, IndianRupee, Leaf, Thermometer, Users, Zap, BatteryCharging } from "lucide-react";
import { useApp } from "@/hooks/use-app";
import { useLiveSim } from "@/hooks/use-live-sim";
import { byDay, useHistory } from "@/hooks/use-readings";
import { CHART, ChartCard, Empty, ErrorState, Kpi, Loading, PageHeader, tooltipStyle } from "@/components/app/ui-bits";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Button } from "@/components/ui/button";
import { fmt } from "@/lib/domain";
import { savingsPct } from "@/lib/rl/evaluate";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — SmartGrid RL" }, { name: "description", content: "Energy, cost, comfort and savings overview." }] }),
  component: Dashboard,
});

const RANGES = { "3": 3, "7": 7, "14": 14 } as const;

function Dashboard() {
  const { building, activeModel } = useApp();
  const live = useLiveSim();
  const q = useHistory();
  const [range, setRange] = useState<keyof typeof RANGES>("7");

  const data = useMemo(() => {
    const all = q.data ?? [];
    if (!all.length || !building) return null;
    const lastDay = all[all.length - 1].day;
    const rows = all.filter((r) => r.day > lastDay - RANGES[range]);
    const days = byDay(rows, Number(building.comfort_min), Number(building.comfort_max));
    const kwh = rows.reduce((a, r) => a + r.grid, 0);
    const base = rows.reduce((a, r) => a + r.baseGrid, 0);
    const cost = rows.reduce((a, r) => a + r.cost, 0);
    const baseCost = rows.reduce((a, r) => a + r.baseCost, 0);
    const fullDays = days.slice(0, -1);
    const yesterday = fullDays[fullDays.length - 1] ?? days[days.length - 1];
    const recent = all.slice(-72).map((r) => ({
      ...r,
      label: `${String(r.hour).padStart(2, "0")}:00`,
    }));
    return { rows, days, kwh, base, cost, baseCost, yesterday, recent, last: all[all.length - 1] };
  }, [q.data, range, building]);

  if (!building) return <Empty title="No building yet">Create one on the <Link className="underline" to="/buildings">Buildings</Link> page.</Empty>;
  if (q.isLoading) return <Loading label="Loading simulated history…" />;
  if (q.error) return <ErrorState error={q.error} />;
  if (!data) return <Empty title="No readings yet">Start the live simulation or reset demo data in Settings.</Empty>;

  const cur = live.last;
  const currentKw = cur ? cur.gridKw : data.last.grid;
  const tIn = cur ? cur.tIn : data.last.tIn;
  const occ = cur ? cur.occ : data.last.occ;
  const sav = savingsPct(data.base, data.kwh);
  const nDays = data.days.length || 1;
  const eff = data.kwh / nDays / Number(building.area_m2);
  const target = Number(building.energy_target_kwh);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description={`${building.name} · history operated by the smart rule-based controller; baseline recomputed on identical weather, occupancy and prices.`}
        actions={
          <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as keyof typeof RANGES)} variant="outline" size="sm">
            <ToggleGroupItem value="3">3 days</ToggleGroupItem>
            <ToggleGroupItem value="7">7 days</ToggleGroupItem>
            <ToggleGroupItem value="14">14 days</ToggleGroupItem>
          </ToggleGroup>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Current power" value={fmt.kw(currentKw)} sub={cur ? "live simulation" : "last history hour"} icon={<Zap className="size-4" />} />
        <Kpi label="Daily energy" value={fmt.kwh(data.yesterday.kwh)} sub={`target ${target} kWh · ${data.yesterday.label}`} tone={data.yesterday.kwh > target ? "warn" : "good"} icon={<Gauge className="size-4" />} />
        <Kpi label="Est. cost" value={fmt.inr(data.cost)} sub={`${nDays} days · baseline ${fmt.inr(data.baseCost)}`} icon={<IndianRupee className="size-4" />} />
        <Kpi label="Savings vs baseline" value={fmt.pct(sav)} sub={`${fmt.kwh(data.base - data.kwh)} saved`} tone={sav >= 0 ? "good" : "bad"} icon={<Leaf className="size-4" />} hint="(baseline − actual) / baseline × 100 over the selected range" />
        <Kpi label="Indoor temp" value={Number.isNaN(tIn) ? "—" : fmt.c(tIn)} sub={`comfort ${building.comfort_min}–${building.comfort_max}°C`} tone={tIn < Number(building.comfort_min) || tIn > Number(building.comfort_max) ? "warn" : "default"} icon={<Thermometer className="size-4" />} />
        <Kpi label="Occupancy" value={`${Math.round(occ * 100)}%`} sub={building.building_type} icon={<Users className="size-4" />} />
        <Kpi label="Efficiency" value={`${(eff * 1000).toFixed(0)} Wh/m²·day`} sub={`${building.area_m2} m²`} icon={<BatteryCharging className="size-4" />} />
        <Kpi label="RL status" value={activeModel ? "Model loaded" : "No model"} sub={activeModel ? activeModel.name : "train one in RL Control Center"} tone={activeModel ? "good" : "default"} icon={<Bot className="size-4" />} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <ChartCard title="Hourly consumption" description="Grid power, last 72 h (kW)">
          <ResponsiveContainer>
            <AreaChart data={data.recent}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke={CHART.axis} fontSize={11} interval={11} />
              <YAxis stroke={CHART.axis} fontSize={11} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => v.toFixed(1)} />
              <Area dataKey="grid" name="Grid kW" stroke={CHART.c1} fill={CHART.c1} fillOpacity={0.25} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Daily energy trend" description="kWh per day vs target">
          <ResponsiveContainer>
            <BarChart data={data.days}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke={CHART.axis} fontSize={11} />
              <YAxis stroke={CHART.axis} fontSize={11} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => v.toFixed(0)} />
              <ReferenceLine y={target} stroke={CHART.c4} strokeDasharray="4 4" label={{ value: "target", fill: CHART.axis, fontSize: 10 }} />
              <Bar dataKey="kwh" name="kWh" fill={CHART.c1} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Baseline vs actual" description="Daily kWh; baseline = fixed-rule controller on identical inputs">
          <ResponsiveContainer>
            <LineChart data={data.days}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke={CHART.axis} fontSize={11} />
              <YAxis stroke={CHART.axis} fontSize={11} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => v.toFixed(0)} />
              <Legend />
              <Line dataKey="baseKwh" name="Baseline" stroke={CHART.c5} strokeWidth={2} dot={false} />
              <Line dataKey="kwh" name="Actual (rule-based)" stroke={CHART.c1} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Cost trend" description="₹ per day">
          <ResponsiveContainer>
            <LineChart data={data.days}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke={CHART.axis} fontSize={11} />
              <YAxis stroke={CHART.axis} fontSize={11} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => fmt.inr(v)} />
              <Legend />
              <Line dataKey="baseCost" name="Baseline" stroke={CHART.c5} dot={false} />
              <Line dataKey="cost" name="Actual" stroke={CHART.c3} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="End-use breakdown" description="HVAC vs lighting vs appliances (kWh/day)">
          <ResponsiveContainer>
            <BarChart data={data.days}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke={CHART.axis} fontSize={11} />
              <YAxis stroke={CHART.axis} fontSize={11} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => v.toFixed(0)} />
              <Legend />
              <Bar dataKey="hvac" name="HVAC" stackId="a" fill={CHART.c2} />
              <Bar dataKey="lighting" name="Lighting" stackId="a" fill={CHART.c3} />
              <Bar dataKey="appliance" name="Appliances" stackId="a" fill={CHART.c5} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Temperature & comfort" description="Indoor vs outdoor, last 72 h; shaded = comfort band">
          <ResponsiveContainer>
            <LineChart data={data.recent}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke={CHART.axis} fontSize={11} interval={11} />
              <YAxis stroke={CHART.axis} fontSize={11} domain={["auto", "auto"]} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => `${v.toFixed(1)}°C`} />
              <ReferenceArea y1={Number(building.comfort_min)} y2={Number(building.comfort_max)} fill={CHART.c1} fillOpacity={0.1} />
              <Legend />
              <Line dataKey="tIn" name="Indoor" stroke={CHART.c1} strokeWidth={2} dot={false} />
              <Line dataKey="tOut" name="Outdoor" stroke={CHART.c4} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Battery history" description="State of charge (%) and battery power (kW), last 72 h" className="lg:col-span-2">
          <ResponsiveContainer>
            <LineChart data={data.recent.map((r) => ({ ...r, socPct: r.soc * 100 }))}>
              <CartesianGrid stroke={CHART.grid} strokeDasharray="3 3" />
              <XAxis dataKey="label" stroke={CHART.axis} fontSize={11} interval={11} />
              <YAxis yAxisId="l" stroke={CHART.axis} fontSize={11} domain={[0, 100]} />
              <YAxis yAxisId="r" orientation="right" stroke={CHART.axis} fontSize={11} />
              <Tooltip {...tooltipStyle} formatter={(v: any) => v.toFixed(1)} />
              <Legend />
              <Line yAxisId="l" dataKey="socPct" name="SoC %" stroke={CHART.c2} strokeWidth={2} dot={false} />
              <Line yAxisId="r" dataKey="battery" name="Battery kW (+charge)" stroke={CHART.c3} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <div className="mt-4 flex justify-end">
        <Button asChild variant="outline" size="sm"><Link to="/compare">Run full baseline vs RL evaluation →</Link></Button>
      </div>
    </div>
  );
}
