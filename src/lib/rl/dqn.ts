import { mulberry32 } from "../sim/random";
import { BuildingEnv, DISCRETE_ACTIONS, OBS_DIM, type EnvConfig } from "./env";
import { MLP } from "./mlp";

export interface DQNHyper {
  hidden: number;
  lr: number;
  gamma: number;
  batch: number;
  bufferSize: number;
  targetUpdate: number;
  epsStart: number;
  epsEnd: number;
  epsDecayEpisodes: number;
  seed: number;
}

export const DEFAULT_DQN: DQNHyper = {
  hidden: 64,
  lr: 1e-3,
  gamma: 0.97,
  batch: 32,
  bufferSize: 20000,
  targetUpdate: 250,
  epsStart: 1,
  epsEnd: 0.05,
  epsDecayEpisodes: 30,
  seed: 7,
};

/** Fixed-capacity replay buffer of transitions. */
export class ReplayBuffer {
  cap: number;
  s: Float32Array;
  s2: Float32Array;
  a: Int32Array;
  r: Float32Array;
  d: Uint8Array;
  size = 0;
  ptr = 0;
  constructor(cap: number, dim: number) {
    this.cap = cap;
    this.s = new Float32Array(cap * dim);
    this.s2 = new Float32Array(cap * dim);
    this.a = new Int32Array(cap);
    this.r = new Float32Array(cap);
    this.d = new Uint8Array(cap);
  }
  push(s: number[], a: number, r: number, s2: number[], done: boolean) {
    const dim = s.length;
    this.s.set(s, this.ptr * dim);
    this.s2.set(s2, this.ptr * dim);
    this.a[this.ptr] = a;
    this.r[this.ptr] = r;
    this.d[this.ptr] = done ? 1 : 0;
    this.ptr = (this.ptr + 1) % this.cap;
    this.size = Math.min(this.size + 1, this.cap);
  }
}

export class DQNAgent {
  h: DQNHyper;
  online: MLP;
  target: MLP;
  buf: ReplayBuffer;
  rnd: () => number;
  steps = 0;
  nA = DISCRETE_ACTIONS.length;

  constructor(h: DQNHyper = DEFAULT_DQN) {
    this.h = h;
    const sizes = [OBS_DIM, h.hidden, h.hidden, this.nA];
    this.online = new MLP(sizes, h.seed);
    this.target = new MLP(sizes, h.seed);
    this.target.copyFrom(this.online);
    this.buf = new ReplayBuffer(h.bufferSize, OBS_DIM);
    this.rnd = mulberry32(h.seed * 31 + 3);
  }

  epsilon(ep: number) {
    const f = Math.min(1, ep / Math.max(1, this.h.epsDecayEpisodes));
    return this.h.epsStart + (this.h.epsEnd - this.h.epsStart) * f;
  }

  act(obs: number[], eps: number): number {
    if (this.rnd() < eps) return Math.floor(this.rnd() * this.nA);
    return argmax(this.online.predict(obs));
  }

  /** One gradient step on a random minibatch (Double-DQN target, Huber loss). Returns loss. */
  train(): number {
    const { batch, gamma, lr } = this.h;
    if (this.buf.size < batch * 4) return NaN;
    const dim = OBS_DIM;
    this.online.zeroGrad();
    let loss = 0;
    for (let k = 0; k < batch; k++) {
      const i = Math.floor(this.rnd() * this.buf.size);
      const s = this.buf.s.subarray(i * dim, i * dim + dim);
      const s2 = this.buf.s2.subarray(i * dim, i * dim + dim);
      const a = this.buf.a[i];
      let y = this.buf.r[i];
      if (!this.buf.d[i]) {
        const a2 = argmax(this.online.predict(s2));
        y += gamma * this.target.predict(s2)[a2];
      }
      const acts = this.online.forward(s);
      const q = acts[acts.length - 1];
      const err = q[a] - y;
      const ae = Math.abs(err);
      loss += ae <= 1 ? 0.5 * err * err : ae - 0.5;
      const dOut = new Float32Array(this.nA);
      dOut[a] = Math.max(-1, Math.min(1, err));
      this.online.backward(acts, dOut);
    }
    this.online.adamStep(lr, batch);
    this.steps++;
    if (this.steps % this.h.targetUpdate === 0) this.target.copyFrom(this.online);
    return loss / batch;
  }
}

export function argmax(q: ArrayLike<number>) {
  let b = 0;
  for (let i = 1; i < q.length; i++) if (q[i] > q[b]) b = i;
  return b;
}

export interface EpisodeStats {
  episode: number;
  reward: number;
  loss: number;
  epsilon: number;
  energy: number;
  cost: number;
}

/** Run a single training episode. Episodes cycle through 4 different start weeks for generalisation. */
export function trainEpisode(agent: DQNAgent, cfg: EnvConfig, ep: number): EpisodeStats {
  const env = new BuildingEnv(cfg);
  let obs = env.reset(-((ep % 4) * 7 * 24));
  const eps = agent.epsilon(ep);
  let total = 0;
  let lossSum = 0;
  let lossN = 0;
  let energy = 0;
  let cost = 0;
  while (!env.done) {
    const a = agent.act(obs, eps);
    const { obs: o2, reward, done, info } = env.step(a);
    agent.buf.push(obs, a, reward, o2, done);
    const l = agent.train();
    if (!Number.isNaN(l)) {
      lossSum += l;
      lossN++;
    }
    total += reward;
    energy += info.result.energyKwh;
    cost += info.result.cost;
    obs = o2;
  }
  return { episode: ep + 1, reward: total, loss: lossN ? lossSum / lossN : 0, epsilon: eps, energy, cost };
}
