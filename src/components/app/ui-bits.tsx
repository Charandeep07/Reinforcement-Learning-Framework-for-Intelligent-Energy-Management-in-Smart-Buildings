import type { ReactNode } from "react";
import { FlaskConical, Inbox, Loader2, TriangleAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function SimBadge({ className }: { className?: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border border-warning/50 bg-warning/15 px-2.5 py-0.5 text-xs font-medium text-warning-foreground dark:text-warning",
            className,
          )}
        >
          <FlaskConical className="size-3" /> Simulated data
        </span>
      </TooltipTrigger>
      <TooltipContent>All values come from a software simulator. No physical hardware is read or controlled.</TooltipContent>
    </Tooltip>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
          <SimBadge />
        </div>
        {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  sub,
  icon,
  tone = "default",
  hint,
}: {
  label: string;
  value: string;
  sub?: string;
  icon?: ReactNode;
  tone?: "default" | "good" | "warn" | "bad";
  hint?: string;
}) {
  const toneCls =
    tone === "good" ? "text-success" : tone === "warn" ? "text-warning" : tone === "bad" ? "text-destructive" : "text-foreground";
  const body = (
    <Card className="shadow-card">
      <CardContent className="p-4">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className={cn("mt-2 font-display text-2xl font-semibold tabular", toneCls)}>{value}</div>
        {sub && <div className="mt-1 text-xs text-muted-foreground">{sub}</div>}
      </CardContent>
    </Card>
  );
  if (!hint) return body;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div>{body}</div>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{hint}</TooltipContent>
    </Tooltip>
  );
}

export function ChartCard({ title, description, children, className, actions }: { title: string; description?: string; children: ReactNode; className?: string; actions?: ReactNode }) {
  return (
    <Card className={cn("shadow-card", className)}>
      <CardHeader className="flex flex-row items-start justify-between gap-2 pb-2">
        <div>
          <CardTitle className="text-base">{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </div>
        {actions}
      </CardHeader>
      <CardContent className="h-64 pb-4">{children}</CardContent>
    </Card>
  );
}

export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
      <Loader2 className="size-4 animate-spin" /> {label}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-12 text-center">
      <Inbox className="size-6 text-muted-foreground" />
      <div className="font-medium">{title}</div>
      {children && <div className="text-sm text-muted-foreground">{children}</div>}
    </div>
  );
}

export function ErrorState({ error }: { error: unknown }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      <TriangleAlert className="size-4" /> {(error as Error)?.message ?? "Something went wrong"}
    </div>
  );
}

export const CHART = {
  c1: "var(--chart-1)",
  c2: "var(--chart-2)",
  c3: "var(--chart-3)",
  c4: "var(--chart-4)",
  c5: "var(--chart-5)",
  grid: "var(--border)",
  axis: "var(--muted-foreground)",
};

export const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
};
