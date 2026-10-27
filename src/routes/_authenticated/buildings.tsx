import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Building2, Loader2, Pencil, Plus, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { Empty, PageHeader } from "@/components/app/ui-bits";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Building } from "@/lib/domain";
import { createBuildingWithData } from "@/lib/seed";

export const Route = createFileRoute("/_authenticated/buildings")({
  head: () => ({ meta: [{ title: "Buildings — SmartGrid RL" }, { name: "description", content: "Manage your simulated buildings." }] }),
  component: Buildings,
});

type Form = {
  name: string; location: string; area_m2: number; floors: number; building_type: string; open_hour: number; close_hour: number;
  energy_target_kwh: number; comfort_min: number; comfort_max: number; weather_profile: string; battery_kwh: number; battery_kw: number; solar_kw: number;
};
const EMPTY: Form = { name: "", location: "", area_m2: 1000, floors: 2, building_type: "office", open_hour: 8, close_hour: 18, energy_target_kwh: 400, comfort_min: 22, comfort_max: 26, weather_profile: "hot", battery_kwh: 50, battery_kw: 15, solar_kw: 20 };

function validate(f: Form): string | null {
  if (!f.name.trim()) return "Name is required";
  if (f.area_m2 < 50 || f.area_m2 > 100000) return "Area must be 50–100,000 m²";
  if (f.open_hour < 0 || f.close_hour > 24 || f.open_hour >= f.close_hour) return "Opening hours must satisfy 0 ≤ open < close ≤ 24";
  if (f.comfort_min >= f.comfort_max) return "Comfort min must be below comfort max";
  return null;
}

function Buildings() {
  const { buildings, user, profile, setBuildingId, building: selected } = useApp();
  const qc = useQueryClient();
  const [edit, setEdit] = useState<Building | "new" | null>(null);
  const [view, setView] = useState<Building | null>(null);
  const [del, setDel] = useState<Building | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);

  const open = (b: Building | "new") => {
    setEdit(b);
    setForm(b === "new" ? EMPTY : { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((k) => [k, (b as never)[k]])) } as Form);
  };

  const save = async () => {
    const err = validate(form);
    if (err) return toast.error(err);
    setBusy(true);
    try {
      if (edit === "new") {
        const b = await createBuildingWithData(user.id, profile, form);
        setBuildingId(b.id);
        toast.success("Building created with 14 days of simulated history");
      } else if (edit) {
        const { error } = await supabase.from("buildings").update(form).eq("id", edit.id);
        if (error) throw error;
        toast.success("Building updated");
      }
      await supabase.from("audit_logs").insert({ user_id: user.id, action: edit === "new" ? "building_create" : "building_update", details: { name: form.name } });
      qc.invalidateQueries();
      setEdit(null);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!del) return;
    const { error } = await supabase.from("buildings").delete().eq("id", del.id);
    if (error) return toast.error(error.message);
    toast.success(`Deleted ${del.name}`);
    setDel(null);
    qc.invalidateQueries();
  };

  const num = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: Number(e.target.value) });

  return (
    <div>
      <PageHeader title="Buildings" description="Each building is a simulated model. Only you can see your buildings." actions={<Button onClick={() => open("new")}><Plus /> Add building</Button>} />
      {buildings.length === 0 ? (
        <Empty title="No buildings">Add your first building to start simulating.</Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {buildings.map((b) => (
            <Card key={b.id} className={`shadow-card ${selected?.id === b.id ? "ring-2 ring-primary" : ""}`}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <span className="grid size-10 place-items-center rounded-lg bg-accent text-accent-foreground"><Building2 className="size-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display font-semibold">{b.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{b.location || "—"}</div>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-2 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Area / floors</dt><dd>{b.area_m2} m² · {b.floors}</dd>
                  <dt className="text-muted-foreground">Type</dt><dd className="capitalize">{b.building_type}</dd>
                  <dt className="text-muted-foreground">Hours</dt><dd>{b.open_hour}:00–{b.close_hour}:00</dd>
                  <dt className="text-muted-foreground">Comfort</dt><dd>{b.comfort_min}–{b.comfort_max}°C</dd>
                  <dt className="text-muted-foreground">Target</dt><dd>{b.energy_target_kwh} kWh/day</dd>
                </dl>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Button size="sm" variant={selected?.id === b.id ? "secondary" : "default"} onClick={() => setBuildingId(b.id)}>{selected?.id === b.id ? "Selected" : "Select"}</Button>
                  <Button size="sm" variant="outline" onClick={() => setView(b)}><Eye /> View</Button>
                  <Button size="sm" variant="outline" onClick={() => open(b)}><Pencil /> Edit</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setDel(b)} aria-label="Delete"><Trash2 /></Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{edit === "new" ? "Add building" : "Edit building"}</DialogTitle></DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <F label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></F>
            <F label="Location"><Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} /></F>
            <F label="Area (m²)"><Input type="number" value={form.area_m2} onChange={num("area_m2")} /></F>
            <F label="Floors"><Input type="number" value={form.floors} onChange={num("floors")} /></F>
            <F label="Occupancy profile">
              <Select value={form.building_type} onValueChange={(v) => setForm({ ...form, building_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["office", "retail", "education"].map((x) => <SelectItem key={x} value={x} className="capitalize">{x}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Weather profile">
              <Select value={form.weather_profile} onValueChange={(v) => setForm({ ...form, weather_profile: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["mild", "hot", "monsoon", "cold"].map((x) => <SelectItem key={x} value={x} className="capitalize">{x}</SelectItem>)}</SelectContent>
              </Select>
            </F>
            <F label="Opens (hour)"><Input type="number" value={form.open_hour} onChange={num("open_hour")} /></F>
            <F label="Closes (hour)"><Input type="number" value={form.close_hour} onChange={num("close_hour")} /></F>
            <F label="Comfort min (°C)"><Input type="number" step="0.5" value={form.comfort_min} onChange={num("comfort_min")} /></F>
            <F label="Comfort max (°C)"><Input type="number" step="0.5" value={form.comfort_max} onChange={num("comfort_max")} /></F>
            <F label="Energy target (kWh/day)"><Input type="number" value={form.energy_target_kwh} onChange={num("energy_target_kwh")} /></F>
            <F label="Solar PV (kWp, 0 = none)"><Input type="number" value={form.solar_kw} onChange={num("solar_kw")} /></F>
            <F label="Battery capacity (kWh)"><Input type="number" value={form.battery_kwh} onChange={num("battery_kwh")} /></F>
            <F label="Battery power limit (kW)"><Input type="number" value={form.battery_kw} onChange={num("battery_kw")} /></F>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy && <Loader2 className="animate-spin" />} {edit === "new" ? "Create & simulate history" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!view} onOpenChange={(o) => !o && setView(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{view?.name}</DialogTitle></DialogHeader>
          {view && (
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              {Object.entries({ Location: view.location, "Area": `${view.area_m2} m²`, Floors: view.floors, Profile: view.building_type, Weather: view.weather_profile, Hours: `${view.open_hour}:00–${view.close_hour}:00`, Comfort: `${view.comfort_min}–${view.comfort_max}°C`, Target: `${view.energy_target_kwh} kWh/day`, Solar: `${view.solar_kw} kWp`, Battery: `${view.battery_kwh} kWh / ${view.battery_kw} kW`, Created: new Date(view.created_at).toLocaleString() }).map(([k, v]) => (
                <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd>{String(v)}</dd></div>
              ))}
            </dl>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!del} onOpenChange={(o) => !o && setDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {del?.name}?</AlertDialogTitle>
            <AlertDialogDescription>This permanently removes the building with its equipment, readings, alerts and recommendations.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
