import { describe, expect, it } from 'vitest';
import { scoreForMove, timeBonus } from '../src/core/games/klondike/scoring';
import { moveOf, DRAW, RECYCLE } from '../src/core/games/klondike/rules';
import { KLONDIKE_SCORING, TIME_BONUS } from '../src/config/balance';

describe('score standard', () => {
  it('attribue les points de chaque type de coup', () => {
    expect(scoreForMove(moveOf('waste', 't0'), false)).toBe(KLONDIKE_SCORING.wasteToTableau);
    expect(scoreForMove(moveOf('waste', 'f0'), false)).toBe(KLONDIKE_SCORING.toFoundation);
    expect(scoreForMove(moveOf('t1', 'f0'), true)).toBe(
      KLONDIKE_SCORING.toFoundation + KLONDIKE_SCORING.flip,
    );
    expect(scoreForMove(moveOf('f0', 't1'), false)).toBe(KLONDIKE_SCORING.foundationToTableau);
    expect(scoreForMove(moveOf('t0', 't1', 3), true)).toBe(KLONDIKE_SCORING.flip);
    expect(scoreForMove(moveOf('t0', 't1', 3), false)).toBe(0);
    expect(scoreForMove(DRAW, false)).toBe(0);
    expect(scoreForMove(RECYCLE, false)).toBe(KLONDIKE_SCORING.recycle);
  });

  it('calcule le bonus de temps', () => {
    expect(timeBonus(10)).toBe(Math.round(TIME_BONUS.numerator / TIME_BONUS.minSeconds));
    expect(timeBonus(100)).toBe(7000);
    expect(timeBonus(100.9)).toBe(7000);
  });
});
