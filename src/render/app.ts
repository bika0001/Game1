import { bankKey, loadBank, pickDeal } from '../core/deals';
import {
  klondike,
  defaultMaxPasses,
  type KlondikeMove,
  type KlondikeOptions,
  type KlondikeRecord,
  type KlondikeState,
} from '../core/games/klondike';
import { PlayedDeals } from '../core/playedDeals';
import { createRng, randomSeed } from '../core/rng';
import { createSave, migrateSave, SAVE_KEY, type SaveData } from '../core/save';
import { GameSession, type DealInfo } from '../core/session';
import type { Settings } from '../core/settings';
import { detectLocale, setLocale } from '../i18n';
import { analytics } from '../services/analytics';
import { audio } from '../services/audio';
import { haptics } from '../services/haptics';
import { SolverClient } from '../services/solverClient';
import { storage } from '../services/storage';

export type KlondikeSession = GameSession<
  KlondikeState,
  KlondikeMove,
  KlondikeOptions,
  KlondikeRecord
>;

/**
 * Contexte de l'application partagé par les scènes : sauvegarde, réglages,
 * services et création des parties.
 */
class App {
  private data: SaveData = createSave(Date.now());
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private listeners = new Set<
    (settings: Settings, changed: ReadonlyArray<keyof Settings>) => void
  >();
  private active: KlondikeSession | null = null;
  readonly solver = new SolverClient();

  get save(): SaveData {
    return this.data;
  }

  get settings(): Settings {
    return this.data.settings;
  }

  async load(): Promise<void> {
    const raw = await storage.get<unknown>(SAVE_KEY);
    this.data = migrateSave(raw, Date.now(), detectLocale());
    this.applyServices();
    analytics.track('session_start', { hasGame: this.data.currentGame !== null });
  }

  private applyServices(): void {
    setLocale(this.data.settings.locale);
    audio.setEnabled(this.data.settings.sound);
    haptics.setEnabled(this.data.settings.haptics);
  }

  onSettingsChange(
    listener: (settings: Settings, changed: ReadonlyArray<keyof Settings>) => void,
  ): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  updateSettings(patch: Partial<Settings>): void {
    const before = this.data.settings;
    const after = { ...before, ...patch };
    const changed = (Object.keys(patch) as Array<keyof Settings>).filter(
      (k) => before[k] !== after[k],
    );
    if (changed.length === 0) return;
    this.data = { ...this.data, settings: after };
    this.applyServices();
    analytics.track('settings_changed', { keys: changed.join(',') });
    for (const listener of this.listeners) listener(after, changed);
    this.persistSoon();
  }

  // --- Parties -------------------------------------------------------------

  hasResumableGame(): boolean {
    return this.data.currentGame !== null;
  }

  resumeSession(): KlondikeSession | null {
    const game = this.data.currentGame;
    if (!game) return null;
    try {
      const session = GameSession.restore(klondike, game);
      return session.isWon ? null : session;
    } catch {
      return null;
    }
  }

  /** Nouvelle donne selon les réglages (banque gagnable ou aléatoire). */
  async newSession(): Promise<KlondikeSession> {
    const s = this.data.settings;
    const options: KlondikeOptions = {
      drawCount: s.drawCount,
      maxPasses: defaultMaxPasses(s.drawCount, s.limitedPasses),
    };
    let deal: DealInfo;
    if (s.winnableOnly) {
      const key = bankKey(s.drawCount, s.limitedPasses);
      const bank = await loadBank(key);
      const played = new PlayedDeals(bank.seeds.length, this.data.playedDeals[key]);
      const pick = pickDeal(bank, played, createRng(randomSeed()));
      this.data = {
        ...this.data,
        playedDeals: { ...this.data.playedDeals, [key]: played.serialize() },
      };
      deal = { seed: pick.seed, source: 'bank', bankIndex: pick.index };
    } else {
      deal = { seed: randomSeed(), source: 'random' };
    }
    const session = GameSession.start(klondike, options, deal);
    this.data = { ...this.data, gamesStarted: this.data.gamesStarted + 1 };
    analytics.track('game_start', {
      variant: 'klondike',
      draw: options.drawCount,
      passes: options.maxPasses ?? 0,
      winnable: s.winnableOnly,
      deal: deal.bankIndex ?? -1,
    });
    this.storeSession(session);
    return session;
  }

  /** Relance la même donne (compte comme une nouvelle tentative). */
  replaySession(session: KlondikeSession): void {
    this.trackAbandon(session);
    session.restart();
    this.data = { ...this.data, gamesStarted: this.data.gamesStarted + 1 };
    analytics.track('game_start', {
      variant: 'klondike',
      draw: session.options.drawCount,
      replay: true,
    });
    this.storeSession(session);
  }

  trackAbandon(session: KlondikeSession): void {
    if (!session.hasStarted || session.isWon) return;
    analytics.track('game_abandoned', {
      moves: session.moveCount,
      seconds: Math.round(session.elapsedMs / 1000),
    });
    analytics.track('undo_count', { count: session.undoCount });
  }

  recordWin(session: KlondikeSession, score: number): void {
    analytics.track('game_won', {
      seconds: Math.round(session.elapsedMs / 1000),
      moves: session.moveCount,
      score,
      autocomplete: session.autoCompleted,
    });
    analytics.track('undo_count', { count: session.undoCount });
    this.data = { ...this.data, currentGame: null, gamesWon: this.data.gamesWon + 1 };
    this.persistNow();
  }

  storeSession(session: KlondikeSession): void {
    this.data = { ...this.data, currentGame: session.isWon ? null : session.serialize() };
    this.persistSoon();
  }

  /** Partie affichée (sauvegardée quand l'app passe en arrière-plan). */
  setActiveSession(session: KlondikeSession | null): void {
    this.active = session;
  }

  /** Sauvegarde immédiate (mise en arrière-plan, fermeture). */
  flush(): void {
    if (this.active && !this.active.isWon) {
      this.data = { ...this.data, currentGame: this.active.serialize() };
    }
    this.persistNow();
  }

  // --- Persistance ---------------------------------------------------------

  persistSoon(delayMs = 250): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => this.persistNow(), delayMs);
  }

  persistNow(): void {
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = null;
    void storage.set(SAVE_KEY, this.data);
  }
}

export const app = new App();
