/**
 * Générateur pseudo-aléatoire déterministe (mulberry32) initialisé par une graine 32 bits.
 * Même graine ⇒ même suite, sur toutes les plateformes (arithmétique entière uniquement).
 */

export interface Rng {
  /** Réel dans [0, 1). */
  next(): number;
  /** Entier dans [0, maxExclusive). */
  int(maxExclusive: number): number;
}

/** Mélange une graine (finaliseur de MurmurHash3) pour décorréler des graines voisines. */
export function hashSeed(seed: number): number {
  let h = seed >>> 0;
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

export function createRng(seed: number): Rng {
  let state = hashSeed(seed);
  const nextUint32 = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
  return {
    next: () => nextUint32() / 4294967296,
    int: (maxExclusive: number) => Math.floor((nextUint32() / 4294967296) * maxExclusive),
  };
}

/** Graine aléatoire non déterministe (pour les donnes « Aléatoires »). */
export function randomSeed(source: () => number = Math.random): number {
  return Math.floor(source() * 4294967296) >>> 0;
}
