import { KING, ACE, canStackAlternating, rankOf, suitOf, DECK_SIZE, type Card } from '../../cards';
import { shuffledDeck } from '../../deck';
import { LIMITED_PASSES } from '../../../config/balance';
import { scoreForMove, applyScoreDelta } from './scoring';

/**
 * Règles du Klondike : état, coups légaux, application et annulation.
 * L'état est muté en place ; chaque coup renvoie un enregistrement d'annulation.
 */

export const TABLEAU_COUNT = 7;
export const FOUNDATION_COUNT = 4;

export type DrawCount = 1 | 3;

export interface KlondikeOptions {
  readonly drawCount: DrawCount;
  /** Nombre maximal de passages dans la pioche ; `null` = illimité. */
  readonly maxPasses: number | null;
}

export interface TableauColumn {
  cards: Card[];
  /** Nombre de cartes face cachée, toujours en bas de la colonne. */
  faceDown: number;
}

export interface KlondikeState {
  options: KlondikeOptions;
  tableau: TableauColumn[];
  foundations: Card[][];
  /** Pioche (talon) : le sommet est le dernier élément. */
  stock: Card[];
  /** Défausse : le sommet est le dernier élément. */
  waste: Card[];
  /** Nombre de fois où la défausse a été retournée dans la pioche. */
  recycles: number;
  score: number;
}

export type TableauId = `t${number}`;
export type FoundationId = `f${number}`;
export type KlondikePileId = 'stock' | 'waste' | TableauId | FoundationId;

export type KlondikeMove =
  | { readonly type: 'draw' }
  | { readonly type: 'recycle' }
  | {
      readonly type: 'move';
      readonly from: KlondikePileId;
      readonly to: KlondikePileId;
      readonly count: number;
    };

export interface KlondikeRecord {
  readonly move: KlondikeMove;
  readonly scoreDelta: number;
  /** Une carte cachée a été retournée dans la colonne source. */
  readonly flipped: boolean;
  /** Nombre de cartes piochées (coup « draw »). */
  readonly drawn: number;
}

export const DRAW: KlondikeMove = { type: 'draw' };
export const RECYCLE: KlondikeMove = { type: 'recycle' };

export function tableauId(index: number): TableauId {
  return `t${index}`;
}

export function foundationId(index: number): FoundationId {
  return `f${index}`;
}

export function moveOf(from: KlondikePileId, to: KlondikePileId, count = 1): KlondikeMove {
  return { type: 'move', from, to, count };
}

export type ParsedPile =
  | { readonly kind: 'stock'; readonly index: 0 }
  | { readonly kind: 'waste'; readonly index: 0 }
  | { readonly kind: 'tableau'; readonly index: number }
  | { readonly kind: 'foundation'; readonly index: number };

const STOCK_REF: ParsedPile = { kind: 'stock', index: 0 };
const WASTE_REF: ParsedPile = { kind: 'waste', index: 0 };
const TABLEAU_REFS: readonly ParsedPile[] = Array.from({ length: TABLEAU_COUNT }, (_, index) => ({
  kind: 'tableau',
  index,
}));
const FOUNDATION_REFS: readonly ParsedPile[] = Array.from(
  { length: FOUNDATION_COUNT },
  (_, index) => ({ kind: 'foundation', index }),
);

/** Décode un identifiant de pile (« stock », « waste », « t0 »…« t6 », « f0 »…« f3 »). */
export function parsePileId(id: string): ParsedPile | null {
  if (id === 'stock') return STOCK_REF;
  if (id === 'waste') return WASTE_REF;
  if (id.length !== 2) return null;
  const digit = id.charCodeAt(1) - 48;
  if (id[0] === 't') return TABLEAU_REFS[digit] ?? null;
  if (id[0] === 'f') return FOUNDATION_REFS[digit] ?? null;
  return null;
}

export function defaultMaxPasses(drawCount: DrawCount, limited: boolean): number | null {
  if (!limited) return null;
  return drawCount === 1 ? LIMITED_PASSES.draw1 : LIMITED_PASSES.draw3;
}

// ---------------------------------------------------------------------------
// Mise en place
// ---------------------------------------------------------------------------

/** Distribue une donne à partir d'un paquet déjà ordonné (utile aux tests). */
export function dealFromDeck(deck: readonly Card[], options: KlondikeOptions): KlondikeState {
  if (deck.length !== DECK_SIZE) throw new Error('Un paquet complet de 52 cartes est requis.');
  const tableau: TableauColumn[] = Array.from({ length: TABLEAU_COUNT }, (_, i) => ({
    cards: [],
    faceDown: i,
  }));
  let k = 0;
  for (let row = 0; row < TABLEAU_COUNT; row++) {
    for (let col = row; col < TABLEAU_COUNT; col++) {
      (tableau[col] as TableauColumn).cards.push(deck[k++] as Card);
    }
  }
  return {
    options: { ...options },
    tableau,
    foundations: Array.from({ length: FOUNDATION_COUNT }, () => []),
    stock: deck.slice(k),
    waste: [],
    recycles: 0,
    score: 0,
  };
}

export function setup(seed: number, options: KlondikeOptions): KlondikeState {
  return dealFromDeck(shuffledDeck(seed), options);
}

export function cloneState(state: KlondikeState): KlondikeState {
  return {
    options: { ...state.options },
    tableau: state.tableau.map((c) => ({ cards: [...c.cards], faceDown: c.faceDown })),
    foundations: state.foundations.map((f) => [...f]),
    stock: [...state.stock],
    waste: [...state.waste],
    recycles: state.recycles,
    score: state.score,
  };
}

// ---------------------------------------------------------------------------
// Requêtes
// ---------------------------------------------------------------------------

export function column(state: KlondikeState, index: number): TableauColumn {
  const col = state.tableau[index];
  if (!col) throw new Error(`Colonne inexistante : ${index}`);
  return col;
}

export function foundation(state: KlondikeState, index: number): Card[] {
  const pile = state.foundations[index];
  if (!pile) throw new Error(`Fondation inexistante : ${index}`);
  return pile;
}

export function topOf(cards: readonly Card[]): Card | undefined {
  return cards[cards.length - 1];
}

export function faceUpCount(col: TableauColumn): number {
  return col.cards.length - col.faceDown;
}

export function foundationCount(state: KlondikeState): number {
  let total = 0;
  for (const pile of state.foundations) total += pile.length;
  return total;
}

export function faceDownTotal(state: KlondikeState): number {
  let total = 0;
  for (const col of state.tableau) total += col.faceDown;
  return total;
}

export function maxRecycles(options: KlondikeOptions): number {
  return options.maxPasses === null ? Infinity : Math.max(0, options.maxPasses - 1);
}

export function canDraw(state: KlondikeState): boolean {
  return state.stock.length > 0;
}

export function canRecycle(state: KlondikeState): boolean {
  return (
    state.stock.length === 0 &&
    state.waste.length > 0 &&
    state.recycles < maxRecycles(state.options)
  );
}

export function foundationAccepts(pile: readonly Card[], card: Card): boolean {
  const top = topOf(pile);
  if (top === undefined) return rankOf(card) === ACE;
  return suitOf(top) === suitOf(card) && rankOf(card) === rankOf(top) + 1;
}

export function tableauAccepts(col: TableauColumn, card: Card): boolean {
  const top = topOf(col.cards);
  if (top === undefined) return rankOf(card) === KING;
  return col.faceDown < col.cards.length && canStackAlternating(top, card);
}

/** Fondation où la carte peut monter (celle de sa couleur, sinon la première vide pour un As). */
export function foundationFor(state: KlondikeState, card: Card): number {
  for (let i = 0; i < FOUNDATION_COUNT; i++) {
    const pile = foundation(state, i);
    if (pile.length > 0 && foundationAccepts(pile, card)) return i;
  }
  if (rankOf(card) === ACE) {
    for (let i = 0; i < FOUNDATION_COUNT; i++) {
      if (foundation(state, i).length === 0) return i;
    }
  }
  return -1;
}

/** Fondation qui contient (ou contiendra) une enseigne donnée, sinon -1. */
export function foundationOfSuit(state: KlondikeState, suit: number): number {
  for (let i = 0; i < FOUNDATION_COUNT; i++) {
    const bottom = foundation(state, i)[0];
    if (bottom !== undefined && suitOf(bottom) === suit) return i;
  }
  return -1;
}

/** Cartes d'une pile, du bas vers le haut. */
export function pileCards(state: KlondikeState, id: KlondikePileId): readonly Card[] {
  const parsed = parsePileId(id);
  if (!parsed) throw new Error(`Pile inconnue : ${id}`);
  switch (parsed.kind) {
    case 'stock':
      return state.stock;
    case 'waste':
      return state.waste;
    case 'tableau':
      return column(state, parsed.index).cards;
    case 'foundation':
      return foundation(state, parsed.index);
  }
}

/** Nombre maximal de cartes qu'on peut prendre sur le dessus d'une pile. */
export function movableCount(state: KlondikeState, id: KlondikePileId): number {
  const parsed = parsePileId(id);
  if (!parsed) return 0;
  switch (parsed.kind) {
    case 'stock':
      return 0;
    case 'waste':
      return state.waste.length > 0 ? 1 : 0;
    case 'foundation':
      return foundation(state, parsed.index).length > 0 ? 1 : 0;
    case 'tableau':
      return faceUpCount(column(state, parsed.index));
  }
}

export function isWon(state: KlondikeState): boolean {
  return foundationCount(state) === DECK_SIZE;
}

// ---------------------------------------------------------------------------
// Légalité
// ---------------------------------------------------------------------------

export function isLegal(state: KlondikeState, move: KlondikeMove): boolean {
  if (move.type === 'draw') return canDraw(state);
  if (move.type === 'recycle') return canRecycle(state);

  const { from, to, count } = move;
  if (from === to || !Number.isInteger(count) || count < 1) return false;
  const src = parsePileId(from);
  const dst = parsePileId(to);
  if (!src || !dst) return false;
  if (src.kind === 'stock' || dst.kind === 'stock' || dst.kind === 'waste') return false;
  if (src.kind === 'foundation' && dst.kind === 'foundation') return false;
  if (count > movableCount(state, from)) return false;

  const cards = pileCards(state, from);
  const base = cards[cards.length - count] as Card;
  if (dst.kind === 'foundation') {
    return count === 1 && foundationAccepts(foundation(state, dst.index), base);
  }
  return tableauAccepts(column(state, dst.index), base);
}

// ---------------------------------------------------------------------------
// Application et annulation
// ---------------------------------------------------------------------------

function takeFrom(state: KlondikeState, id: KlondikePileId, count: number): Card[] {
  const parsed = parsePileId(id) as ParsedPile;
  const cards =
    parsed.kind === 'waste'
      ? state.waste
      : parsed.kind === 'foundation'
        ? foundation(state, parsed.index)
        : column(state, parsed.index).cards;
  return cards.splice(cards.length - count, count);
}

function putOn(state: KlondikeState, id: KlondikePileId, moved: readonly Card[]): void {
  const parsed = parsePileId(id) as ParsedPile;
  const cards =
    parsed.kind === 'waste'
      ? state.waste
      : parsed.kind === 'foundation'
        ? foundation(state, parsed.index)
        : column(state, parsed.index).cards;
  cards.push(...moved);
}

/** Applique un coup légal. Lève une erreur si le coup est illégal. */
export function applyMove(state: KlondikeState, move: KlondikeMove): KlondikeRecord {
  if (!isLegal(state, move)) {
    throw new Error(`Coup illégal : ${JSON.stringify(move)}`);
  }

  if (move.type === 'draw') {
    const drawn = Math.min(state.options.drawCount, state.stock.length);
    for (let i = 0; i < drawn; i++) state.waste.push(state.stock.pop() as Card);
    return { move, scoreDelta: 0, flipped: false, drawn };
  }

  if (move.type === 'recycle') {
    state.stock = state.waste.reverse();
    state.waste = [];
    state.recycles += 1;
    const scoreDelta = applyScoreDelta(state, scoreForMove(move, false));
    return { move, scoreDelta, flipped: false, drawn: 0 };
  }

  const moved = takeFrom(state, move.from, move.count);
  putOn(state, move.to, moved);

  let flipped = false;
  const src = parsePileId(move.from) as ParsedPile;
  if (src.kind === 'tableau') {
    const col = column(state, src.index);
    if (col.cards.length > 0 && col.faceDown >= col.cards.length) {
      col.faceDown = col.cards.length - 1;
      flipped = true;
    }
  }

  const scoreDelta = applyScoreDelta(state, scoreForMove(move, flipped));
  return { move, scoreDelta, flipped, drawn: 0 };
}

export function undo(state: KlondikeState, record: KlondikeRecord): void {
  const { move } = record;
  state.score -= record.scoreDelta;

  if (move.type === 'draw') {
    for (let i = 0; i < record.drawn; i++) state.stock.push(state.waste.pop() as Card);
    return;
  }

  if (move.type === 'recycle') {
    state.waste = state.stock.reverse();
    state.stock = [];
    state.recycles -= 1;
    return;
  }

  if (record.flipped) {
    const src = parsePileId(move.from) as ParsedPile;
    column(state, src.index).faceDown += 1;
  }
  const moved = takeFrom(state, move.to, move.count);
  putOn(state, move.from, moved);
}

// ---------------------------------------------------------------------------
// Énumération des coups
// ---------------------------------------------------------------------------

/** Toutes les piles d'où l'on peut prendre des cartes, avec le nombre maximal. */
function sources(state: KlondikeState): Array<[KlondikePileId, number]> {
  const out: Array<[KlondikePileId, number]> = [];
  if (state.waste.length > 0) out.push(['waste', 1]);
  for (let i = 0; i < TABLEAU_COUNT; i++) {
    const n = faceUpCount(column(state, i));
    if (n > 0) out.push([tableauId(i), n]);
  }
  for (let i = 0; i < FOUNDATION_COUNT; i++) {
    if (foundation(state, i).length > 0) out.push([foundationId(i), 1]);
  }
  return out;
}

/** Destinations possibles pour `count` cartes prises sur `from`. */
export function destinationsFor(
  state: KlondikeState,
  from: KlondikePileId,
  count: number,
): KlondikePileId[] {
  const out: KlondikePileId[] = [];
  for (let i = 0; i < FOUNDATION_COUNT; i++) {
    const to = foundationId(i);
    if (isLegal(state, moveOf(from, to, count))) out.push(to);
  }
  for (let i = 0; i < TABLEAU_COUNT; i++) {
    const to = tableauId(i);
    if (isLegal(state, moveOf(from, to, count))) out.push(to);
  }
  return out;
}

export function legalMoves(state: KlondikeState): KlondikeMove[] {
  const moves: KlondikeMove[] = [];
  if (canDraw(state)) moves.push(DRAW);
  if (canRecycle(state)) moves.push(RECYCLE);
  for (const [from, max] of sources(state)) {
    for (let count = 1; count <= max; count++) {
      for (const to of destinationsFor(state, from, count)) moves.push(moveOf(from, to, count));
    }
  }
  return moves;
}
