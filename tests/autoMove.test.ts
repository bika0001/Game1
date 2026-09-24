import { describe, expect, it } from 'vitest';
import { bestMoveForTap } from '../src/core/autoMove';
import { applyMove, moveOf, DRAW, RECYCLE } from '../src/core/games/klondike/rules';
import { buildState, suitRun } from './helpers';

describe('tap = meilleur coup', () => {
  it('envoie en fondation en priorité', () => {
    const s = buildState({ tableau: ['3s'], waste: '2h', foundations: ['Ah', '', '', ''] });
    // 2♥ pourrait aussi aller sur 3♠, mais la fondation passe avant.
    expect(bestMoveForTap(s, 'waste', 0)).toEqual(moveOf('waste', 'f0'));
  });

  it('choisit la fondation la plus à gauche pour un As', () => {
    const s = buildState({ tableau: ['Ad'], foundations: ['', 'As', '', ''] });
    expect(bestMoveForTap(s, 't0', 0)).toEqual(moveOf('t0', 'f0'));
  });

  it('préfère la colonne non vide la plus proche de la colonne d’origine', () => {
    const s = buildState({ tableau: ['8h', '', '', { down: '2c', up: '7s' }, '', '8d'] });
    // 7♠ peut aller sur 8♥ (distance 3) ou 8♦ (distance 2).
    expect(bestMoveForTap(s, 't3', 0 + 1)).toEqual(moveOf('t3', 't5'));
  });

  it('départage à distance égale par la colonne la plus à gauche', () => {
    const s = buildState({ tableau: ['', '8h', '', { up: '7s' }, '', '8d'] });
    expect(bestMoveForTap(s, 't3', 0)).toEqual(moveOf('t3', 't1'));
  });

  it('défausse : colonne la plus à gauche parmi les destinations équivalentes', () => {
    const s = buildState({ tableau: ['', '', '8h', '', '8d'], waste: '7c' });
    expect(bestMoveForTap(s, 'waste', 0)).toEqual(moveOf('waste', 't2'));
  });

  it('déplace toute la séquence à partir de la carte tapée', () => {
    const s = buildState({ tableau: [{ down: '2c', up: '9h 8s 7h' }, '10c', '9d'] });
    expect(bestMoveForTap(s, 't0', 1)).toEqual(moveOf('t0', 't1', 3));
    expect(bestMoveForTap(s, 't0', 2)).toEqual(moveOf('t0', 't2', 2));
  });

  it('préfère une colonne occupée à une colonne vide… et pose un Roi sur la première vide', () => {
    const s = buildState({ tableau: [{ down: '2c', up: 'Kh Qs' }, '', 'Kd', '', ''] });
    expect(bestMoveForTap(s, 't0', 1)).toEqual(moveOf('t0', 't1', 2));
    expect(bestMoveForTap(s, 't0', 2)).toEqual(moveOf('t0', 't2', 1)); // Q♠ sur K♦
  });

  it('ne déplace pas un Roi déjà au pied de sa colonne', () => {
    const s = buildState({ tableau: ['Kh Qs', '', ''] });
    expect(bestMoveForTap(s, 't0', 0)).toBeNull();
  });

  it('renvoie null quand aucun coup n’est possible (secousse)', () => {
    const s = buildState({ tableau: [{ down: '2c 3c', up: '9h' }, '9s'] });
    expect(bestMoveForTap(s, 't0', 2)).toBeNull(); // aucune destination
    expect(bestMoveForTap(s, 't0', 0)).toBeNull(); // carte cachée
    expect(bestMoveForTap(s, 't0', 5)).toBeNull(); // hors limites
    expect(bestMoveForTap(s, 't0', -1)).toBeNull();
    expect(bestMoveForTap(s, 'xx', 0)).toBeNull();
    expect(bestMoveForTap(s, 'waste', 0)).toBeNull(); // défausse vide
  });

  it('ne tape que le sommet de la défausse ou d’une fondation', () => {
    const s = buildState({
      tableau: ['4s'],
      waste: '3h 5d',
      foundations: [suitRun('h', 1, 3), '', '', ''],
    });
    expect(bestMoveForTap(s, 'waste', 0)).toBeNull();
    expect(bestMoveForTap(s, 'f0', 1)).toBeNull();
    expect(bestMoveForTap(s, 'f0', 2)).toEqual(moveOf('f0', 't0')); // 3♥ redescend sur 4♠
  });

  it('pioche : tirer, puis retourner la défausse, puis rien si les passages sont épuisés', () => {
    const s = buildState({ stock: '2c', drawCount: 1, maxPasses: 2 });
    expect(bestMoveForTap(s, 'stock', 0)).toEqual(DRAW);
    applyMove(s, DRAW);
    expect(bestMoveForTap(s, 'stock', -1)).toEqual(RECYCLE);
    applyMove(s, RECYCLE);
    applyMove(s, DRAW);
    expect(bestMoveForTap(s, 'stock', -1)).toBeNull();
  });
});
