import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Building, ModelArtifact, Profile } from "@/lib/domain";
import { seedDemo } from "@/lib/seed";
import { MLP, type MLPJson } from "@/lib/rl/mlp";
import { toast } from "sonner";

interface AppCtx {
  user: User;
  profile: Profile | null;
  buildings: Building[];
  building: Building | null;
  setBuildingId: (id: string) => void;
  activeModel: ModelArtifact | null;
  activeNet: MLP | null;
  seeding: boolean;
  loading: boolean;
}

const Ctx = createContext<AppCtx | null>(null);

export function AppProvider({ user, children }: { user: User; children: ReactNode }) {
  const qc = useQueryClient();
  const profileQ = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const buildingsQ = useQuery({
    queryKey: ["buildings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("buildings").select("*").order("created_at");
      if (error) throw error;
      return data;
    },
  });
  const modelQ = useQuery({
    queryKey: ["active-model"],
    queryFn: async () => {
      const { data } = await supabase.from("model_artifacts").select("*").eq("is_active", true).maybeSingle();
      return data;
    },
  });

  const [selected, setSelected] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);
  const seedRef = useRef(false);

  useEffect(() => {
    setSelected(localStorage.getItem("sg-building"));
  }, []);

  useEffect(() => {
    const p = profileQ.data;
    if (!p || p.demo_seeded || seedRef.current || buildingsQ.isLoading) return;
    if ((buildingsQ.data?.length ?? 0) > 0) return;
    seedRef.current = true;
    setSeeding(true);
    seedDemo(user.id, p)
      .then(() => {
        toast.success("Demo building created with 14 days of simulated history");
        qc.invalidateQueries();
      })
      .catch((e) => toast.error(`Could not create demo data: ${e.message}`))
      .finally(() => setSeeding(false));
  }, [profileQ.data, buildingsQ.data, buildingsQ.isLoading, user.id, qc]);

  const buildings = buildingsQ.data ?? [];
  const building = buildings.find((b) => b.id === selected) ?? buildings[0] ?? null;
  const activeNet = useMemo(() => {
    try {
      return modelQ.data ? MLP.fromJSON(modelQ.data.weights as unknown as MLPJson) : null;
    } catch {
      return null;
    }
  }, [modelQ.data]);

  const value: AppCtx = {
    user,
    profile: profileQ.data ?? null,
    buildings,
    building,
    setBuildingId: (id) => {
      localStorage.setItem("sg-building", id);
      setSelected(id);
    },
    activeModel: modelQ.data ?? null,
    activeNet,
    seeding,
    loading: profileQ.isLoading || buildingsQ.isLoading,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useApp outside AppProvider");
  return c;
}
