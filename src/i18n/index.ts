import { fr, type MessageKey } from './fr';
import { en } from './en';
import type { Locale } from '../core/settings';

/**
 * Traductions. Le français est la langue de référence ; les langues de la
 * phase 2 (pt, es, de, it) s'ajoutent ici avec les mêmes clés.
 */

const DICTIONARIES: Record<Locale, Record<MessageKey, string>> = { fr, en };

export const LOCALES: readonly Locale[] = ['fr', 'en'];
export const LOCALE_NAMES: Record<Locale, string> = { fr: 'Français', en: 'English' };

let current: Locale = 'fr';

export function detectLocale(
  languages: readonly string[] = globalThis.navigator?.languages ?? [],
): Locale {
  for (const lang of languages) {
    const code = lang.slice(0, 2).toLowerCase();
    if ((LOCALES as readonly string[]).includes(code)) return code as Locale;
  }
  return 'fr';
}

export function setLocale(locale: Locale): void {
  current = locale;
}

export function getLocale(): Locale {
  return current;
}

export function t(key: MessageKey, params: Record<string, string | number> = {}): string {
  const template = DICTIONARIES[current][key] ?? fr[key];
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

/** Libellés des rangs (A … R en français, A … K en anglais). */
export function rankLabels(): string[] {
  return t('cards.ranks').split(',');
}

export type { MessageKey };
