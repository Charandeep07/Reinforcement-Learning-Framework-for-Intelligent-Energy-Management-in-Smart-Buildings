import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { useLiveSim } from "@/hooks/use-live-sim";
import { PageHeader } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { TIMEZONES } from "@/lib/domain";
import { resetDemo, seedPrices } from "@/lib/seed";
import type { Tariff } from "@/lib/sim/profiles";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [{ title: "Settings — SmartGrid RL" }, { name: "description", content: "Profile, tariff and simulation settings." }] }),
  component: Settings,
});

function Settings() {
  const { profile, user } = useApp();
  const live = useLiveSim();
  const qc = useQueryClient();
  const [f, setF] = useState(profile!);
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);
  useEffect(() => { if (profile) setF(profile); }, [profile]);
  if (!f) return null;

  const save = async () => {
    if (Number(f.comfort_min) >= Number(f.comfort_max)) return toast.error("Comfort min must be below max");
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ display_name: f.display_name, tariff: f.tariff, flat_price: f.flat_price, comfort_min: f.comfort_min, comfort_max: f.comfort_max, notify_alerts: f.notify_alerts, units: f.units, timezone: f.timezone, sim_seed: f.sim_seed }).eq("id", user.id);
    if (!error) await seedPrices(user.id, f.tariff as Tariff, f.sim_seed, Number(f.flat_price));
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Settings saved");
    qc.invalidateQueries();
  };

  const reset = async () => {
    setResetting(true);
    live.setRunning(false);
    try {
      await resetDemo(user.id, profile);
      localStorage.removeItem("sg-building");
      toast.success("Demo data reset");
      qc.invalidateQueries();
    } catch (e) { toast.error((e as Error).message); }
    setResetting(false);
  };

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="shadow-card"><CardHeader><CardTitle className="text-base">Profile</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Email</Label><Input value={user.email ?? ""} disabled /></div>
          <div className="space-y-1.5"><Label>Display name</Label><Input value={f.display_name ?? ""} onChange={(e) => setF({ ...f, display_name: e.target.value })} /></div>
          <div className="flex items-center justify-between"><Label>Alert notifications (toasts)</Label><Switch checked={f.notify_alerts} onCheckedChange={(v) => setF({ ...f, notify_alerts: v })} /></div>
        </CardContent></Card>
        <Card className="shadow-card"><CardHeader><CardTitle className="text-base">Energy price tariff</CardTitle></CardHeader><CardContent className="space-y-3">
          <Select value={f.tariff} onValueChange={(v) => setF({ ...f, tariff: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>
            <SelectItem value="tou">Time-of-use (₹5 off-peak · ₹8 normal · ₹12 peak 18–22h)</SelectItem>
            <SelectItem value="flat">Flat rate</SelectItem>
            <SelectItem value="cpp">Critical-peak (TOU + ₹25 events 14–18h)</SelectItem>
          </SelectContent></Select>
          <div className="space-y-1.5"><Label>Flat price (₹/kWh)</Label><Input type="number" step="0.5" value={f.flat_price} onChange={(e) => setF({ ...f, flat_price: Number(e.target.value) })} /></div>
        </CardContent></Card>
        <Card className="shadow-card"><CardHeader><CardTitle className="text-base">Comfort defaults</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label>Min °C</Label><Input type="number" step="0.5" value={f.comfort_min} onChange={(e) => setF({ ...f, comfort_min: Number(e.target.value) })} /></div>
          <div className="space-y-1.5"><Label>Max °C</Label><Input type="number" step="0.5" value={f.comfort_max} onChange={(e) => setF({ ...f, comfort_max: Number(e.target.value) })} /></div>
          <p className="col-span-2 text-xs text-muted-foreground">Each building keeps its own comfort range; these defaults apply where a building doesn't override.</p>
        </CardContent></Card>
        <Card className="shadow-card"><CardHeader><CardTitle className="text-base">Simulation, units & timezone</CardTitle></CardHeader><CardContent className="space-y-3">
          <div className="space-y-1.5"><Label>Random seed (weather/occupancy/prices)</Label><Input type="number" value={f.sim_seed} onChange={(e) => setF({ ...f, sim_seed: Math.round(Number(e.target.value)) })} /></div>
          <div className="space-y-1.5"><Label>Units</Label><Select value={f.units} onValueChange={(v) => setF({ ...f, units: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="metric">Metric (°C, kW, kWh, m²)</SelectItem></SelectContent></Select></div>
          <div className="space-y-1.5"><Label>Timezone</Label><Select value={f.timezone} onValueChange={(v) => setF({ ...f, timezone: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{TIMEZONES.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent></Select></div>
        </CardContent></Card>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Save />} Save settings</Button>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button variant="destructive" disabled={resetting}>{resetting ? <Loader2 className="animate-spin" /> : <RotateCcw />} Reset demo data</Button></AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader><AlertDialogTitle>Reset all demo data?</AlertDialogTitle><AlertDialogDescription>Deletes all buildings, readings, alerts, experiments, models and scenarios, then recreates the demo building with fresh simulated history.</AlertDialogDescription></AlertDialogHeader>
            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={reset}>Reset</AlertDialogAction></AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
