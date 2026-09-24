import { SOLVER } from '../config/balance';
import { heuristicHint, isBlocked } from '../core/games/klondike/analysis';
import { solve } from '../core/games/klondike/solver';
import type { KlondikeMove, KlondikeState } from '../core/games/klondike/rules';
import type { HintSource, SolverRequest, SolverResponse } from './protocol';

/** Indice : premier coup d'une solution, sinon heuristique. */
export function computeHint(
  state: KlondikeState,
  useSolver = true,
): { move: KlondikeMove | null; source: HintSource } {
  if (useSolver) {
    const result = solve(state, { maxNodes: SOLVER.hintMaxNodes, maxTimeMs: SOLVER.hintMaxTimeMs });
    const first = result.moves[0];
    if (result.status === 'solved' && first) return { move: first, source: 'solver' };
  }
  const move = heuristicHint(state);
  return { move, source: move ? 'heuristic' : 'none' };
}

export function handleRequest(request: SolverRequest, useSolver = true): SolverResponse {
  if (request.kind === 'blocked') {
    return { id: request.id, kind: 'blocked', blocked: isBlocked(request.state) };
  }
  return { id: request.id, kind: 'hint', ...computeHint(request.state, useSolver) };
}
