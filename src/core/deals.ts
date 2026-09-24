import type { Rng } from './rng';
import type { PlayedDeals } from './playedDeals';

/**
 * Banques de donnes gagnables, générées par `npm run gen-deals` et vérifiées
 * par les tests (chaque solution enregistrée est rejouée).
 */

export type BankKey =
  'klondike-draw1' | 'klondike-draw3' | 'klondike-draw1-limited' | 'klondike-draw3-limited';

export interface BankFile {
  readonly version: number;
  readonly variant: string;
  readonly drawCount: number;
  readonly maxPasses: number | null;
  readonly count: number;
  readonly seeds: readonly number[];
  /** Déplacements de cartes de la solution trouvée (hors pioche). */
  readonly moves: readonly number[];
  /** Positions explorées par le solveur. */
  readonly nodes: readonly number[];
  readonly passes: readonly number[];
}

export function bankKey(drawCount: 1 | 3, limitedPasses: boolean): BankKey {
  return `klondike-draw${drawCount}${limitedPasses ? '-limited' : ''}`;
}

/** Chargement paresseux : chaque banque est un morceau séparé du bundle. */
const LOADERS: Record<BankKey, () => Promise<{ default: unknown }>> = {
  'klondike-draw1': () => import('./data/winnable_deals/klondike-draw1.json'),
  'klondike-draw3': () => import('./data/winnable_deals/klondike-draw3.json'),
  'klondike-draw1-limited': () => import('./data/winnable_deals/klondike-draw1-limited.json'),
  'klondike-draw3-limited': () => import('./data/winnable_deals/klondike-draw3-limited.json'),
};

const cache = new Map<BankKey, Promise<BankFile>>();

export function loadBank(key: BankKey): Promise<BankFile> {
  let pending = cache.get(key);
  if (!pending) {
    pending = LOADERS[key]().then((mod) => mod.default as BankFile);
    cache.set(key, pending);
  }
  return pending;
}

/** Difficulté indicative (1 facile … 3 difficile) d'après l'effort du solveur. */
export function difficultyOf(bank: BankFile, index: number): 1 | 2 | 3 {
  const nodes = bank.nodes[index] ?? 0;
  if (nodes < 2_000) return 1;
  if (nodes < 50_000) return 2;
  return 3;
}

export interface PickedDeal {
  readonly index: number;
  readonly seed: number;
}

/**
 * Tire une donne jamais jouée ; quand toutes l'ont été, la banque repart de zéro.
 * La donne tirée est aussitôt marquée comme jouée.
 */
export function pickDeal(bank: BankFile, played: PlayedDeals, rng: Rng): PickedDeal {
  const size = bank.seeds.length;
  if (size === 0) throw new Error('Banque de donnes vide.');
  if (played.count >= size) played.clear();
  // On prend la `target`-ième donne non jouée (il en reste toujours au moins target + 1).
  const target = rng.int(size - played.count);
  let index = -1;
  for (let seen = -1; seen < target;) {
    index++;
    if (!played.has(index)) seen++;
  }
  played.add(index);
  return { index, seed: bank.seeds[index] as number };
}
