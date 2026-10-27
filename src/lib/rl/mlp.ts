import { mulberry32 } from "../sim/random";

export interface MLPJson {
  sizes: number[];
  W: number[][];
  b: number[][];
}

/** Minimal fully-connected ReLU network with Adam, written from scratch. */
export class MLP {
  sizes: number[];
  W: Float32Array[] = [];
  b: Float32Array[] = [];
  private mW: Float32Array[] = [];
  private vW: Float32Array[] = [];
  private mb: Float32Array[] = [];
  private vb: Float32Array[] = [];
  private gW: Float32Array[] = [];
  private gb: Float32Array[] = [];
  private tAdam = 0;

  constructor(sizes: number[], seed = 1) {
    this.sizes = sizes;
    const rnd = mulberry32(seed);
    const gauss = () => {
      const u = Math.max(1e-9, rnd());
      return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rnd());
    };
    for (let l = 0; l < sizes.length - 1; l++) {
      const nIn = sizes[l];
      const nOut = sizes[l + 1];
      const w = new Float32Array(nIn * nOut);
      const std = Math.sqrt(2 / nIn) * (l === sizes.length - 2 ? 0.1 : 1);
      for (let i = 0; i < w.length; i++) w[i] = gauss() * std;
      this.W.push(w);
      this.b.push(new Float32Array(nOut));
    }
    this.allocOpt();
  }

  private allocOpt() {
    const z = (a: Float32Array[]) => a.map((x) => new Float32Array(x.length));
    this.mW = z(this.W);
    this.vW = z(this.W);
    this.mb = z(this.b);
    this.vb = z(this.b);
    this.gW = z(this.W);
    this.gb = z(this.b);
  }

  /** Returns activations per layer (index 0 = input). */
  forward(x: ArrayLike<number>): Float32Array[] {
    const acts: Float32Array[] = [Float32Array.from(x)];
    for (let l = 0; l < this.W.length; l++) {
      const nIn = this.sizes[l];
      const nOut = this.sizes[l + 1];
      const inp = acts[l];
      const out = new Float32Array(nOut);
      const w = this.W[l];
      const last = l === this.W.length - 1;
      for (let o = 0; o < nOut; o++) {
        let s = this.b[l][o];
        const off = o * nIn;
        for (let i = 0; i < nIn; i++) s += w[off + i] * inp[i];
        out[o] = last ? s : s > 0 ? s : 0;
      }
      acts.push(out);
    }
    return acts;
  }

  predict(x: ArrayLike<number>): Float32Array {
    const a = this.forward(x);
    return a[a.length - 1];
  }

  zeroGrad() {
    this.gW.forEach((g) => g.fill(0));
    this.gb.forEach((g) => g.fill(0));
  }

  /** Accumulate gradients given activations and dLoss/dOutput. */
  backward(acts: Float32Array[], dOut: Float32Array) {
    let delta = dOut;
    for (let l = this.W.length - 1; l >= 0; l--) {
      const nIn = this.sizes[l];
      const nOut = this.sizes[l + 1];
      const inp = acts[l];
      const w = this.W[l];
      const gw = this.gW[l];
      const gb = this.gb[l];
      const prev = new Float32Array(nIn);
      for (let o = 0; o < nOut; o++) {
        const d = delta[o];
        if (d === 0) continue;
        gb[o] += d;
        const off = o * nIn;
        for (let i = 0; i < nIn; i++) {
          gw[off + i] += d * inp[i];
          prev[i] += d * w[off + i];
        }
      }
      if (l > 0) for (let i = 0; i < nIn; i++) if (inp[i] <= 0) prev[i] = 0;
      delta = prev;
    }
  }

  adamStep(lr: number, batch: number, b1 = 0.9, b2 = 0.999, eps = 1e-8) {
    this.tAdam++;
    const c1 = 1 - Math.pow(b1, this.tAdam);
    const c2 = 1 - Math.pow(b2, this.tAdam);
    const upd = (p: Float32Array, g: Float32Array, m: Float32Array, v: Float32Array) => {
      for (let i = 0; i < p.length; i++) {
        const gi = g[i] / batch;
        m[i] = b1 * m[i] + (1 - b1) * gi;
        v[i] = b2 * v[i] + (1 - b2) * gi * gi;
        p[i] -= (lr * (m[i] / c1)) / (Math.sqrt(v[i] / c2) + eps);
      }
    };
    for (let l = 0; l < this.W.length; l++) {
      upd(this.W[l], this.gW[l], this.mW[l], this.vW[l]);
      upd(this.b[l], this.gb[l], this.mb[l], this.vb[l]);
    }
  }

  copyFrom(o: MLP) {
    for (let l = 0; l < this.W.length; l++) {
      this.W[l].set(o.W[l]);
      this.b[l].set(o.b[l]);
    }
  }

  toJSON(): MLPJson {
    return {
      sizes: this.sizes,
      W: this.W.map((w) => Array.from(w, (x) => Math.round(x * 1e5) / 1e5)),
      b: this.b.map((w) => Array.from(w, (x) => Math.round(x * 1e5) / 1e5)),
    };
  }

  static fromJSON(j: MLPJson): MLP {
    const m = new MLP(j.sizes, 1);
    j.W.forEach((w, l) => m.W[l].set(w));
    j.b.forEach((b, l) => m.b[l].set(b));
    return m;
  }
}
