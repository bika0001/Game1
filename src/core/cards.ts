/**
 * Cartes : représentation compacte et fonctions de base.
 *
 * Une carte est un entier 0..51 : `(rang - 1) * 4 + enseigne`.
 * L'ordre des enseignes ♠ ♥ ♣ ♦ place les rouges sur les indices impairs,
 * ce qui permet de tester la couleur avec `carte & 1`.
 */

export const SPADES = 0;
export const HEARTS = 1;
export const CLUBS = 2;
export const DIAMONDS = 3;

export type Suit = 0 | 1 | 2 | 3;
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13;
export type Card = number;

export const ACE: Rank = 1;
export const JACK: Rank = 11;
export const QUEEN: Rank = 12;
export const KING: Rank = 13;

export const SUITS: readonly Suit[] = [SPADES, HEARTS, CLUBS, DIAMONDS];
export const RANKS: readonly Rank[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13];
export const DECK_SIZE = 52;

export function makeCard(suit: Suit, rank: Rank): Card {
  return ((rank - 1) << 2) | suit;
}

export function suitOf(card: Card): Suit {
  return (card & 3) as Suit;
}

export function rankOf(card: Card): Rank {
  return ((card >> 2) + 1) as Rank;
}

export function isRed(card: Card): boolean {
  return (card & 1) === 1;
}

export function isRedSuit(suit: Suit): boolean {
  return (suit & 1) === 1;
}

/** Vrai si `upper` peut être posée sur `lower` au tableau (rang -1, couleur alternée). */
export function canStackAlternating(lower: Card, upper: Card): boolean {
  return rankOf(upper) === rankOf(lower) - 1 && ((lower ^ upper) & 1) === 1;
}

const RANK_LABELS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUIT_SYMBOLS = ['♠', '♥', '♣', '♦'];

/** Représentation lisible, pour le débogage et les tests (« 10♥ », « K♠ »). */
export function cardToString(card: Card): string {
  return `${RANK_LABELS[rankOf(card) - 1]}${SUIT_SYMBOLS[suitOf(card)]}`;
}

const SUIT_PARSE: Record<string, Suit> = {
  s: SPADES,
  h: HEARTS,
  c: CLUBS,
  d: DIAMONDS,
  '♠': SPADES,
  '♥': HEARTS,
  '♣': CLUBS,
  '♦': DIAMONDS,
};

const RANK_PARSE: Record<string, Rank> = {
  a: 1,
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  t: 10,
  '10': 10,
  j: 11,
  q: 12,
  k: 13,
};

/** Lit une carte écrite « As », « 10h », « Td », « K♣ »… */
export function parseCard(text: string): Card {
  const trimmed = text.trim().toLowerCase();
  const suit = SUIT_PARSE[trimmed.slice(-1)];
  const rank = RANK_PARSE[trimmed.slice(0, -1)];
  if (suit === undefined || rank === undefined) {
    throw new Error(`Carte illisible : « ${text} »`);
  }
  return makeCard(suit, rank);
}

/** Lit une liste de cartes séparées par des espaces. */
export function parseCards(text: string): Card[] {
  return text
    .split(/\s+/)
    .filter((part) => part.length > 0)
    .map(parseCard);
}
