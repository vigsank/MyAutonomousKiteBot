/**
 * Seeded pseudo-random number generation utilities.
 *
 * Uses Mulberry32 for the uniform generator and the Box-Muller transform for
 * normal (Gaussian) samples. Seeding makes every stochastic process in the
 * engine reproducible for deterministic testing.
 */

export interface PRNG {
  /** Uniform float in [0, 1). */
  next(): number;
  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number;
  /** Uniform float in [min, max). */
  range(min: number, max: number): number;
  /** Standard normal sample (mean 0, std 1). */
  normal(): number;
  /** Normal sample with given mean and std. */
  normalDist(mean: number, std: number): number;
  /** Bernoulli trial with probability p. */
  chance(p: number): boolean;
}

/**
 * Create a seeded PRNG using the Mulberry32 algorithm.
 * @param seed Any 32-bit integer seed. Defaults to a random seed.
 */
export function createPRNG(seed?: number): PRNG {
  let state = (seed ?? (Math.random() * 0xffffffff) | 0) >>> 0;

  function next(): number {
    state = (state + 0x6d2b79f5) | 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // Box-Muller transform for normal distribution.
  let spare: number | null = null;
  function normal(): number {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    let s = 0;
    do {
      u = next() * 2 - 1;
      v = next() * 2 - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * mul;
    return u * mul;
  }

  return {
    next,
    int(min, max) {
      return Math.floor(next() * (max - min + 1)) + min;
    },
    range(min, max) {
      return next() * (max - min) + min;
    },
    normal,
    normalDist(mean, std) {
      return mean + normal() * std;
    },
    chance(p) {
      return next() < p;
    },
  };
}
