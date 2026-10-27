/** Deterministic hashing RNG: same seed + keys always yields the same value in [0,1). */
export function hash01(seed: number, ...keys: number[]): number {
  let h = (seed ^ 0x9e3779b9) >>> 0;
  for (const k of keys) {
    h = Math.imul(h ^ (k | 0), 0x85ebca6b) >>> 0;
    h ^= h >>> 13;
    h = Math.imul(h, 0xc2b2ae35) >>> 0;
    h ^= h >>> 16;
  }
  return (h >>> 0) / 4294967296;
}

/** Small seeded PRNG (mulberry32) for agents / weight init. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
