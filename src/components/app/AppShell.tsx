import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Bell,
  Bot,
  Building2,
  Cpu,
  FileText,
  FlaskConical,
  Gauge,
  Info,
  LogOut,
  Menu,
  Moon,
  Scale,
  Settings,
  Sparkles,
  Sun,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useApp } from "@/hooks/use-app";
import { useLiveSim } from "@/hooks/use-live-sim";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: Gauge },
  { to: "/buildings", label: "Buildings", icon: Building2 },
  { to: "/equipment", label: "Equipment", icon: Cpu },
  { to: "/monitoring", label: "Live Monitoring", icon: Activity },
  { to: "/rl", label: "RL Control Center", icon: Bot },
  { to: "/optimization", label: "Optimization", icon: Sparkles },
  { to: "/compare", label: "Baseline vs RL", icon: Scale },
  { to: "/alerts", label: "Alerts", icon: Bell },
  { to: "/whatif", label: "What-If", icon: FlaskConical },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/about", label: "About", icon: Info },
] as const;

function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const live = useLiveSim();
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <Link to="/dashboard" className="flex items-center gap-2 px-5 py-5" onClick={onNavigate}>
        <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <Zap className="size-5" />
        </span>
        <span>
          <span className="block font-display text-lg font-semibold leading-none text-sidebar-accent-foreground">SmartGrid RL</span>
          <span className="text-[11px] text-sidebar-foreground/70">Batch 13 · B.Tech project</span>
        </span>
      </Link>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">
        {NAV.map((n) => (
          <Link
            key={n.to}
            to={n.to}
            onClick={onNavigate}
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground font-medium" }}
          >
            <n.icon className="size-4" />
            {n.label}
            {n.to === "/monitoring" && live.running && <span className="ml-auto size-2 animate-pulse rounded-full bg-sidebar-primary" />}
          </Link>
        ))}
      </nav>
      <div className="m-3 rounded-lg border border-sidebar-border p-3 text-[11px] leading-snug text-sidebar-foreground/70">
        All equipment is simulated. No physical hardware is controlled.
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { buildings, building, setBuildingId, user, seeding } = useApp();
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const signOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  return (
    <div className={cn("min-h-screen bg-background", dark && "dark")}>
      <aside className="fixed inset-y-0 left-0 hidden w-64 lg:block">
        <SideNav />
      </aside>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 border-none p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SideNav onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>
      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b bg-background/85 px-4 py-3 backdrop-blur md:px-8">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu />
          </Button>
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Building2 className="size-4 shrink-0 text-muted-foreground" />
            {buildings.length > 0 ? (
              <Select value={building?.id} onValueChange={setBuildingId}>
                <SelectTrigger className="h-9 w-full max-w-xs">
                  <SelectValue placeholder="Select building" />
                </SelectTrigger>
                <SelectContent>
                  {buildings.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span className="text-sm text-muted-foreground">{seeding ? "Creating demo building…" : "No buildings yet"}</span>
            )}
          </div>
          <span className="hidden text-xs text-muted-foreground md:inline">{user.email}</span>
          <Button variant="ghost" size="icon" onClick={() => setDark((d) => !d)} aria-label="Toggle dark workspace">
            {dark ? <Sun /> : <Moon />}
          </Button>
          <Button variant="outline" size="sm" onClick={signOut}>
            <LogOut /> <span className="hidden sm:inline">Sign out</span>
          </Button>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-6 text-foreground md:px-8">{children}</main>
      </div>
    </div>
  );
}

export { BarChart3 };
