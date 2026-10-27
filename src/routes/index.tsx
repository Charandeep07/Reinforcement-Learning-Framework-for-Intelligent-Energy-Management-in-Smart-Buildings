import { createFileRoute, Link } from "@tanstack/react-router";
import { Activity, Bot, Scale, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SmartGrid RL — RL Energy Management for Smart Buildings" },
      { name: "description", content: "A simulated reinforcement learning framework that trains a DQN agent to cut building energy and cost while keeping occupants comfortable." },
      { property: "og:title", content: "SmartGrid RL — RL Energy Management for Smart Buildings" },
      { property: "og:description", content: "Train a DQN agent in your browser and compare it honestly against rule-based building control. All data simulated." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-hero text-sidebar-foreground">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2 font-display text-lg font-semibold text-sidebar-accent-foreground">
          <span className="grid size-9 place-items-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
            <Zap className="size-5" />
          </span>
          SmartGrid RL
        </div>
        <nav className="flex items-center gap-2">
          <Button asChild variant="heroOutline" size="sm">
            <Link to="/about">How it works</Link>
          </Button>
          <Button asChild variant="hero" size="sm">
            <Link to="/auth">Sign in</Link>
          </Button>
        </nav>
      </header>
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-16 md:pt-28">
        <span className="inline-block rounded-full border border-sidebar-border px-3 py-1 text-xs text-sidebar-foreground/80">
          B.Tech project · Batch 13 · Simulated data only
        </span>
        <h1 className="mt-6 max-w-4xl text-4xl font-bold leading-[1.05] text-sidebar-accent-foreground md:text-6xl">
          Reinforcement learning for intelligent energy management in smart buildings.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-sidebar-foreground/80">
          A physics-based building simulator, a Gym-style environment and a DQN agent trained right in your browser — benchmarked honestly against fixed and rule-based controllers.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild variant="hero" size="lg">
            <Link to="/auth">Open the dashboard</Link>
          </Button>
          <Button asChild variant="heroOutline" size="lg">
            <Link to="/about">Read the architecture</Link>
          </Button>
        </div>
        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            { i: Activity, t: "RC thermal simulator", d: "Weather, occupancy, tariffs, HVAC COP, lighting, battery and solar — seeded and deterministic." },
            { i: Bot, t: "Real DQN in a Web Worker", d: "MLP, replay buffer, target network and ε-greedy, with live reward, loss and ε charts." },
            { i: Scale, t: "Honest evaluation", d: "Identical scenarios for every controller. If RL loses, the table says so." },
          ].map((f) => (
            <div key={f.t} className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-5">
              <f.i className="size-5 text-sidebar-primary" />
              <div className="mt-3 font-display font-semibold text-sidebar-accent-foreground">{f.t}</div>
              <p className="mt-1 text-sm text-sidebar-foreground/75">{f.d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
