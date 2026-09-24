import { History } from './history';
import type { MoveRecord, SolitaireVariant, VariantId } from './games/types';

/**
 * Partie en cours, indépendante du rendu : état, pile d'annulation, compteurs
 * et sérialisation complète (y compris l'historique d'annulation).
 */

export type DealSource = 'bank' | 'random' | 'daily';

export interface DealInfo {
  readonly seed: number;
  readonly source: DealSource;
  /** Index dans la banque de donnes gagnables. */
  readonly bankIndex?: number;
  /** Date du défi (AAAA-MM-JJ). */
  readonly dailyDate?: string;
}

export const SESSION_VERSION = 1;

export interface SessionData<S, O, R> {
  readonly version: number;
  readonly variant: VariantId;
  readonly options: O;
  readonly deal: DealInfo;
  readonly state: S;
  readonly history: R[];
  readonly elapsedMs: number;
  readonly undoCount: number;
  readonly hintCount: number;
  readonly autoCompleted: boolean;
  readonly startedAt: number;
}

export class GameSession<S, M, O, R extends MoveRecord<M>> {
  private currentState: S;
  private readonly history: History<R>;
  elapsedMs = 0;
  undoCount = 0;
  hintCount = 0;
  autoCompleted = false;
  startedAt: number;

  private constructor(
    readonly variant: SolitaireVariant<S, M, O, R>,
    readonly options: O,
    readonly deal: DealInfo,
    state: S,
    history: readonly R[],
    startedAt: number,
  ) {
    this.currentState = state;
    this.history = new History(history);
    this.startedAt = startedAt;
  }

  static start<S, M, O, R extends MoveRecord<M>>(
    variant: SolitaireVariant<S, M, O, R>,
    options: O,
    deal: DealInfo,
    now: number = Date.now(),
  ): GameSession<S, M, O, R> {
    return new GameSession(variant, options, deal, variant.setup(deal.seed, options), [], now);
  }

  static restore<S, M, O, R extends MoveRecord<M>>(
    variant: SolitaireVariant<S, M, O, R>,
    data: SessionData<S, O, R>,
  ): GameSession<S, M, O, R> {
    if (data.variant !== variant.id) {
      throw new Error(`Sauvegarde d'une autre variante (${data.variant}).`);
    }
    const session = new GameSession(
      variant,
      data.options,
      data.deal,
      variant.cloneState(data.state),
      data.history,
      data.startedAt,
    );
    session.elapsedMs = data.elapsedMs;
    session.undoCount = data.undoCount;
    session.hintCount = data.hintCount;
    session.autoCompleted = data.autoCompleted;
    return session;
  }

  /** État courant (ne pas le muter directement : passer par `apply` / `undo`). */
  get state(): S {
    return this.currentState;
  }

  /** Nombre de coups joués (les coups annulés ne comptent plus). */
  get moveCount(): number {
    return this.history.size;
  }

  get canUndo(): boolean {
    return this.history.canUndo;
  }

  /** Le joueur a-t-il déjà touché à cette donne ? */
  get hasStarted(): boolean {
    return this.history.size > 0 || this.undoCount > 0;
  }

  get isWon(): boolean {
    return this.variant.isWon(this.currentState);
  }

  get score(): number {
    return this.variant.score(this.currentState);
  }

  get lastRecord(): R | undefined {
    return this.history.peek();
  }

  /** Joue un coup s'il est légal ; renvoie son enregistrement, sinon null. */
  apply(move: M): R | null {
    if (this.isWon || !this.variant.isLegal(this.currentState, move)) return null;
    const record = this.variant.applyMove(this.currentState, move);
    this.history.push(record);
    return record;
  }

  /** Annule le dernier coup (gratuit et illimité). */
  undo(): R | null {
    const record = this.history.pop();
    if (!record) return null;
    this.variant.undo(this.currentState, record);
    this.undoCount += 1;
    return record;
  }

  /** Relance la même donne depuis le début. */
  restart(now: number = Date.now()): void {
    this.currentState = this.variant.setup(this.deal.seed, this.options);
    this.history.clear();
    this.elapsedMs = 0;
    this.undoCount = 0;
    this.hintCount = 0;
    this.autoCompleted = false;
    this.startedAt = now;
  }

  /** Fait avancer le chrono (arrêté une fois la partie gagnée). */
  tick(deltaMs: number): void {
    if (deltaMs > 0 && !this.isWon) this.elapsedMs += deltaMs;
  }

  serialize(): SessionData<S, O, R> {
    return {
      version: SESSION_VERSION,
      variant: this.variant.id,
      options: this.options,
      deal: this.deal,
      state: this.variant.cloneState(this.currentState),
      history: this.history.toArray(),
      elapsedMs: this.elapsedMs,
      undoCount: this.undoCount,
      hintCount: this.hintCount,
      autoCompleted: this.autoCompleted,
      startedAt: this.startedAt,
    };
  }
}
