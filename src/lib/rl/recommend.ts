import type { Action } from "../sim/building";
import { BuildingEnv, type EnvConfig } from "./env";
import { rlController, smartRuleController } from "./controllers";
import type { MLP } from "./mlp";
import { runEpisode } from "./evaluate";
import type { Controller } from "./controllers";

export function envAt(cfg: EnvConfig, t: number, tIn: number, soc: number, last?: Action) {
  const env = new BuildingEnv({ ...cfg, startT: t });
  env.reset();
  env.tIn = tIn;
  env.soc = soc;
  if (last) env.lastAction = last;
  return env;
}

/** Recommendation from the trained policy, or the rule-based fallback (clearly labelled). */
export function recommendAt(cfg: EnvConfig, t: number, tIn: number, soc: number, last: Action | undefined, net: MLP | null) {
  const env = envAt(cfg, t, tIn, soc, last);
  const ctrl = net ? rlController(net) : smartRuleController;
  return {
    action: ctrl(env.observe(), env.context(), cfg.building),
    source: net ? ("rl" as const) : ("rule" as const),
  };
}

/** Projects the next `hours` of operation from a state with a fixed or controller-driven policy. */
export function project(cfg: EnvConfig, t: number, tIn: number, soc: number, hours: number, policy: Controller | Action) {
  const ctrl: Controller = typeof policy === "function" ? policy : () => policy;
  return runEpisode({ ...cfg, startT: t, hours, tIn0: tIn, soc0: soc }, ctrl, "projection").metrics;
}
