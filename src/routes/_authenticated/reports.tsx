import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Download, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { byDay, useHistory, type DayRow } from "@/hooks/use-readings";
import { Empty, Kpi, Loading, PageHeader } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmt } from "@/lib/domain";
import { savingsPct } from "@/lib/rl/evaluate";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports — SmartGrid RL" }, { name: "description", content: "Daily, weekly and monthly energy reports." }] }),
  component: Reports,
});

type Period = "daily" | "weekly" | "monthly";

function group(days: DayRow[], p: Period): DayRow[] {
  if (p === "daily") return days;
  const size = p === "weekly" ? 7 : 30;
  const out: DayRow[] = [];
  for (let i = 0; i < days.length; i += size) {
    const g = days.slice(i, i + size);
    const sum = (k: keyof DayRow) => g.reduce((a, d) => a + (d[k] as number), 0);
    out.push({ ...g[0], label: `${g[0].label} – ${g[g.length - 1].label}`, kwh: sum("kwh"), cost: sum("cost"), baseKwh: sum("baseKwh"), baseCost: sum("baseCost"), hvac: sum("hvac"), lighting: sum("lighting"), appliance: sum("appliance"), solar: sum("solar"), hoursOutside: sum("hoursOutside"), avgTin: sum("avgTin") / g.length, peak: Math.max(...g.map((d) => d.peak)) });
  }
  return out;
}

function Reports() {
  const { building } = useApp();
  const h = useHistory();
  const [period, setPeriod] = useState<Period>("daily");
  const alerts = useQuery({ queryKey: ["alerts"], queryFn: async () => (await supabase.from("alerts").select("*").order("ts", { ascending: false }).limit(500)).data ?? [] });
  const rows = useMemo(() => (building && h.data ? group(byDay(h.data, Number(building.comfort_min), Number(building.comfort_max)), period) : []), [h.data, building, period]);
  if (!building) return <Empty title="Select a building first" />;
  if (h.isLoading) return <Loading />;
  if (!rows.length) return <Empty title="No data to report" />;

  const tot = rows.reduce((a, r) => ({ kwh: a.kwh + r.kwh, cost: a.cost + r.cost, base: a.base + r.baseKwh, baseCost: a.baseCost + r.baseCost, out: a.out + r.hoursOutside, hvac: a.hvac + r.hvac, light: a.light + r.lighting, app: a.app + r.appliance }), { kwh: 0, cost: 0, base: 0, baseCost: 0, out: 0, hvac: 0, light: 0, app: 0 });
  const bAlerts = (alerts.data ?? []).filter((a) => a.building_id === building.id);
  const header = ["Period", "Energy kWh", "Cost INR", "Baseline kWh", "Baseline cost INR", "Savings %", "HVAC kWh", "Lighting kWh", "Appliances kWh", "Solar kWh", "Peak kW", "Avg indoor C", "Hours outside comfort"];
  const table = rows.map((r) => [r.label, r.kwh.toFixed(1), r.cost.toFixed(0), r.baseKwh.toFixed(1), r.baseCost.toFixed(0), savingsPct(r.baseKwh, r.kwh).toFixed(1), r.hvac.toFixed(1), r.lighting.toFixed(1), r.appliance.toFixed(1), r.solar.toFixed(1), r.peak.toFixed(1), r.avgTin.toFixed(1), String(r.hoursOutside)]);

  const csv = () => {
    const body = [header, ...table].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/csv" }));
    a.download = `smartgrid-${period}-report.csv`;
    a.click();
  };
  const pdf = async () => {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16); doc.text(`SmartGrid RL — ${period} report`, 14, 16);
    doc.setFontSize(10);
    doc.text(`${building.name} · SIMULATED DATA (no physical hardware) · generated ${new Date().toLocaleString()}`, 14, 23);
    doc.text(`Total energy ${tot.kwh.toFixed(0)} kWh · cost INR ${tot.cost.toFixed(0)} · savings vs baseline ${savingsPct(tot.base, tot.kwh).toFixed(1)}% · cost reduction ${savingsPct(tot.baseCost, tot.cost).toFixed(1)}% · hours outside comfort ${tot.out}`, 14, 30);
    doc.text(`Equipment: HVAC ${tot.hvac.toFixed(0)} kWh · Lighting ${tot.light.toFixed(0)} kWh · Appliances ${tot.app.toFixed(0)} kWh · Alerts ${bAlerts.length}`, 14, 36);
    const cols = [14, 62, 84, 104, 126, 150, 170, 190, 212, 236, 254, 272];
    let y = 46;
    doc.setFontSize(7);
    const draw = (r: string[]) => { r.slice(0, 12).forEach((c, i) => doc.text(c, cols[i], y)); y += 5; if (y > 195) { doc.addPage(); y = 16; } };
    draw(header.slice(0, 12)); table.forEach(draw);
    y += 4; doc.setFontSize(9); doc.text("Anomaly history (latest 15)", 14, y); y += 5; doc.setFontSize(7);
    bAlerts.slice(0, 15).forEach((a) => { doc.text(`${new Date(a.ts).toLocaleString()} [${a.severity}] ${a.message}`.slice(0, 180), 14, y); y += 4; if (y > 200) { doc.addPage(); y = 16; } });
    doc.save(`smartgrid-${period}-report.pdf`);
  };

  return (
    <div>
      <PageHeader title="Reports" description="Built from your stored simulated readings and the baseline recomputed on the same inputs."
        actions={<>
          <ToggleGroup type="single" value={period} onValueChange={(v) => v && setPeriod(v as Period)} variant="outline" size="sm">
            <ToggleGroupItem value="daily">Daily</ToggleGroupItem><ToggleGroupItem value="weekly">Weekly</ToggleGroupItem><ToggleGroupItem value="monthly">Monthly</ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" onClick={csv}><Download /> CSV</Button>
          <Button onClick={pdf}><FileText /> PDF</Button>
        </>}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Energy" value={fmt.kwh(tot.kwh)} sub={`baseline ${fmt.kwh(tot.base)}`} />
        <Kpi label="Cost" value={fmt.inr(tot.cost)} sub={`reduction ${fmt.pct(savingsPct(tot.baseCost, tot.cost))}`} />
        <Kpi label="Savings" value={fmt.pct(savingsPct(tot.base, tot.kwh))} tone={tot.kwh <= tot.base ? "good" : "bad"} />
        <Kpi label="Comfort" value={`${tot.out} h`} sub="occupied hours outside band" />
      </div>
      <Card className="mt-4 shadow-card"><CardHeader><CardTitle className="text-base capitalize">{period} summary</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <Table><TableHeader><TableRow>{header.map((x) => <TableHead key={x} className="whitespace-nowrap">{x}</TableHead>)}</TableRow></TableHeader>
            <TableBody>{table.map((r) => <TableRow key={r[0]}>{r.map((c, i) => <TableCell key={i} className="whitespace-nowrap tabular">{c}</TableCell>)}</TableRow>)}</TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card className="mt-4 shadow-card"><CardHeader><CardTitle className="text-base">Anomaly history ({bAlerts.length})</CardTitle></CardHeader>
        <CardContent className="space-y-1 text-sm">{bAlerts.slice(0, 10).map((a) => <div key={a.id} className="text-xs"><span className="text-muted-foreground">{new Date(a.ts).toLocaleString("en-IN")}</span> · <b>{a.severity}</b> · {a.message}</div>)}{bAlerts.length === 0 && <div className="text-muted-foreground">No alerts.</div>}</CardContent>
      </Card>
    </div>
  );
}
