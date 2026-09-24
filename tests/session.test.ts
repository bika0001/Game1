import { describe, expect, it } from 'vitest';
import { GameSession, SESSION_VERSION } from '../src/core/session';
import { klondike, DRAW, type KlondikeMove } from '../src/core/games/klondike';

const options = { drawCount: 1 as const, maxPasses: null };
const deal = { seed: 7, source: 'bank' as const, bankIndex: 6 };

describe('session de jeu', () => {
  it('joue, annule et relance la donne', () => {
    const session = GameSession.start(klondike, options, deal, 1000);
    expect(session.hasStarted).toBe(false);
    expect(session.canUndo).toBe(false);
    expect(session.undo()).toBeNull();
    const initial = klondike.cloneState(session.state);
    expect(session.apply(DRAW)).not.toBeNull();
    expect(session.moveCount).toBe(1);
    expect(session.lastRecord?.move).toEqual(DRAW);
    expect(session.hasStarted).toBe(true);
    expect(session.apply({ type: 'move', from: 't0', to: 't0', count: 1 })).toBeNull();
    expect(session.undo()?.move).toEqual(DRAW);
    expect(session.undoCount).toBe(1);
    expect(session.state).toEqual(initial);
    session.apply(DRAW);
    session.tick(1500);
    session.tick(-5);
    expect(session.elapsedMs).toBe(1500);
    session.hintCount = 2;
    session.restart(2000);
    expect(session.state).toEqual(initial);
    expect(session.moveCount).toBe(0);
    expect(session.elapsedMs).toBe(0);
    expect(session.hintCount).toBe(0);
    expect(session.startedAt).toBe(2000);
    expect(session.score).toBe(0);
    expect(session.isWon).toBe(false);
  });

  it('sérialise tout, y compris l’historique d’annulation', () => {
    const session = GameSession.start(klondike, options, deal, 1000);
    for (let i = 0; i < 30; i++) {
      const move = klondike.heuristicHint(session.state) as KlondikeMove;
      if (!move) break;
      session.apply(move);
    }
    session.tick(4200);
    session.hintCount = 1;
    session.autoCompleted = true;
    const data = JSON.parse(JSON.stringify(session.serialize()));
    expect(data.version).toBe(SESSION_VERSION);
    const restored = GameSession.restore(klondike, data);
    expect(restored.state).toEqual(session.state);
    expect(restored.moveCount).toBe(session.moveCount);
    expect(restored.elapsedMs).toBe(4200);
    expect(restored.hintCount).toBe(1);
    expect(restored.autoCompleted).toBe(true);
    expect(restored.deal).toEqual(deal);
    // L'historique restauré permet de tout annuler jusqu'à la donne.
    while (restored.undo());
    expect(restored.state).toEqual(klondike.setup(deal.seed, options));
  });

  it('refuse une sauvegarde d’une autre variante', () => {
    const data = {
      ...GameSession.start(klondike, options, deal).serialize(),
      variant: 'spider' as const,
    };
    expect(() => GameSession.restore(klondike, data)).toThrow(/variante/);
  });

  it('arrête le chrono et refuse les coups une fois la partie gagnée', () => {
    const session = GameSession.start(klondike, options, deal);
    const state = session.state;
    // On force une position gagnée.
    state.foundations = [0, 1, 2, 3].map((suit) =>
      Array.from({ length: 13 }, (_, r) => r * 4 + suit),
    );
    state.tableau.forEach((c) => {
      c.cards = [];
      c.faceDown = 0;
    });
    state.stock = [];
    state.waste = [];
    expect(session.isWon).toBe(true);
    session.tick(1000);
    expect(session.elapsedMs).toBe(0);
    expect(session.apply(DRAW)).toBeNull();
  });
});
