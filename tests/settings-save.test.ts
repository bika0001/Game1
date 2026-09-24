import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, NEXT_GAME_SETTINGS, normalizeSettings } from '../src/core/settings';
import { createSave, migrateSave, SAVE_VERSION } from '../src/core/save';
import { GameSession } from '../src/core/session';
import { klondike } from '../src/core/games/klondike';

describe('réglages', () => {
  it('ont des valeurs par défaut conformes à la spécification', () => {
    expect(DEFAULT_SETTINGS).toMatchObject({
      drawCount: 1,
      winnableOnly: true,
      limitedPasses: false,
      scoring: 'standard',
      showTimer: false,
      leftHanded: false,
      decor: 'lagoon',
    });
    expect(NEXT_GAME_SETTINGS).toContain('drawCount');
  });

  it('complètent des réglages partiels ou invalides', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(42, 'en').locale).toBe('en');
    const s = normalizeSettings({
      drawCount: 3,
      scoring: 'none',
      showTimer: true,
      sound: 'oui',
      locale: 'de',
      leftHanded: true,
      decor: 'classic',
    });
    expect(s.drawCount).toBe(3);
    expect(s.scoring).toBe('none');
    expect(s.showTimer).toBe(true);
    expect(s.sound).toBe(DEFAULT_SETTINGS.sound);
    expect(s.locale).toBe('fr');
    expect(s.leftHanded).toBe(true);
    expect(s.decor).toBe('classic');
    expect(normalizeSettings({ drawCount: 2, locale: 'en', decor: 'moon' })).toMatchObject({
      drawCount: 1,
      locale: 'en',
      decor: 'lagoon',
    });
  });
});

describe('sauvegarde', () => {
  const session = GameSession.start(
    klondike,
    { drawCount: 1, maxPasses: null },
    { seed: 3, source: 'bank', bankIndex: 2 },
  );
  session.apply({ type: 'draw' });

  it('crée une sauvegarde neuve', () => {
    const save = createSave(1234, 'en');
    expect(save.version).toBe(SAVE_VERSION);
    expect(save.installedAt).toBe(1234);
    expect(save.settings.locale).toBe('en');
    expect(save.currentGame).toBeNull();
    expect(save.gamesStarted).toBe(0);
  });

  it('relit une sauvegarde au format courant, partie en cours comprise', () => {
    const raw = JSON.parse(
      JSON.stringify({
        ...createSave(10),
        currentGame: session.serialize(),
        playedDeals: { 'klondike-draw1': 'AQ==' },
        gamesStarted: 4,
        gamesWon: 2,
      }),
    );
    const save = migrateSave(raw, 99);
    expect(save.installedAt).toBe(10);
    expect(save.gamesStarted).toBe(4);
    expect(save.gamesWon).toBe(2);
    expect(save.playedDeals['klondike-draw1']).toBe('AQ==');
    const restored = GameSession.restore(
      klondike,
      save.currentGame as NonNullable<typeof save.currentGame>,
    );
    expect(restored.moveCount).toBe(1);
  });

  it('répare les champs manquants ou invalides', () => {
    const save = migrateSave(
      { version: SAVE_VERSION, currentGame: { variant: 'spider' }, playedDeals: 3 },
      7,
      'en',
    );
    expect(save.installedAt).toBe(7);
    expect(save.currentGame).toBeNull();
    expect(save.playedDeals).toEqual({});
    expect(save.gamesStarted).toBe(0);
    expect(save.gamesWon).toBe(0);
    expect(save.settings.locale).toBe('en');
  });

  it('repart de zéro sur une donnée illisible, trop ancienne ou future', () => {
    expect(migrateSave(null, 5).installedAt).toBe(5);
    expect(migrateSave('texte', 5).currentGame).toBeNull();
    expect(migrateSave({ version: SAVE_VERSION + 1, gamesWon: 9 }, 5).gamesWon).toBe(0);
    expect(migrateSave({ gamesWon: 9 }, 5).gamesWon).toBe(0); // version 0 : aucune migration connue
  });
});

describe('migrations de sauvegarde', () => {
  it('enchaîne les étapes de migration jusqu’à la version cible', () => {
    const migrations = {
      0: (raw: Record<string, unknown>) => ({ ...raw, version: 1, gamesWon: raw.wins }),
      1: (raw: Record<string, unknown>) => ({ ...raw, version: 2, installedAt: 77 }),
    };
    const save = migrateSave({ wins: 5 }, 1, 'fr', migrations, 2);
    expect(save.gamesWon).toBe(5);
    expect(save.installedAt).toBe(77);
    expect(save.version).toBe(SAVE_VERSION);
  });
});
