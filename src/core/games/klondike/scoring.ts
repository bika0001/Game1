import { KLONDIKE_SCORING, TIME_BONUS } from '../../../config/balance';
import type { KlondikeMove, KlondikeState } from './rules';

/** Variation de score brute d'un coup (avant plancher). */
export function scoreForMove(move: KlondikeMove, flipped: boolean): number {
  if (move.type === 'recycle') return KLONDIKE_SCORING.recycle;
  if (move.type === 'draw') return 0;
  let delta = 0;
  if (move.to.startsWith('f')) delta += KLONDIKE_SCORING.toFoundation;
  else if (move.from === 'waste') delta += KLONDIKE_SCORING.wasteToTableau;
  else if (move.from.startsWith('f')) delta += KLONDIKE_SCORING.foundationToTableau;
  if (flipped) delta += KLONDIKE_SCORING.flip;
  return delta;
}

/** Applique une variation en respectant le plancher ; renvoie la variation réellement appliquée. */
export function applyScoreDelta(state: KlondikeState, delta: number): number {
  const next = Math.max(KLONDIKE_SCORING.minScore, state.score + delta);
  const applied = next - state.score;
  state.score = next;
  return applied;
}

/** Bonus de temps accordé à la victoire quand le chrono est affiché. */
export function timeBonus(elapsedSeconds: number): number {
  const seconds = Math.max(TIME_BONUS.minSeconds, Math.floor(elapsedSeconds));
  return Math.round(TIME_BONUS.numerator / seconds);
}
