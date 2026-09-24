import { describe, expect, it } from 'vitest';
import {
  autoCompleteMoves,
  canAutoComplete,
  heuristicHint,
  isBlocked,
  searchProgress,
} from '../src/core/games/klondike/analysis';
import { applyMove, isWon, moveOf, DRAW, RECYCLE } from '../src/core/games/klondike/rules';
import { buildState, suitRun } from './helpers';

/** Toutes les couleurs montées jusqu'au 10, Valets/Dames/Rois visibles au tableau. */
function endgame(drawCount: 1 | 3 = 1) {
  return buildState({
    drawCount,
    foundations: [
      suitRun('s', 1, 10),
      suitRun('h', 1, 10),
      suitRun('c', 1, 10),
      suitRun('d', 1, 10),
    ],
    tableau: ['Ks Qh Js', 'Kh Qs Jh', 'Kc Qd Jc', 'Kd Qc Jd'],
  });
}

describe('auto-complétion', () => {
  it('est proposée quand tout est visible et la pioche vide, et gagne la partie', () => {
    const s = endgame();
    expect(canAutoComplete(s)).toBe(true);
    const moves = autoCompleteMoves(s);
    expect(moves.length).toBe(12);
    for (const m of moves) applyMove(s, m);
    expect(isWon(s)).toBe(true);
    expect(canAutoComplete(s)).toBe(false); // déjà gagnée
    expect(autoCompleteMoves(s)).toEqual([]);
  });

  it('n’est pas proposée s’il reste des cartes cachées', () => {
    const s = buildState({
      foundations: [
        suitRun('s', 1, 10),
        suitRun('h', 1, 10),
        suitRun('c', 1, 10),
        suitRun('d', 1, 10),
      ],
      tableau: [{ down: 'Ks', up: 'Qh Js' }, 'Kh Qs Jh', 'Kc Qd Jc', 'Kd Qc Jd'],
    });
    expect(canAutoComplete(s)).toBe(false);
    expect(autoCompleteMoves(s)).toEqual([]);
  });

  it('pioche 1 : la pioche restante est résolue trivialement', () => {
    const s = buildState({
      foundations: [
        suitRun('s', 1, 10),
        suitRun('h', 1, 10),
        suitRun('c', 1, 10),
        suitRun('d', 1, 10),
      ],
      tableau: ['Ks Qh', 'Kh Qs Jh', 'Kc Qd Jc', 'Kd Qc Jd'],
      stock: 'Js',
      waste: '',
    });
    expect(canAutoComplete(s)).toBe(true);
    const moves = autoCompleteMoves(s);
    expect(moves).toContainEqual(DRAW);
    for (const m of moves) applyMove(s, m);
    expect(isWon(s)).toBe(true);
  });

  it('recycle la défausse si nécessaire', () => {
    const s = buildState({
      foundations: [
        suitRun('s', 1, 10),
        suitRun('h', 1, 10),
        suitRun('c', 1, 10),
        suitRun('d', 1, 10),
      ],
      tableau: ['Kh Qc Jh', 'Kc Qh Jc', 'Kd', 'Qd', 'Jd'],
      waste: 'Js Ks Qs',
    });
    // Q♠ est au sommet de la défausse mais J♠ est tout en dessous : il faut recycler.
    expect(canAutoComplete(s)).toBe(true);
    const moves = autoCompleteMoves(s);
    expect(moves).toContainEqual(RECYCLE);
    for (const m of moves) applyMove(s, m);
    expect(isWon(s)).toBe(true);
  });

  it('pioche 3 : refuse quand l’alignement de la pioche bloque', () => {
    const s = buildState({
      drawCount: 3,
      foundations: [
        suitRun('s', 1, 10),
        suitRun('h', 1, 13),
        suitRun('c', 1, 13),
        suitRun('d', 1, 13),
      ],
      stock: 'Ks Qs Js', // on tire J♠, Q♠ puis K♠ : seul le Roi est accessible
    });
    expect(canAutoComplete(s)).toBe(false);
    expect(autoCompleteMoves(s)).toEqual([]);
  });

  it('refuse avec des passages limités épuisés', () => {
    const s = buildState({
      drawCount: 1,
      maxPasses: 1,
      foundations: [
        suitRun('s', 1, 10),
        suitRun('h', 1, 13),
        suitRun('c', 1, 13),
        suitRun('d', 1, 13),
      ],
      waste: 'Js Qs Ks',
    });
    expect(canAutoComplete(s)).toBe(false);
  });
});

describe('détection de blocage', () => {
  it('détecte une position sans aucun progrès possible (cycle de pioche inutile)', () => {
    const s = buildState({
      drawCount: 1,
      foundations: [
        suitRun('s', 1, 13),
        suitRun('h', 1, 13),
        suitRun('c', 1, 13),
        suitRun('d', 1, 2),
      ],
      tableau: [{ down: '3d', up: '5d' }, '6d', '7d', '8d', '9d', 'Td', 'Jd'],
      stock: '4d Qd Kd',
    });
    expect(isBlocked(s)).toBe(true);
    expect(heuristicHint(s)).toBeNull();
    const result = searchProgress(s);
    expect(result).toEqual({ blocked: true, firstMove: null, truncated: false });
  });

  it('détecte une position sans aucun coup légal', () => {
    const s = buildState({
      foundations: [
        suitRun('s', 1, 13),
        suitRun('h', 1, 13),
        suitRun('c', 1, 13),
        suitRun('d', 1, 2),
      ],
      tableau: [{ down: '3d', up: '5d' }, '6d', '7d', '8d', '9d', 'Td', 'Jd'],
    });
    expect(isBlocked(s)).toBe(true);
  });

  it('trouve un progrès à deux coups (descendre une carte de fondation)', () => {
    const s = buildState({
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
    });
    expect(isBlocked(s)).toBe(false);
    expect(heuristicHint(s)).toEqual(moveOf('f0', 't1'));
  });

  it('suggère de piocher quand le progrès est plus loin dans la pioche', () => {
    const s = buildState({
      drawCount: 1,
      foundations: [suitRun('s', 1, 4), '', '', ''],
      tableau: ['2h', '3h', '4h', '5h', '6h', '7h', '8h'],
      stock: '5s Kd Qd',
    });
    expect(isBlocked(s)).toBe(false);
    expect(heuristicHint(s)).toEqual(DRAW);
  });

  it('préfère révéler une carte cachée parmi les coups immédiats', () => {
    const s = buildState({
      foundations: ['As', '', '', ''],
      tableau: [{ down: '9c', up: '6h' }, '7s', '2s'],
      waste: '6d',
    });
    // 2♠ peut monter, 6♦ et 6♥ peuvent aller sur 7♠ : révéler la carte cachée est prioritaire.
    expect(heuristicHint(s)).toEqual(moveOf('t0', 't1'));
  });

  it('préfère une montée en fondation à un coup de défausse', () => {
    const s = buildState({
      foundations: ['As', '', '', ''],
      tableau: ['7s', '2s'],
      waste: '6d',
    });
    expect(heuristicHint(s)).toEqual(moveOf('t1', 'f0'));
  });

  it('propose le premier coup de l’auto-complétion en fin de partie', () => {
    const s = endgame();
    expect(isBlocked(s)).toBe(false);
    const hint = heuristicHint(s);
    expect(hint?.type).toBe('move');
  });

  it('une partie gagnée n’est pas bloquée', () => {
    const s = buildState({
      foundations: [
        suitRun('s', 1, 13),
        suitRun('h', 1, 13),
        suitRun('c', 1, 13),
        suitRun('d', 1, 13),
      ],
    });
    expect(isBlocked(s)).toBe(false);
    expect(heuristicHint(s)).toBeNull();
  });

  it('reste prudente quand la recherche est tronquée', () => {
    const s = buildState({
      drawCount: 1,
      foundations: [suitRun('s', 1, 4), '', '', ''],
      tableau: ['2h', '3h', '4h', '5h', '6h', '7h', '8h'],
      stock: '5s Kd Qd',
    });
    const r = searchProgress(s, 0);
    expect(r.truncated).toBe(true);
    expect(r.blocked).toBe(false);
    expect(heuristicHint(s, 0)).toEqual(DRAW);
    const empty = buildState({
      drawCount: 1,
      foundations: [suitRun('s', 1, 4), '', '', ''],
      tableau: ['2h', '3h', '4h', '5h', '6h', '7h', '8h'],
      waste: '5s Kd Qd',
    });
    expect(heuristicHint(empty, 0)).toEqual(RECYCLE);
    const noRecycle = buildState({
      drawCount: 1,
      maxPasses: 1,
      foundations: [suitRun('s', 1, 4), '', '', ''],
      tableau: ['2h', '3h', '4h', '5h', '6h', '7h', '8h'],
      waste: '5s Kd Qd',
    });
    expect(heuristicHint(noRecycle, 0)).toBeNull();
  });

  it('tient compte des passages restants quand ils sont limités', () => {
    const spec = {
      drawCount: 1 as const,
      tableau: ['2h', '3h', '4h', '5h', '6h', '7h', '8h'],
      waste: 'As Kd',
    };
    expect(isBlocked(buildState({ ...spec, maxPasses: 2 }))).toBe(false);
    expect(heuristicHint(buildState({ ...spec, maxPasses: 2 }))).toEqual(RECYCLE);
    expect(isBlocked(buildState({ ...spec, maxPasses: 2, recycles: 1 }))).toBe(true);
    expect(isBlocked(buildState({ ...spec, maxPasses: 1 }))).toBe(true);
  });
});
