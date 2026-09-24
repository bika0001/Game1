import { describe, expect, it } from 'vitest';
import { encodeSolution, replaySolution } from '../src/core/games/klondike/solutionCodec';
import { solve } from '../src/core/games/klondike/solver';
import { isWon, moveOf, setup, DRAW, RECYCLE } from '../src/core/games/klondike/rules';
import { buildState, suitRun } from './helpers';

describe('codec des solutions', () => {
  it('encode puis rejoue une solution complète', () => {
    for (const drawCount of [1, 3] as const) {
      const options = { drawCount, maxPasses: null };
      const result = solve(setup(4, options));
      expect(result.status).toBe('solved');
      const code = encodeSolution(result.moves);
      const state = setup(4, options);
      const replayed = replaySolution(state, code);
      expect(replayed).toEqual(result.moves);
      expect(isWon(state)).toBe(true);
    }
  });

  it('compresse les suites de taps sur la pioche', () => {
    expect(encodeSolution([DRAW])).toBe('S');
    expect(encodeSolution([DRAW, RECYCLE])).toBe('*2');
    expect(encodeSolution(Array.from({ length: 40 }, () => DRAW))).toBe('*z*5');
    const state = setup(9, { drawCount: 1, maxPasses: null });
    expect(replaySolution(state, '*z*5').length).toBe(40);
    expect(state.recycles).toBe(1);
  });

  it('encode chaque type de source et de destination', () => {
    expect(encodeSolution([moveOf('waste', 'f2'), moveOf('t3', 't6', 2), moveOf('f1', 't0')])).toBe(
      'WF36b0',
    );
  });

  it('déduit le nombre de cartes d’un déplacement entre colonnes et descend des fondations', () => {
    const s = buildState({
      tableau: [{ down: '2c', up: 'Kh Qs Jh' }, '', '4s'],
      foundations: [suitRun('h', 1, 3), '', '', ''],
    });
    const moves = replaySolution(s, '01a2');
    expect(moves).toEqual([moveOf('t0', 't1', 3), moveOf('f0', 't2', 1)]);
  });

  it('rejette les codes invalides', () => {
    const fresh = () => setup(5, { drawCount: 1, maxPasses: null });
    expect(() => replaySolution(fresh(), 'X0')).toThrow(/malformée/);
    expect(() => replaySolution(fresh(), 'W')).toThrow(/malformée/);
    expect(() => replaySolution(fresh(), '*!')).toThrow(/malformée/);
    expect(() => replaySolution(fresh(), '*')).toThrow(/malformée/);
    expect(() => replaySolution(fresh(), 'W9')).toThrow(/Destination/);
    expect(() => replaySolution(fresh(), 'WF')).toThrow(/fondation/);
    expect(() => replaySolution(fresh(), 'aF')).toThrow(/fondation/);
    const s = buildState({ tableau: ['9h', '9s'] });
    expect(() => replaySolution(s, '01')).toThrow(/illégal/);
  });
});
