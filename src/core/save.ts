import type { SessionData } from './session';
import type { KlondikeOptions, KlondikeRecord, KlondikeState } from './games/klondike/rules';
import { normalizeSettings, type Locale, type Settings } from './settings';

/**
 * Format de sauvegarde versionné, avec migrations.
 * Toute évolution du format incrémente SAVE_VERSION et ajoute une étape dans MIGRATIONS.
 */

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'solitaire-tides/save';

export type KlondikeSessionData = SessionData<KlondikeState, KlondikeOptions, KlondikeRecord>;

export interface SaveData {
  readonly version: number;
  readonly installedAt: number;
  readonly settings: Settings;
  /** Partie en cours (y compris l'historique d'annulation), ou null. */
  readonly currentGame: KlondikeSessionData | null;
  /** Donnes déjà jouées par banque (ensembles de bits en base64). */
  readonly playedDeals: Readonly<Record<string, string>>;
  /** Parties commencées depuis l'installation (règles des interstitielles, phase 2). */
  readonly gamesStarted: number;
  readonly gamesWon: number;
}

export function createSave(now: number, locale: Locale = 'fr'): SaveData {
  return {
    version: SAVE_VERSION,
    installedAt: now,
    settings: normalizeSettings({}, locale),
    currentGame: null,
    playedDeals: {},
    gamesStarted: 0,
    gamesWon: 0,
  };
}

export type RawSave = Record<string, unknown> & { version?: unknown };
export type Migrations = Readonly<Record<number, (raw: RawSave) => RawSave>>;

/** Étapes de migration : MIGRATIONS[n] transforme une sauvegarde version n en version n + 1. */
export const MIGRATIONS: Migrations = {};

/**
 * Lit une sauvegarde brute (quelle que soit sa version) et renvoie une sauvegarde
 * valide au format courant. Une donnée illisible donne une sauvegarde neuve.
 */
export function migrateSave(
  raw: unknown,
  now: number,
  locale: Locale = 'fr',
  migrations: Migrations = MIGRATIONS,
  targetVersion: number = SAVE_VERSION,
): SaveData {
  if (typeof raw !== 'object' || raw === null) return createSave(now, locale);
  let data = raw as RawSave;
  let version = typeof data.version === 'number' ? data.version : 0;
  if (version > targetVersion) return createSave(now, locale); // sauvegarde d'une version future
  while (version < targetVersion) {
    const step = migrations[version];
    if (!step) return createSave(now, locale);
    data = step(data);
    version += 1;
  }
  const game = data.currentGame as KlondikeSessionData | null | undefined;
  return {
    version: SAVE_VERSION,
    installedAt: typeof data.installedAt === 'number' ? data.installedAt : now,
    settings: normalizeSettings(data.settings, locale),
    currentGame: game && typeof game === 'object' && game.variant === 'klondike' ? game : null,
    playedDeals:
      typeof data.playedDeals === 'object' && data.playedDeals !== null
        ? (data.playedDeals as Record<string, string>)
        : {},
    gamesStarted: typeof data.gamesStarted === 'number' ? data.gamesStarted : 0,
    gamesWon: typeof data.gamesWon === 'number' ? data.gamesWon : 0,
  };
}
