import { describe, expect, it } from 'vitest';
import {
  canStackAlternating,
  cardToString,
  isRed,
  isRedSuit,
  makeCard,
  parseCard,
  parseCards,
  rankOf,
  suitOf,
  CLUBS,
  DIAMONDS,
  HEARTS,
  RANKS,
  SPADES,
  SUITS,
  RANK_LABELS,
} from '../src/core/cards';

describe('cartes', () => {
  it('encode et décode les 52 cartes de façon unique', () => {
    const seen = new Set<number>();
    for (const suit of SUITS) {
      for (const rank of RANKS) {
        const card = makeCard(suit, rank);
        expect(card).toBeGreaterThanOrEqual(0);
        expect(card).toBeLessThan(52);
        expect(suitOf(card)).toBe(suit);
        expect(rankOf(card)).toBe(rank);
        seen.add(card);
      }
    }
    expect(seen.size).toBe(52);
  });

  it('utilise les index anglo-saxons (A, J, Q, K) dans toutes les langues', () => {
    expect(RANK_LABELS).toHaveLength(13);
    expect(RANK_LABELS[0]).toBe('A');
    expect(RANK_LABELS.slice(-3)).toEqual(['J', 'Q', 'K']);
  });

  it('distingue les rouges des noires', () => {
    expect(isRed(makeCard(HEARTS, 5))).toBe(true);
    expect(isRed(makeCard(DIAMONDS, 12))).toBe(true);
    expect(isRed(makeCard(SPADES, 1))).toBe(false);
    expect(isRed(makeCard(CLUBS, 13))).toBe(false);
    expect(isRedSuit(HEARTS)).toBe(true);
    expect(isRedSuit(CLUBS)).toBe(false);
  });

  it('empile en ordre décroissant et en alternant les couleurs', () => {
    expect(canStackAlternating(parseCard('8s'), parseCard('7h'))).toBe(true);
    expect(canStackAlternating(parseCard('8s'), parseCard('7d'))).toBe(true);
    expect(canStackAlternating(parseCard('8s'), parseCard('7c'))).toBe(false);
    expect(canStackAlternating(parseCard('8s'), parseCard('6h'))).toBe(false);
    expect(canStackAlternating(parseCard('8h'), parseCard('9s'))).toBe(false);
  });

  it('lit et écrit les cartes', () => {
    expect(cardToString(parseCard('As'))).toBe('A♠');
    expect(cardToString(parseCard('10h'))).toBe('10♥');
    expect(cardToString(parseCard('Td'))).toBe('10♦');
    expect(cardToString(parseCard('K♣'))).toBe('K♣');
    expect(parseCards(' Qh  Jc ').map(cardToString)).toEqual(['Q♥', 'J♣']);
    expect(parseCards('')).toEqual([]);
    expect(() => parseCard('1x')).toThrow(/illisible/);
    expect(() => parseCard('Zs')).toThrow(/illisible/);
  });
});
