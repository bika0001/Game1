/**
 * Réglages du joueur (valeurs par défaut conformes à la spécification).
 */

export type Locale = 'fr' | 'en';
export type ScoringMode = 'standard' | 'none';

export interface Settings {
  readonly drawCount: 1 | 3;
  /** Donnes vérifiées gagnables (sinon aléatoires). */
  readonly winnableOnly: boolean;
  readonly limitedPasses: boolean;
  readonly scoring: ScoringMode;
  readonly showTimer: boolean;
  readonly leftHanded: boolean;
  readonly sound: boolean;
  readonly haptics: boolean;
  readonly reducedMotion: boolean;
  readonly locale: Locale;
}

export const DEFAULT_SETTINGS: Settings = {
  drawCount: 1,
  winnableOnly: true,
  limitedPasses: false,
  scoring: 'standard',
  showTimer: false,
  leftHanded: false,
  sound: true,
  haptics: true,
  reducedMotion: false,
  locale: 'fr',
};

/** Complète des réglages partiels ou anciens avec les valeurs par défaut. */
export function normalizeSettings(raw: unknown, fallbackLocale: Locale = 'fr'): Settings {
  const input = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const bool = (key: keyof Settings, def: boolean): boolean =>
    typeof input[key] === 'boolean' ? (input[key] as boolean) : def;
  return {
    drawCount: input.drawCount === 3 ? 3 : 1,
    winnableOnly: bool('winnableOnly', DEFAULT_SETTINGS.winnableOnly),
    limitedPasses: bool('limitedPasses', DEFAULT_SETTINGS.limitedPasses),
    scoring: input.scoring === 'none' ? 'none' : 'standard',
    showTimer: bool('showTimer', DEFAULT_SETTINGS.showTimer),
    leftHanded: bool('leftHanded', DEFAULT_SETTINGS.leftHanded),
    sound: bool('sound', DEFAULT_SETTINGS.sound),
    haptics: bool('haptics', DEFAULT_SETTINGS.haptics),
    reducedMotion: bool('reducedMotion', DEFAULT_SETTINGS.reducedMotion),
    locale: input.locale === 'en' || input.locale === 'fr' ? input.locale : fallbackLocale,
  };
}

/** Réglages qui ne s'appliquent qu'à la prochaine donne. */
export const NEXT_GAME_SETTINGS: ReadonlyArray<keyof Settings> = [
  'drawCount',
  'winnableOnly',
  'limitedPasses',
];
