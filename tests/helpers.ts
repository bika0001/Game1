import { parseCards } from '../src/core/cards';
import type { KlondikeState, DrawCount } from '../src/core/games/klondike/rules';

export interface ColumnSpec {
  /** Cartes face cachée, du bas vers le haut. */
  readonly down?: string;
  /** Cartes visibles, du bas vers le haut. */
  readonly up?: string;
}

export interface StateSpec {
  readonly tableau?: ReadonlyArray<ColumnSpec | string>;
  /** Une chaîne par fondation, du bas (As) vers le haut. */
  readonly foundations?: readonly string[];
  /** Pioche, du bas vers le haut (le sommet est la prochaine carte tirée). */
  readonly stock?: string;
  /** Défausse, du bas vers le haut. */
  readonly waste?: string;
  readonly drawCount?: DrawCount;
  readonly maxPasses?: number | null;
  readonly recycles?: number;
  readonly score?: number;
}

/** Construit une position Klondike lisible pour les tests. */
export function buildState(spec: StateSpec): KlondikeState {
  const tableau = Array.from({ length: 7 }, (_, i) => {
    const col = spec.tableau?.[i] ?? {};
    const colSpec: ColumnSpec = typeof col === 'string' ? { up: col } : col;
    const down = parseCards(colSpec.down ?? '');
    const up = parseCards(colSpec.up ?? '');
    return { cards: [...down, ...up], faceDown: down.length };
  });
  const foundations = Array.from({ length: 4 }, (_, i) => parseCards(spec.foundations?.[i] ?? ''));
  return {
    options: { drawCount: spec.drawCount ?? 1, maxPasses: spec.maxPasses ?? null },
    tableau,
    foundations,
    stock: parseCards(spec.stock ?? ''),
    waste: parseCards(spec.waste ?? ''),
    recycles: spec.recycles ?? 0,
    score: spec.score ?? 0,
  };
}

/** Suite complète d'une enseigne, de l'As au rang donné (« As 2s … »). */
export function suitRun(suit: 's' | 'h' | 'c' | 'd', from: number, to: number): string {
  const labels = ['A', '2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K'];
  const out: string[] = [];
  for (let r = from; r <= to; r++) out.push(`${labels[r - 1]}${suit}`);
  return out.join(' ');
}
