import { describe, expect, it } from 'vitest';
import { createRng, hashSeed, randomSeed } from '../src/core/rng';
import { orderedDeck, shuffleInPlace, shuffledDeck } from '../src/core/deck';
import { cardToString } from '../src/core/cards';

describe('générateur pseudo-aléatoire', () => {
  it('est déterministe pour une graine donnée', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) expect(a.next()).toBe(b.next());
  });

  it('produit des suites différentes pour des graines voisines', () => {
    const a = createRng(1);
    const b = createRng(2);
    const same = Array.from({ length: 20 }, () => a.next() === b.next()).filter(Boolean);
    expect(same.length).toBe(0);
    expect(hashSeed(1)).not.toBe(hashSeed(2));
  });

  it('reste dans les bornes', () => {
    const rng = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
      const n = rng.int(13);
      expect(Number.isInteger(n)).toBe(true);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(13);
    }
  });

  it('tire des graines 32 bits non signées', () => {
    expect(randomSeed(() => 0)).toBe(0);
    expect(randomSeed(() => 0.999999999)).toBeLessThanOrEqual(0xffffffff);
    const seed = randomSeed();
    expect(Number.isInteger(seed) && seed >= 0 && seed <= 0xffffffff).toBe(true);
  });
});

describe('paquet', () => {
  it('contient les 52 cartes dans l’ordre', () => {
    expect(orderedDeck()).toEqual(Array.from({ length: 52 }, (_, i) => i));
  });

  it('mélange de façon déterministe (une donne = une graine, pour toujours)', () => {
    const deck = shuffledDeck(1);
    expect([...deck].sort((a, b) => a - b)).toEqual(orderedDeck());
    expect(shuffledDeck(1)).toEqual(deck);
    expect(shuffledDeck(2)).not.toEqual(deck);
    // Empreinte figée : changer le mélange invaliderait toute la banque de donnes.
    expect(deck.slice(0, 8).map(cardToString).join(' ')).toMatchInlineSnapshot(
      `"5♦ 6♦ K♦ 5♣ J♥ 9♦ Q♣ 4♦"`,
    );
  });

  it('mélange un tableau quelconque en place', () => {
    const items = ['a', 'b', 'c', 'd'];
    const out = shuffleInPlace(items, createRng(3));
    expect(out).toBe(items);
    expect([...items].sort()).toEqual(['a', 'b', 'c', 'd']);
  });
});
