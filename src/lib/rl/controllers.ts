import type { Action, BuildingParams } from "../sim/building";
import { DISCRETE_ACTIONS, type EnvContext } from "./env";
import { MLP } from "./mlp";

export type Controller = (obs: number[], ctx: EnvContext, b: BuildingParams) => Action;

/** Fixed-rule baseline: 24°C during opening hours, lights 100% when open, no battery scheduling. */
export const baselineController: Controller = (_o, ctx) =>
  ctx.isOpen ? { setpoint: 24, lighting: 1, battery: 0 } : { setpoint: null, lighting: 0, battery: 0 };

/** Smart rule-based controller (rule-based, NOT RL). */
export const smartRuleController: Controller = (_o, ctx, b) => {
  const preOpen = !ctx.weekend && ctx.hour >= b.openHour - 1 && ctx.hour < b.openHour;
  const occupied = ctx.occ > 0.05;
  const setpoint = occupied ? Math.min(25, b.comfortMax - 0.5) : preOpen ? 25 : null;
  const lighting = occupied ? (ctx.occ < 0.5 ? 0.6 : 1) : 0;
  let battery = 0;
  if (ctx.price <= 5 && ctx.soc < 0.9) battery = 1;
  else if (ctx.price >= 12) battery = -1;
  return { setpoint, lighting, battery };
};

export function rlController(net: MLP): Controller {
  return (obs) => {
    const q = net.predict(obs);
    let best = 0;
    for (let i = 1; i < q.length; i++) if (q[i] > q[best]) best = i;
    return DISCRETE_ACTIONS[best];
  };
}

export const CONTROLLER_LABELS = {
  baseline: "Fixed-rule baseline",
  rule: "Smart rule-based (not RL)",
  rl: "Trained RL agent (DQN)",
} as const;
