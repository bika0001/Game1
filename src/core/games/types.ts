import type { Card } from '../cards';

/**
 * Interface commune à toutes les variantes de solitaire.
 *
 * Le rendu ne connaît que cette interface : il affiche des piles, transmet les
 * gestes du joueur (tap, glisser-déposer) et anime les cartes d'après la
 * différence entre deux instantanés. Ajouter une variante (Spider, FreeCell…)
 * revient à implémenter ce contrat et une mise en page, sans toucher au rendu.
 */

export type VariantId = 'klondike' | 'spider' | 'freecell' | 'pyramid' | 'tripeaks';

export type PileKind = 'stock' | 'waste' | 'foundation' | 'tableau' | 'cell';

export interface CardFace {
  readonly card: Card;
  readonly faceUp: boolean;
}

export interface PileSnapshot {
  /** Identifiant stable (« stock », « waste », « f0 », « t3 »…). */
  readonly id: string;
  readonly kind: PileKind;
  /** Rang de la pile parmi celles de même nature. */
  readonly index: number;
  /** Du bas vers le haut. */
  readonly cards: readonly CardFace[];
}

/** Description d'un coup pour l'affichage (indice, surbrillance). */
export interface MoveDescription {
  readonly from: string;
  /** Indice de la première carte déplacée dans la pile source. */
  readonly cardIndex: number;
  readonly count: number;
  readonly to: string;
}

export interface MoveRecord<M> {
  readonly move: M;
  /** Variation de score provoquée par le coup (annulée avec lui). */
  readonly scoreDelta: number;
}

export interface SolitaireVariant<S, M, O, R extends MoveRecord<M>> {
  readonly id: VariantId;

  /** Distribue une donne déterministe à partir d'une graine. */
  setup(seed: number, options: O): S;
  cloneState(state: S): S;

  legalMoves(state: S): M[];
  isLegal(state: S, move: M): boolean;
  /** Applique un coup légal (mute l'état) et renvoie de quoi l'annuler. */
  applyMove(state: S, move: M): R;
  undo(state: S, record: R): void;

  isWon(state: S): boolean;
  canAutoComplete(state: S): boolean;
  /** Suite de coups qui termine la partie quand `canAutoComplete` est vrai. */
  autoCompleteMoves(state: S): M[];
  /** Plus aucun coup ne peut faire progresser la partie. */
  isBlocked(state: S): boolean;
  /** Indice heuristique (le solveur, plus lent, tourne dans un Web Worker). */
  heuristicHint(state: S): M | null;
  score(state: S): number;

  // --- Rendu et gestes ---
  piles(state: S): PileSnapshot[];
  describeMove(state: S, move: M): MoveDescription;
  /** Meilleur coup quand le joueur tape une carte (ou la pioche). */
  tapMove(state: S, pileId: string, cardIndex: number): M | null;
  /** Le joueur peut-il saisir cette carte (et celles posées dessus) ? */
  canDrag(state: S, pileId: string, cardIndex: number): boolean;
  /** Piles sur lesquelles la saisie peut être lâchée légalement. */
  dropTargets(state: S, pileId: string, cardIndex: number): string[];
  /** Coup correspondant à un lâcher, ou null s'il est illégal. */
  dropMove(state: S, pileId: string, cardIndex: number, targetPileId: string): M | null;
}
