import { afterEach, describe, expect, it } from 'vitest';
import { detectLocale, getLocale, rankLabels, setLocale, t } from '../src/i18n';
import { fr } from '../src/i18n/fr';
import { en } from '../src/i18n/en';
import { formatTime } from '../src/render/format';

afterEach(() => setLocale('fr'));

describe('traductions', () => {
  it('ont les mêmes clés dans toutes les langues', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });

  it('remplacent les paramètres', () => {
    expect(t('menu.variant', { draw: 3 })).toBe('Klondike · pioche 3');
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(t('menu.variant', { draw: 1 })).toBe('Klondike · draw 1');
    expect(t('win.bonus')).toContain('{bonus}');
  });

  it('donnent les libellés des rangs (V, D, R en français)', () => {
    expect(rankLabels().slice(-3)).toEqual(['V', 'D', 'R']);
    setLocale('en');
    expect(rankLabels().slice(-3)).toEqual(['J', 'Q', 'K']);
  });

  it('détectent la langue du navigateur', () => {
    expect(detectLocale(['en-GB', 'fr'])).toBe('en');
    expect(detectLocale(['de-DE', 'fr-FR'])).toBe('fr');
    expect(detectLocale(['ja'])).toBe('fr');
    expect(detectLocale([])).toBe('fr');
  });
});

describe('format du temps', () => {
  it('affiche minutes et secondes, puis les heures', () => {
    expect(formatTime(0)).toBe('00:00');
    expect(formatTime(65_400)).toBe('01:05');
    expect(formatTime(3_725_000)).toBe('1:02:05');
    expect(formatTime(-5)).toBe('00:00');
  });
});
