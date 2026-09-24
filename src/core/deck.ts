import { DECK_SIZE, type Card } from './cards';
import { createRng, type Rng } from './rng';

/** Paquet trié : As♠, As♥, As♣, As♦, 2♠… */
export function orderedDeck(): Card[] {
  return Array.from({ length: DECK_SIZE }, (_, i) => i);
}

/** Mélange de Fisher-Yates, en place. */
export function shuffleInPlace<T>(items: T[], rng: Rng): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = rng.int(i + 1);
    const tmp = items[i] as T;
    items[i] = items[j] as T;
    items[j] = tmp;
  }
  return items;
}

/** Paquet mélangé de façon déterministe à partir d'une graine. */
export function shuffledDeck(seed: number): Card[] {
  return shuffleInPlace(orderedDeck(), createRng(seed));
}
