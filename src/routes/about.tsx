import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About & Architecture — SmartGrid RL" },
      { name: "description", content: "Architecture, state/action/reward definitions, implemented algorithms and limitations of the SmartGrid RL simulator." },
      { property: "og:title", content: "About & Architecture — SmartGrid RL" },
      { property: "og:description", content: "How the simulated building, Gym-style environment and DQN agent work — and what they cannot tell you." },
    ],
  }),
  component: About,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-6 shadow-card">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-muted-foreground [&_code]:font-mono [&_code]:text-foreground [&_li]:ml-5 [&_li]:list-disc">{children}</div>
    </section>
  );
}

function About() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-4xl space-y-5 px-4 py-10">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">About SmartGrid RL</h1>
          <Button asChild variant="outline" size="sm"><Link to="/dashboard">Open app</Link></Button>
        </div>
        <div className="rounded-xl border border-warning/50 bg-warning/15 p-4 text-sm font-medium">
          Every piece of equipment in this app is simulated in software. No physical hardware is read, connected or controlled, and all readings are labelled “Simulated data”.
        </div>
        <Section title="Architecture">
          <ul>
            <li><code>src/lib/sim</code> — pure TypeScript building simulator (no UI code): single-zone RC thermal model, HVAC with outdoor-temperature-dependent COP, dimmable lighting, occupancy-driven appliance load, battery (capacity, kW limit, 92% efficiency, SoC 10–95%) and solar PV.</li>
            <li>Seeded deterministic generators for weather (mild, hot, monsoon, cold), occupancy (office, retail, education) and price (time-of-use, flat, critical-peak). Same seed + timestamp → same value.</li>
            <li><code>src/lib/rl</code> — Gym-style environment, reward function, controllers, a from-scratch MLP with Adam, and a DQN agent. Training runs in a Web Worker so the UI stays responsive.</li>
            <li>Lovable Cloud stores buildings, equipment, readings, experiments, model weights, recommendations, alerts and what-if scenarios with row-level security per user.</li>
          </ul>
        </Section>
        <Section title="State (12 features, normalised)">
          <p>Indoor temp, outdoor temp, occupancy, sin/cos of hour, weekend flag, current price, next-hour price, last-step energy, battery SoC, current HVAC setpoint (−1 = off) and lighting level.</p>
        </Section>
        <Section title="Actions">
          <p>Discrete (DQN): 36 actions = HVAC setpoint ∈ {"{off, 22, 24, 26 °C}"} × lighting ∈ {"{0, 60, 100 %}"} × battery ∈ {"{discharge, idle, charge}"}.</p>
          <p>Continuous: <code>continuousToAction(u)</code> maps u ∈ [−1,1]³ to setpoint 21–27 °C (or off), lighting 0–1 and battery −1…+1.</p>
        </Section>
        <Section title="Reward">
          <p><code>r = −w_e·E − w_c·C − w_comfort·(dev² + visual) − w_eq·misuse + bonus</code></p>
          <ul>
            <li>E = grid kWh ÷ (0.05·area); C = cost ÷ (0.5·area); dev = °C outside the comfort band while occupied.</li>
            <li>visual = penalty for lighting below 50% while occupied; misuse = lights on or HVAC running in an empty building.</li>
            <li>bonus = +0.3 per hour comfortable while occupied, +0.1 when comfortable and efficient. Weights are configurable.</li>
          </ul>
        </Section>
        <Section title="Algorithms actually implemented">
          <ul>
            <li><b>DQN</b> — real: 12→64→64→36 ReLU MLP, Adam, Huber loss, Double-DQN target, replay buffer (20k), target network sync every 250 updates, linear ε-greedy decay.</li>
            <li><b>PPO, SAC</b> — <i>not implemented</i>. Shown as “Planned: requires Python backend (Stable-Baselines3)” and disabled. No curves are faked.</li>
            <li><b>Smart rule-based controller</b> — clearly labelled “rule-based, not RL”: pre-cooling, occupancy-based dimming, price-based battery scheduling.</li>
          </ul>
        </Section>
        <Section title="Limitations of the simulated environment">
          <ul>
            <li>Single thermal zone with first-order dynamics — no humidity, solar gains through windows, multiple zones or ventilation (CO₂) modelling.</li>
            <li>Weather, occupancy and prices are synthetic and seeded, not measured. Results do not transfer to a real building without calibration.</li>
            <li>The DQN is small and trained for minutes in a browser; it can underperform the rule-based controller, and the comparison page shows this when it happens.</li>
            <li>Equipment faults and anomalies are injected by the simulator, not detected from real sensors.</li>
          </ul>
        </Section>
      </div>
    </div>
  );
}
