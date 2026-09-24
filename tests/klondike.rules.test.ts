import { describe, expect, it } from 'vitest';
import { cardToString, parseCard, parseCards } from '../src/core/cards';
import { createRng } from '../src/core/rng';
import {
  applyMove,
  canDraw,
  canRecycle,
  cloneState,
  column,
  dealFromDeck,
  defaultMaxPasses,
  destinationsFor,
  faceDownTotal,
  foundation,
  foundationCount,
  foundationFor,
  foundationOfSuit,
  isLegal,
  isWon,
  legalMoves,
  maxRecycles,
  movableCount,
  moveOf,
  parsePileId,
  pileCards,
  setup,
  undo,
  DRAW,
  RECYCLE,
  type KlondikeMove,
  type KlondikeRecord,
} from '../src/core/games/klondike/rules';
import { buildState, suitRun } from './helpers';

const names = (cards: readonly number[]): string => cards.map(cardToString).join(' ');

describe('mise en place', () => {
  it('distribue 7 colonnes de 1 à 7 cartes, dernière visible, et 24 cartes en pioche', () => {
    const s = setup(123, { drawCount: 1, maxPasses: null });
    s.tableau.forEach((col, i) => {
      expect(col.cards.length).toBe(i + 1);
      expect(col.faceDown).toBe(i);
    });
    expect(s.stock.length).toBe(24);
    expect(s.waste.length).toBe(0);
    expect(foundationCount(s)).toBe(0);
    expect(faceDownTotal(s)).toBe(21);
    const all = [...s.stock, ...s.tableau.flatMap((c) => c.cards)];
    expect(new Set(all).size).toBe(52);
  });

  it('est déterministe pour une graine', () => {
    const a = setup(99, { drawCount: 3, maxPasses: null });
    const b = setup(99, { drawCount: 3, maxPasses: null });
    expect(b).toEqual(a);
    expect(setup(100, { drawCount: 3, maxPasses: null })).not.toEqual(a);
  });

  it('refuse un paquet incomplet', () => {
    expect(() => dealFromDeck([1, 2, 3], { drawCount: 1, maxPasses: null })).toThrow();
  });

  it('calcule le nombre de passages de l’option « limité »', () => {
    expect(defaultMaxPasses(1, false)).toBeNull();
    expect(defaultMaxPasses(1, true)).toBe(1);
    expect(defaultMaxPasses(3, true)).toBe(3);
    expect(maxRecycles({ drawCount: 1, maxPasses: null })).toBe(Infinity);
    expect(maxRecycles({ drawCount: 3, maxPasses: 3 })).toBe(2);
  });
});

describe('identifiants de piles', () => {
  it('décode les piles connues et rejette les autres', () => {
    expect(parsePileId('stock')).toEqual({ kind: 'stock', index: 0 });
    expect(parsePileId('waste')).toEqual({ kind: 'waste', index: 0 });
    expect(parsePileId('t6')).toEqual({ kind: 'tableau', index: 6 });
    expect(parsePileId('f3')).toEqual({ kind: 'foundation', index: 3 });
    for (const bad of ['t7', 'f4', 'x1', 't', 't10', '', 'ta']) expect(parsePileId(bad)).toBeNull();
  });

  it('lève une erreur sur une pile inexistante', () => {
    const s = buildState({});
    expect(() => column(s, 9)).toThrow();
    expect(() => foundation(s, 9)).toThrow();
    expect(() => pileCards(s, 'zz' as never)).toThrow();
    expect(movableCount(s, 'zz' as never)).toBe(0);
    expect(movableCount(s, 'stock')).toBe(0);
  });
});

describe('légalité des coups', () => {
  it('défausse → tableau : rang -1 et couleur alternée', () => {
    const s = buildState({ tableau: ['8s', '8h', '9s'], waste: '7h' });
    expect(isLegal(s, moveOf('waste', 't0'))).toBe(true);
    expect(isLegal(s, moveOf('waste', 't1'))).toBe(false);
    expect(isLegal(s, moveOf('waste', 't2'))).toBe(false);
    expect(isLegal(s, moveOf('waste', 't0', 2))).toBe(false);
  });

  it('défausse → fondation : As sur fondation vide, puis même couleur dans l’ordre', () => {
    const s = buildState({ waste: 'Ah', foundations: ['As', '', '', ''] });
    expect(isLegal(s, moveOf('waste', 'f1'))).toBe(true);
    expect(isLegal(s, moveOf('waste', 'f0'))).toBe(false);
    const t = buildState({ waste: '2s', foundations: ['As', 'Ah', '', ''] });
    expect(isLegal(t, moveOf('waste', 'f0'))).toBe(true);
    expect(isLegal(t, moveOf('waste', 'f1'))).toBe(false);
    expect(isLegal(t, moveOf('waste', 'f2'))).toBe(false);
  });

  it('déplace une séquence entière ou partielle entre colonnes', () => {
    const s = buildState({
      tableau: [{ down: '2c', up: '9h 8s 7h 6c' }, '10c', '8d', '7s'],
    });
    expect(isLegal(s, moveOf('t0', 't1', 4))).toBe(true); // 9♥ 8♠ 7♥ 6♣ sur 10♣
    expect(isLegal(s, moveOf('t0', 't2', 2))).toBe(false); // 7♥ rouge sur 8♦ rouge
    expect(isLegal(s, moveOf('t0', 't3', 1))).toBe(false); // 6♣ noir sur 7♠ noir
    expect(isLegal(s, moveOf('t0', 't1', 5))).toBe(false); // on ne prend pas de carte cachée
    expect(isLegal(s, moveOf('t0', 't1', 3))).toBe(false); // 8♠ sur 10♣ : rang faux
  });

  it('déplace une séquence partielle sur une carte de couleur opposée', () => {
    const s = buildState({ tableau: [{ up: '9h 8s 7h 6c' }, '', '8d', '8c'] });
    expect(isLegal(s, moveOf('t0', 't2', 2))).toBe(false);
    expect(isLegal(s, moveOf('t0', 't3', 2))).toBe(true);
  });

  it('seul un Roi (ou une séquence commençant par un Roi) va sur une colonne vide', () => {
    const s = buildState({
      tableau: [{ down: '2c', up: 'Kh Qs Jh' }, '', { up: 'Qd' }],
      waste: 'Ks',
    });
    expect(isLegal(s, moveOf('t0', 't1', 3))).toBe(true);
    expect(isLegal(s, moveOf('t0', 't1', 2))).toBe(false);
    expect(isLegal(s, moveOf('t2', 't1', 1))).toBe(false);
    expect(isLegal(s, moveOf('waste', 't1'))).toBe(true);
  });

  it('tableau → fondation : seulement la carte du dessus', () => {
    const s = buildState({ tableau: ['3h 2s', '2h'], foundations: ['As', 'Ah', '', ''] });
    expect(isLegal(s, moveOf('t0', 'f0'))).toBe(true);
    expect(isLegal(s, moveOf('t0', 'f0', 2))).toBe(false);
    expect(isLegal(s, moveOf('t1', 'f1'))).toBe(true);
  });

  it('fondation → tableau est permis, fondation → fondation non', () => {
    const s = buildState({ tableau: ['6c'], foundations: ['', suitRun('h', 1, 5), '', ''] });
    expect(isLegal(s, moveOf('f1', 't0'))).toBe(true);
    expect(isLegal(s, moveOf('f1', 'f0'))).toBe(false);
    expect(isLegal(s, moveOf('f0', 't0'))).toBe(false); // fondation vide
  });

  it('rejette les coups mal formés', () => {
    const s = buildState({ tableau: ['Kh', ''], waste: '5s' });
    expect(isLegal(s, moveOf('t0', 't0'))).toBe(false);
    expect(isLegal(s, moveOf('t0', 't1', 0))).toBe(false);
    expect(isLegal(s, moveOf('t0', 't1', 1.5))).toBe(false);
    expect(isLegal(s, moveOf('t0', 'stock'))).toBe(false);
    expect(isLegal(s, moveOf('t0', 'waste'))).toBe(false);
    expect(isLegal(s, moveOf('stock', 't1'))).toBe(false);
    expect(isLegal(s, moveOf('t9' as never, 't1'))).toBe(false);
    expect(isLegal(s, moveOf('t0', 'q1' as never))).toBe(false);
  });

  it('lève une erreur si on applique un coup illégal', () => {
    const s = buildState({ tableau: ['Kh'] });
    expect(() => applyMove(s, moveOf('t0', 't1', 2))).toThrow(/illégal/);
  });
});

describe('application, retournement et score', () => {
  it('retourne automatiquement la carte découverte (+5) et compte le score standard', () => {
    const s = buildState({
      tableau: [{ down: '4d', up: '9h' }, '10s', '6c'],
      waste: '5h',
      foundations: ['', '', '', ''],
    });
    const r1 = applyMove(s, moveOf('t0', 't1'));
    expect(r1.flipped).toBe(true);
    expect(column(s, 0).faceDown).toBe(0);
    expect(r1.scoreDelta).toBe(5);
    const r2 = applyMove(s, moveOf('waste', 't2'));
    expect(r2.scoreDelta).toBe(5);
    expect(s.score).toBe(10);
  });

  it('compte +10 vers une fondation et -15 depuis une fondation (jamais sous zéro)', () => {
    const s = buildState({ tableau: ['2h', '3s'], waste: 'Ah', foundations: ['', '', '', ''] });
    expect(applyMove(s, moveOf('waste', 'f0')).scoreDelta).toBe(10);
    expect(applyMove(s, moveOf('t0', 'f0')).scoreDelta).toBe(10);
    expect(s.score).toBe(20);
    const r = applyMove(s, moveOf('f0', 't1'));
    expect(r.scoreDelta).toBe(-15);
    expect(s.score).toBe(5);
    applyMove(s, moveOf('t1', 'f0'));
    expect(s.score).toBe(15);
    const low = buildState({ tableau: ['3s'], foundations: [suitRun('h', 1, 2), '', '', ''] });
    const floor = applyMove(low, moveOf('f0', 't0'));
    expect(low.score).toBe(0);
    expect(floor.scoreDelta).toBe(0);
    undo(low, floor);
    expect(low.score).toBe(0);
  });
});

describe('pioche', () => {
  it('pioche 1 : une carte à la fois, puis retourne la défausse', () => {
    const s = buildState({ stock: '2c 3c 4c', drawCount: 1 });
    expect(canDraw(s)).toBe(true);
    applyMove(s, DRAW);
    expect(names(s.waste)).toBe('4♣');
    applyMove(s, DRAW);
    applyMove(s, DRAW);
    expect(names(s.waste)).toBe('4♣ 3♣ 2♣');
    expect(canDraw(s)).toBe(false);
    expect(canRecycle(s)).toBe(true);
    applyMove(s, RECYCLE);
    expect(s.recycles).toBe(1);
    expect(s.waste.length).toBe(0);
    applyMove(s, DRAW);
    expect(names(s.waste)).toBe('4♣'); // même ordre à chaque passage
  });

  it('pioche 3 : trois cartes (ou moins en fin de pioche), la dernière tirée au sommet', () => {
    const s = buildState({ stock: '2c 3c 4c 5c 6c', drawCount: 3 });
    const r = applyMove(s, DRAW);
    expect(r.drawn).toBe(3);
    expect(names(s.waste)).toBe('6♣ 5♣ 4♣');
    const r2 = applyMove(s, DRAW);
    expect(r2.drawn).toBe(2);
    expect(names(s.waste)).toBe('6♣ 5♣ 4♣ 3♣ 2♣');
    undo(s, r2);
    expect(names(s.stock)).toBe('2♣ 3♣');
  });

  it('passages limités : pioche 1 en un seul passage', () => {
    const s = buildState({ stock: '2c', drawCount: 1, maxPasses: 1 });
    applyMove(s, DRAW);
    expect(canRecycle(s)).toBe(false);
    expect(isLegal(s, RECYCLE)).toBe(false);
    expect(legalMoves(s)).not.toContainEqual(RECYCLE);
  });

  it('passages limités : pioche 3 en trois passages', () => {
    const s = buildState({ stock: '2c 3c', drawCount: 3, maxPasses: 3 });
    for (let pass = 1; pass <= 3; pass++) {
      applyMove(s, DRAW);
      if (pass < 3) applyMove(s, RECYCLE);
    }
    expect(s.recycles).toBe(2);
    expect(canRecycle(s)).toBe(false);
  });

  it('passages illimités : on peut retourner la défausse indéfiniment', () => {
    const s = buildState({ stock: '2c', drawCount: 3 });
    for (let i = 0; i < 50; i++) {
      applyMove(s, DRAW);
      applyMove(s, RECYCLE);
    }
    expect(s.recycles).toBe(50);
    expect(canRecycle(buildState({}))).toBe(false); // pioche et défausse vides
  });
});

describe('annulation', () => {
  it('annule un déplacement avec retournement', () => {
    const s = buildState({ tableau: [{ down: '4d 5s', up: 'Qh Js' }, 'Ks'] });
    const before = cloneState(s);
    const r = applyMove(s, moveOf('t0', 't1', 2));
    expect(r.flipped).toBe(true);
    undo(s, r);
    expect(s).toEqual(before);
  });

  it('annule le recyclage de la pioche', () => {
    const s = buildState({ waste: '2c 3c 4c', drawCount: 3, score: 40 });
    const before = cloneState(s);
    const r = applyMove(s, RECYCLE);
    undo(s, r);
    expect(s).toEqual(before);
  });

  it('annule de longues séquences aléatoires jusqu’à la donne initiale', () => {
    for (const drawCount of [1, 3] as const) {
      for (let seed = 1; seed <= 8; seed++) {
        const s = setup(seed, { drawCount, maxPasses: seed % 2 === 0 ? 3 : null });
        const initial = cloneState(s);
        const rng = createRng(seed * 31 + drawCount);
        const records: KlondikeRecord[] = [];
        const snapshots = [cloneState(s)];
        for (let i = 0; i < 400; i++) {
          const moves = legalMoves(s);
          if (moves.length === 0) break;
          const move = moves[rng.int(moves.length)] as KlondikeMove;
          records.push(applyMove(s, move));
          snapshots.push(cloneState(s));
        }
        expect(records.some((r) => r.flipped)).toBe(true);
        expect(records.some((r) => r.move.type === 'recycle')).toBe(true);
        for (let i = records.length - 1; i >= 0; i--) {
          undo(s, records[i] as KlondikeRecord);
          expect(s).toEqual(snapshots[i]);
        }
        expect(s).toEqual(initial);
      }
    }
  });
});

describe('énumération des coups', () => {
  it('ne renvoie que des coups légaux, tous types confondus', () => {
    const s = buildState({
      tableau: [{ down: '4d', up: '9h 8s' }, '10s', '', { up: '7d' }, { up: '3h' }],
      waste: 'Kc',
      stock: '2c',
      foundations: [suitRun('s', 1, 2), suitRun('h', 1, 2), '', ''],
    });
    const moves = legalMoves(s);
    for (const m of moves) expect(isLegal(s, m)).toBe(true);
    const keys = moves.map((m) => (m.type === 'move' ? `${m.from}>${m.to}x${m.count}` : m.type));
    expect(keys).toContain('draw');
    expect(keys).toContain('t0>t1x2'); // séquence entière 9♥ 8♠ sur 10♠
    expect(keys).toContain('waste>t2x1'); // Roi sur colonne vide
    expect(keys).toContain('t4>f1x1'); // 3♥ en fondation
    expect(keys).toContain('f0>t4x1'); // 2♠ redescend sur 3♥
    expect(keys).not.toContain('recycle');
  });

  it('vérifie les destinations proposées', () => {
    const s = buildState({
      tableau: [{ down: '4d', up: '9h 8s' }, '10s', '', { up: '9d' }, { up: '3h' }],
      waste: 'Kc',
      foundations: [suitRun('s', 1, 2), suitRun('h', 1, 2), '', ''],
    });
    expect(destinationsFor(s, 't0', 1)).toEqual(['t3']); // 8♠ sur 9♦
    expect(destinationsFor(s, 't0', 2)).toEqual(['t1']); // 9♥ 8♠ sur 10♠
    expect(destinationsFor(s, 'waste', 1)).toEqual(['t2', 't5', 't6']); // Roi : toute colonne vide
    expect(destinationsFor(s, 't4', 1)).toEqual(['f1']); // 3♥ sur la fondation ♥
    expect(destinationsFor(s, 'f0', 1)).toEqual(['t4']); // 2♠ sur 3♥
  });
});

describe('fondations et victoire', () => {
  it('trouve la fondation d’une carte', () => {
    const s = buildState({ foundations: ['', 'Ah', '', 'As 2s'] });
    expect(foundationFor(s, parseCard('2h'))).toBe(1);
    expect(foundationFor(s, parseCard('3s'))).toBe(3);
    expect(foundationFor(s, parseCard('Ad'))).toBe(0);
    expect(foundationFor(s, parseCard('5d'))).toBe(-1);
    expect(foundationOfSuit(s, parseCard('9s') & 3)).toBe(3);
    expect(foundationOfSuit(s, parseCard('9c') & 3)).toBe(-1);
    const full = buildState({ foundations: ['As', 'Ah', 'Ac', 'Ad'] });
    expect(foundationFor(full, parseCard('Ad'))).toBe(-1);
  });

  it('détecte la victoire', () => {
    const won = buildState({
      foundations: [
        suitRun('s', 1, 13),
        suitRun('h', 1, 13),
        suitRun('c', 1, 13),
        suitRun('d', 1, 13),
      ],
    });
    expect(isWon(won)).toBe(true);
    expect(isWon(buildState({ foundations: [suitRun('s', 1, 13)] }))).toBe(false);
    expect(parseCards(suitRun('d', 1, 13)).length).toBe(13);
  });
});
