import { describe, expect, it } from 'vitest';
import { klondike, moveOf, DRAW, RECYCLE, applyMove } from '../src/core/games/klondike';
import { buildState } from './helpers';

describe('variante Klondike (interface commune)', () => {
  it('expose les piles avec leurs faces', () => {
    const s = klondike.setup(5, { drawCount: 1, maxPasses: null });
    const piles = klondike.piles(s);
    expect(piles.map((p) => p.id)).toEqual([
      'stock',
      'waste',
      'f0',
      'f1',
      'f2',
      'f3',
      't0',
      't1',
      't2',
      't3',
      't4',
      't5',
      't6',
    ]);
    const t6 = piles.find((p) => p.id === 't6');
    expect(t6?.cards.filter((c) => c.faceUp).length).toBe(1);
    expect(t6?.cards.length).toBe(7);
    expect(piles[0]?.cards.every((c) => !c.faceUp)).toBe(true);
    expect(klondike.score(s)).toBe(0);
    expect(klondike.isWon(s)).toBe(false);
    expect(klondike.canAutoComplete(s)).toBe(false);
    expect(klondike.autoCompleteMoves(s)).toEqual([]);
    expect(klondike.isBlocked(s)).toBe(false);
    expect(klondike.heuristicHint(s)).not.toBeNull();
    expect(klondike.legalMoves(s).length).toBeGreaterThan(0);
    expect(klondike.cloneState(s)).toEqual(s);
  });

  it('montre la défausse et les fondations', () => {
    const s = buildState({ waste: '2c 3d', foundations: ['As 2s', '', 'Ac', ''] });
    const piles = klondike.piles(s);
    expect(piles.find((p) => p.id === 'waste')?.cards).toEqual([
      { card: 4 + 2, faceUp: true },
      { card: 8 + 3, faceUp: true },
    ]);
    expect(piles.find((p) => p.id === 'f0')?.cards.length).toBe(2);
    expect(piles.find((p) => p.id === 'f2')?.cards[0]?.faceUp).toBe(true);
  });

  it('décrit les coups pour l’affichage', () => {
    const s = buildState({ stock: '2c 3c 4c 5c', drawCount: 3, tableau: ['9h 8s', '9d'] });
    expect(klondike.describeMove(s, DRAW)).toEqual({
      from: 'stock',
      cardIndex: 1,
      count: 3,
      to: 'waste',
    });
    applyMove(s, DRAW);
    applyMove(s, DRAW);
    expect(klondike.describeMove(s, RECYCLE)).toEqual({
      from: 'waste',
      cardIndex: 0,
      count: 4,
      to: 'stock',
    });
    expect(klondike.describeMove(s, moveOf('t0', 't1', 1))).toEqual({
      from: 't0',
      cardIndex: 1,
      count: 1,
      to: 't1',
    });
  });

  it('gère la saisie et le lâcher', () => {
    const s = buildState({
      tableau: [{ down: '2c', up: '9h 8s' }, '10s', '9d'],
      waste: '3c Qh',
      foundations: ['As', '', '', ''],
    });
    expect(klondike.canDrag(s, 'stock', 0)).toBe(false);
    expect(klondike.canDrag(s, 'xx', 0)).toBe(false);
    expect(klondike.canDrag(s, 't0', 0)).toBe(false); // cachée
    expect(klondike.canDrag(s, 't0', 1)).toBe(true);
    expect(klondike.canDrag(s, 't0', 3)).toBe(false);
    expect(klondike.canDrag(s, 'waste', 0)).toBe(false);
    expect(klondike.canDrag(s, 'waste', 1)).toBe(true);
    expect(klondike.canDrag(s, 'f0', 0)).toBe(true);
    expect(klondike.dropTargets(s, 't0', 1)).toEqual(['t1']);
    expect(klondike.dropTargets(s, 't0', 2)).toEqual(['t2']);
    expect(klondike.dropTargets(s, 't0', 0)).toEqual([]);
    expect(klondike.dropMove(s, 't0', 1, 't1')).toEqual(moveOf('t0', 't1', 2));
    expect(klondike.dropMove(s, 't0', 1, 't2')).toBeNull();
    expect(klondike.dropMove(s, 't0', 1, 'nowhere')).toBeNull();
    expect(klondike.dropMove(s, 't0', 0, 't1')).toBeNull();
    expect(klondike.tapMove(s, 'waste', 1)).toBeNull(); // Q♥ : aucune place
    expect(klondike.isLegal(s, moveOf('t0', 't1', 2))).toBe(true);
    const record = klondike.applyMove(s, moveOf('t0', 't1', 2));
    expect(record.flipped).toBe(true);
    klondike.undo(s, record);
    expect(s.tableau[0]?.faceDown).toBe(1);
  });
});
