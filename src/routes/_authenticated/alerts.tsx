import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { Empty, ErrorState, Loading, PageHeader } from "@/components/app/ui-bits";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export const Route = createFileRoute("/_authenticated/alerts")({
  head: () => ({ meta: [{ title: "Alerts — SmartGrid RL" }, { name: "description", content: "Anomaly detection and alerts." }] }),
  component: Alerts,
});

const RULES: Record<string, string> = { high_use: "Abnormal high use", off_draw: "Drawing power while off", overnight: "Unusual overnight use", zscore: "Above rolling baseline (z-score)", comfort: "Outside comfort range" };

function Alerts() {
  const { buildings } = useApp();
  const qc = useQueryClient();
  const [sev, setSev] = useState("all");
  const [status, setStatus] = useState("all");
  const [bid, setBid] = useState("all");
  const q = useQuery({
    queryKey: ["alerts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("alerts").select("*").order("ts", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    const ch = supabase.channel(`alerts-${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "*", schema: "public", table: "alerts" }, () => qc.invalidateQueries({ queryKey: ["alerts"] })).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const setSt = async (id: string, s: string) => {
    const { error } = await supabase.from("alerts").update({ status: s }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["alerts"] });
  };

  const rows = (q.data ?? []).filter((a) => (sev === "all" || a.severity === sev) && (status === "all" || a.status === status) && (bid === "all" || a.building_id === bid));
  const bname = (id: string) => buildings.find((b) => b.id === id)?.name ?? "—";

  return (
    <div>
      <PageHeader title="Anomaly Detection & Alerts" description="Rules: high use vs expected (>1.5×), power draw while off, after-hours use, z-score > 3 vs rolling 24-step window, and comfort > 1°C outside band while occupied." />
      <div className="mb-4 flex flex-wrap gap-2">
        <F v={sev} set={setSev} opts={[["all", "All severities"], ["critical", "Critical"], ["warning", "Warning"], ["info", "Info"]]} />
        <F v={status} set={setStatus} opts={[["all", "All statuses"], ["open", "Open"], ["acknowledged", "Acknowledged"], ["resolved", "Resolved"]]} />
        <F v={bid} set={setBid} opts={[["all", "All buildings"], ...buildings.map((b) => [b.id, b.name] as [string, string])]} />
      </div>
      {q.isLoading ? <Loading /> : q.error ? <ErrorState error={q.error} /> : rows.length === 0 ? <Empty title="No alerts match">Run the live simulation; try toggling a standby fault on the Equipment page.</Empty> : (
        <Card className="shadow-card"><CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader><TableRow><TableHead>Time (sim)</TableHead><TableHead>Severity</TableHead><TableHead>Rule</TableHead><TableHead>Building / equipment</TableHead><TableHead>Explanation</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="whitespace-nowrap text-xs">{new Date(a.ts).toLocaleString("en-IN")}</TableCell>
                  <TableCell><Badge variant={a.severity === "critical" ? "destructive" : "secondary"} className={a.severity === "warning" ? "bg-warning text-warning-foreground" : ""}>{a.severity}</Badge></TableCell>
                  <TableCell className="text-xs">{RULES[a.rule] ?? a.rule}</TableCell>
                  <TableCell className="text-xs">{bname(a.building_id)}{a.equipment && ` · ${a.equipment}`}</TableCell>
                  <TableCell className="max-w-sm text-xs">{a.message}</TableCell>
                  <TableCell className="text-xs capitalize">{a.status}</TableCell>
                  <TableCell className="flex gap-1">
                    {a.status === "open" && <Button size="sm" variant="outline" onClick={() => setSt(a.id, "acknowledged")}>Acknowledge</Button>}
                    {a.status !== "resolved" && <Button size="sm" onClick={() => setSt(a.id, "resolved")}>Resolve</Button>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent></Card>
      )}
    </div>
  );
}

function F({ v, set, opts }: { v: string; set: (s: string) => void; opts: [string, string][] }) {
  return <Select value={v} onValueChange={set}><SelectTrigger className="h-9 w-48"><SelectValue /></SelectTrigger><SelectContent>{opts.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>;
}
