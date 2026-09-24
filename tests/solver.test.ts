import { describe, expect, it } from 'vitest';
import { solve, countPasses, DEFAULT_RESTARTS } from '../src/core/games/klondike/solver';
import {
  applyMove,
  cloneState,
  isWon,
  setup,
  DRAW,
  RECYCLE,
  type KlondikeMove,
  type KlondikeState,
} from '../src/core/games/klondike/rules';
import { buildState, suitRun } from './helpers';

function replayWins(state: KlondikeState, moves: readonly KlondikeMove[]): boolean {
  const s = cloneState(state);
  for (const m of moves) applyMove(s, m);
  return isWon(s);
}

describe('solveur Klondike', () => {
  it('résout des donnes en pioche 1 et en pioche 3', () => {
    for (const drawCount of [1, 3] as const) {
      const state = setup(1, { drawCount, maxPasses: null });
      const result = solve(state);
      expect(result.status).toBe('solved');
      expect(result.nodes).toBeGreaterThan(0);
      expect(result.passes).toBe(countPasses(result.moves));
      expect(replayWins(state, result.moves)).toBe(true);
    }
  });

  it('repart d’une position en cours de partie', () => {
    const start = setup(2, { drawCount: 3, maxPasses: null });
    const full = solve(start);
    expect(full.status).toBe('solved');
    const mid = cloneState(start);
    for (const m of full.moves.slice(0, 40)) applyMove(mid, m);
    const result = solve(mid);
    expect(result.status).toBe('solved');
    expect(replayWins(mid, result.moves)).toBe(true);
  });

  it('sait redescendre une carte de fondation quand c’est indispensable', () => {
    const state = buildState({
      drawCount: 1,
      foundations: [
        suitRun('s', 1, 6),
        suitRun('h', 1, 3),
        suitRun('c', 1, 13),
        suitRun('d', 1, 5),
      ],
      tableau: [
        { down: '4h', up: '5h' },
        { down: '6d', up: '7d' },
      ],
      stock: `${suitRun('s', 7, 13)} ${suitRun('h', 6, 13)} ${suitRun('d', 8, 13)}`,
    });
    const result = solve(state);
    expect(result.status).toBe('solved');
    expect(result.moves.some((m) => m.type === 'move' && m.from.startsWith('f'))).toBe(true);
    expect(replayWins(state, result.moves)).toBe(true);
  });

  it('prouve qu’une position bloquée est perdue', () => {
    const state = buildState({
      foundations: [
        suitRun('s', 1, 13),
        suitRun('h', 1, 13),
        suitRun('c', 1, 13),
        suitRun('d', 1, 2),
      ],
      tableau: [{ down: '3d', up: '5d' }, '6d', '7d', '8d', '9d', 'Td', 'Jd'],
      stock: '4d Qd Kd',
    });
    const result = solve(state);
    expect(result.status).toBe('unsolved');
    expect(result.moves).toEqual([]);
  });

  it('respecte la limite de nœuds', () => {
    const result = solve(setup(3, { drawCount: 3, maxPasses: null }), { maxNodes: 5 });
    expect(result.status).toBe('limit');
    expect(result.nodes).toBeLessThanOrEqual(6 * DEFAULT_RESTARTS.length);
  });

  it('respecte la limite de temps (horloge injectée)', () => {
    let t = 0;
    const result = solve(setup(16, { drawCount: 1, maxPasses: null }), {
      maxTimeMs: 10,
      now: () => (t += 100), // chaque lecture de l'horloge « dure » 100 ms
      maxNodes: 1_000_000,
    });
    expect(result.status).toBe('limit');
    expect(result.nodes).toBeLessThanOrEqual(1025); // contrôle du temps tous les 1024 nœuds
  });

  it('respecte un nombre de passages limité', () => {
    let found = 0;
    for (let seed = 1; seed <= 60 && found < 2; seed++) {
      const state = setup(seed, { drawCount: 3, maxPasses: 3 });
      const result = solve(state, { maxNodes: 60_000 });
      if (result.status !== 'solved') continue;
      found++;
      expect(result.passes).toBeLessThanOrEqual(3);
      expect(replayWins(state, result.moves)).toBe(true);
    }
    expect(found).toBe(2);
  });

  it('gère la pioche 3 avec retournement de défausse et passages limités en pioche 1', () => {
    const state = buildState({
      drawCount: 1,
      maxPasses: 2,
      foundations: [
        suitRun('s', 1, 10),
        suitRun('h', 1, 13),
        suitRun('c', 1, 13),
        suitRun('d', 1, 13),
      ],
      waste: 'Js Ks Qs',
    });
    const result = solve(state);
    expect(result.status).toBe('solved');
    expect(result.moves).toContainEqual(RECYCLE);
    expect(result.passes).toBe(2);
    // Pioche 3 : on tire Q♠ K♠ 10♠ (10♠ monte), puis J♠ ; le Roi doit passer par le tableau.
    const three = buildState({
      drawCount: 3,
      foundations: [
        suitRun('s', 1, 9),
        suitRun('h', 1, 13),
        suitRun('c', 1, 13),
        suitRun('d', 1, 13),
      ],
      stock: 'Js Ts Ks Qs',
    });
    const r3 = solve(three);
    expect(r3.status).toBe('solved');
    expect(r3.moves.some((m) => m.type === 'move' && m.to.startsWith('t'))).toBe(true);
    expect(replayWins(three, r3.moves)).toBe(true);
    // Avec le 10♠ hors d'atteinte (positions 3, 6… seulement), la position est perdue.
    const lost = buildState({
      drawCount: 3,
      foundations: [
        suitRun('s', 1, 9),
        suitRun('h', 1, 13),
        suitRun('c', 1, 13),
        suitRun('d', 1, 13),
      ],
      stock: 'Ks Js Qs Ts',
    });
    expect(solve(lost).status).toBe('unsolved');
  });

  it('renvoie une solution vide pour une partie déjà gagnée', () => {
    const won = buildState({
      foundations: [
        suitRun('s', 1, 13),
        suitRun('h', 1, 13),
        suitRun('c', 1, 13),
        suitRun('d', 1, 13),
      ],
    });
    expect(solve(won)).toEqual({ status: 'solved', moves: [], nodes: 0, passes: 1 });
  });

  it('compte les passages', () => {
    expect(countPasses([DRAW, RECYCLE, DRAW, RECYCLE])).toBe(3);
    expect(countPasses([])).toBe(1);
  });
});
