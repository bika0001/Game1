import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  bankKey,
  difficultyOf,
  loadBank,
  pickDeal,
  type BankFile,
  type BankKey,
} from '../src/core/deals';
import { PlayedDeals } from '../src/core/playedDeals';
import { createRng } from '../src/core/rng';
import { isWon, setup } from '../src/core/games/klondike/rules';
import { replaySolution } from '../src/core/games/klondike/solutionCodec';
import { LIMITED_PASSES } from '../src/config/balance';

const DIR = join(import.meta.dirname, '../src/core/data/winnable_deals');

const BANKS: ReadonlyArray<{ key: BankKey; min: number }> = [
  { key: 'klondike-draw1', min: 10_000 },
  { key: 'klondike-draw3', min: 10_000 },
  { key: 'klondike-draw1-limited', min: 1_000 },
  { key: 'klondike-draw3-limited', min: 1_000 },
];

describe('banque de donnes gagnables', () => {
  for (const { key, min } of BANKS) {
    it(`${key} : chaque solution enregistrée rejouée gagne la partie`, async () => {
      const bank = await loadBank(key);
      const lines = readFileSync(join(DIR, `${key}.solutions.txt`), 'utf8')
        .trim()
        .split('\n');
      expect(bank.count).toBeGreaterThanOrEqual(min);
      expect(bank.seeds.length).toBe(bank.count);
      expect(lines.length).toBe(bank.count);
      const limited = key.endsWith('limited');
      expect(bank.maxPasses).toBe(
        limited ? (bank.drawCount === 1 ? LIMITED_PASSES.draw1 : LIMITED_PASSES.draw3) : null,
      );
      const options = { drawCount: bank.drawCount as 1 | 3, maxPasses: bank.maxPasses };
      let previous = 0;
      lines.forEach((line, i) => {
        const [seedText, code = ''] = line.split(' ');
        const seed = Number(seedText);
        expect(seed).toBe(bank.seeds[i]);
        expect(seed).toBeGreaterThan(previous);
        previous = seed;
        const state = setup(seed, options);
        const moves = replaySolution(state, code);
        if (!isWon(state)) throw new Error(`${key} : la graine ${seed} ne gagne pas.`);
        expect(moves.filter((m) => m.type === 'move').length).toBe(bank.moves[i]);
        const passes = 1 + moves.filter((m) => m.type === 'recycle').length;
        expect(passes).toBe(bank.passes[i]);
        if (bank.maxPasses !== null) expect(passes).toBeLessThanOrEqual(bank.maxPasses);
      });
    });
  }

  it('choisit la bonne banque selon les options', () => {
    expect(bankKey(1, false)).toBe('klondike-draw1');
    expect(bankKey(3, true)).toBe('klondike-draw3-limited');
  });

  it('met les banques en cache', async () => {
    expect(loadBank('klondike-draw1')).toBe(loadBank('klondike-draw1'));
    const bank = await loadBank('klondike-draw1');
    expect([1, 2, 3]).toContain(difficultyOf(bank, 0));
  });
});

describe('tirage des donnes', () => {
  const bank: BankFile = {
    version: 1,
    variant: 'klondike',
    drawCount: 1,
    maxPasses: null,
    count: 5,
    seeds: [11, 22, 33, 44, 55],
    moves: [100, 100, 100, 100, 100],
    nodes: [10, 5_000, 80_000, 10, 10],
    passes: [1, 1, 1, 1, 1],
  };

  it('ne redonne pas une donne déjà jouée avant d’avoir tout joué', () => {
    const played = new PlayedDeals(bank.count);
    const rng = createRng(1);
    const seen = new Set<number>();
    for (let i = 0; i < 5; i++) seen.add(pickDeal(bank, played, rng).seed);
    expect(seen.size).toBe(5);
    expect(played.count).toBe(5);
    const again = pickDeal(bank, played, rng); // la banque repart de zéro
    expect(bank.seeds).toContain(again.seed);
    expect(played.count).toBe(1);
  });

  it('estime la difficulté', () => {
    expect(difficultyOf(bank, 0)).toBe(1);
    expect(difficultyOf(bank, 1)).toBe(2);
    expect(difficultyOf(bank, 2)).toBe(3);
    expect(difficultyOf(bank, 99)).toBe(1);
  });

  it('refuse une banque vide', () => {
    expect(() => pickDeal({ ...bank, seeds: [] }, new PlayedDeals(0), createRng(1))).toThrow();
  });
});

describe('donnes jouées', () => {
  it('se sérialise et se relit', () => {
    const played = new PlayedDeals(20);
    played.add(0);
    played.add(19);
    played.add(19);
    played.add(-1);
    played.add(20);
    expect(played.count).toBe(2);
    expect(played.has(19)).toBe(true);
    expect(played.has(20)).toBe(false);
    const copy = new PlayedDeals(20, played.serialize());
    expect(copy.count).toBe(2);
    expect(copy.has(0) && copy.has(19) && !copy.has(5)).toBe(true);
    const smaller = new PlayedDeals(10, played.serialize());
    expect(smaller.count).toBe(1);
    const corrupt = new PlayedDeals(10, '%%%');
    expect(corrupt.count).toBe(0);
    played.clear();
    expect(played.count).toBe(0);
  });
});
