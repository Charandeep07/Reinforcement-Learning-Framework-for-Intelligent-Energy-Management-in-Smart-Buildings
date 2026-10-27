import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppProvider, useApp } from "@/hooks/use-app";
import { LiveSimProvider } from "@/hooks/use-live-sim";
import { AppShell } from "@/components/app/AppShell";
import { Loading } from "@/components/app/ui-bits";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: Layout,
});

function Inner() {
  const { loading, seeding, buildings } = useApp();
  if (loading || (seeding && buildings.length === 0)) return <Loading label={seeding ? "Generating your demo building and 14 days of simulated history…" : "Loading…"} />;
  return <Outlet />;
}

function Layout() {
  const { user } = Route.useRouteContext();
  return (
    <AppProvider user={user}>
      <LiveSimProvider>
        <AppShell>
          <Inner />
        </AppShell>
      </LiveSimProvider>
    </AppProvider>
  );
}
