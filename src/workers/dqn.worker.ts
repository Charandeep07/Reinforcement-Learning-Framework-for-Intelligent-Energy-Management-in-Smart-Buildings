import { DQNAgent, DEFAULT_DQN, trainEpisode, type DQNHyper } from "../lib/rl/dqn";
import type { EnvConfig } from "../lib/rl/env";

let agent: DQNAgent | null = null;
let cfg: EnvConfig | null = null;
let total = 0;
let ep = 0;
let paused = false;
let stopped = false;
let t0 = 0;

function loop() {
  if (!agent || !cfg) return;
  if (stopped || ep >= total) {
    self.postMessage({ type: "done", weights: agent.online.toJSON(), seconds: (performance.now() - t0) / 1000, episodes: ep, stopped });
    agent = null;
    return;
  }
  if (paused) return;
  const s = trainEpisode(agent, cfg, ep);
  ep++;
  self.postMessage({ type: "episode", stats: s });
  setTimeout(loop, 0);
}

self.onmessage = (e: MessageEvent) => {
  const m = e.data;
  if (m.type === "start") {
    cfg = m.config as EnvConfig;
    agent = new DQNAgent({ ...DEFAULT_DQN, ...(m.hyper as Partial<DQNHyper>) });
    total = m.episodes;
    ep = 0;
    paused = false;
    stopped = false;
    t0 = performance.now();
    loop();
  } else if (m.type === "pause") paused = true;
  else if (m.type === "resume") {
    if (paused) {
      paused = false;
      loop();
    }
  } else if (m.type === "stop") {
    stopped = true;
    if (paused) {
      paused = false;
      loop();
    }
  }
};
