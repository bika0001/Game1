import type { KlondikeMove, KlondikeState } from '../core/games/klondike/rules';

export type HintSource = 'solver' | 'heuristic' | 'none';

export type SolverRequest =
  | { readonly id: number; readonly kind: 'hint'; readonly state: KlondikeState }
  | { readonly id: number; readonly kind: 'blocked'; readonly state: KlondikeState };

export type SolverResponse =
  | {
      readonly id: number;
      readonly kind: 'hint';
      readonly move: KlondikeMove | null;
      readonly source: HintSource;
    }
  | { readonly id: number; readonly kind: 'blocked'; readonly blocked: boolean };
