import type { MoveDescription, PileSnapshot, SolitaireVariant } from '../types';
import { bestMoveForTap } from '../../autoMove';
import { autoCompleteMoves, canAutoComplete, heuristicHint, isBlocked } from './analysis';
import {
  applyMove,
  cloneState,
  destinationsFor,
  foundationId,
  isLegal,
  isWon,
  legalMoves,
  moveOf,
  parsePileId,
  pileCards,
  setup,
  tableauId,
  undo,
  FOUNDATION_COUNT,
  TABLEAU_COUNT,
  type KlondikeMove,
  type KlondikeOptions,
  type KlondikePileId,
  type KlondikeRecord,
  type KlondikeState,
} from './rules';

export * from './rules';
export {
  autoCompleteMoves,
  canAutoComplete,
  heuristicHint,
  isBlocked,
  searchProgress,
} from './analysis';
export { timeBonus } from './scoring';

function piles(state: KlondikeState): PileSnapshot[] {
  const out: PileSnapshot[] = [
    {
      id: 'stock',
      kind: 'stock',
      index: 0,
      cards: state.stock.map((card) => ({ card, faceUp: false })),
    },
    {
      id: 'waste',
      kind: 'waste',
      index: 0,
      cards: state.waste.map((card) => ({ card, faceUp: true })),
    },
  ];
  for (let i = 0; i < FOUNDATION_COUNT; i++) {
    out.push({
      id: foundationId(i),
      kind: 'foundation',
      index: i,
      cards: (state.foundations[i] ?? []).map((card) => ({ card, faceUp: true })),
    });
  }
  for (let i = 0; i < TABLEAU_COUNT; i++) {
    const col = state.tableau[i];
    out.push({
      id: tableauId(i),
      kind: 'tableau',
      index: i,
      cards: (col?.cards ?? []).map((card, k) => ({ card, faceUp: k >= (col?.faceDown ?? 0) })),
    });
  }
  return out;
}

function describeMove(state: KlondikeState, move: KlondikeMove): MoveDescription {
  if (move.type === 'draw') {
    const count = Math.min(state.options.drawCount, state.stock.length);
    return { from: 'stock', cardIndex: state.stock.length - count, count, to: 'waste' };
  }
  if (move.type === 'recycle') {
    return { from: 'waste', cardIndex: 0, count: state.waste.length, to: 'stock' };
  }
  const length = pileCards(state, move.from).length;
  return { from: move.from, cardIndex: length - move.count, count: move.count, to: move.to };
}

function canDrag(state: KlondikeState, pileId: string, cardIndex: number): boolean {
  const parsed = parsePileId(pileId);
  if (!parsed || parsed.kind === 'stock') return false;
  const cards = pileCards(state, pileId as KlondikePileId);
  if (cardIndex < 0 || cardIndex >= cards.length) return false;
  if (parsed.kind === 'tableau') {
    return cardIndex >= (state.tableau[parsed.index]?.faceDown ?? 0);
  }
  return cardIndex === cards.length - 1;
}

function dropTargets(state: KlondikeState, pileId: string, cardIndex: number): string[] {
  if (!canDrag(state, pileId, cardIndex)) return [];
  const from = pileId as KlondikePileId;
  return destinationsFor(state, from, pileCards(state, from).length - cardIndex);
}

function dropMove(
  state: KlondikeState,
  pileId: string,
  cardIndex: number,
  targetPileId: string,
): KlondikeMove | null {
  if (!canDrag(state, pileId, cardIndex) || !parsePileId(targetPileId)) return null;
  const from = pileId as KlondikePileId;
  const move = moveOf(
    from,
    targetPileId as KlondikePileId,
    pileCards(state, from).length - cardIndex,
  );
  return isLegal(state, move) ? move : null;
}

export const klondike: SolitaireVariant<
  KlondikeState,
  KlondikeMove,
  KlondikeOptions,
  KlondikeRecord
> = {
  id: 'klondike',
  setup,
  cloneState,
  legalMoves,
  isLegal,
  applyMove,
  undo,
  isWon,
  canAutoComplete,
  autoCompleteMoves,
  isBlocked: (state) => isBlocked(state),
  heuristicHint: (state) => heuristicHint(state),
  score: (state) => state.score,
  piles,
  describeMove,
  tapMove: bestMoveForTap,
  canDrag,
  dropTargets,
  dropMove,
};
