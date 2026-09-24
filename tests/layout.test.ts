import { describe, expect, it } from 'vitest';
import {
  cardPositions,
  computeKlondikeLayout,
  type LayoutInput,
} from '../src/render/layout/klondikeLayout';
import { CARD } from '../src/config/theme';
import type { CardFace } from '../src/core/games/types';

const phone = (over: Partial<LayoutInput> = {}): LayoutInput => ({
  width: 390 * 3,
  height: 844 * 3,
  dpr: 3,
  safe: { top: 47 * 3, right: 0, bottom: 34 * 3, left: 0 },
  leftHanded: false,
  drawCount: 1,
  bannerHeight: 0,
  uiScale: 1,
  ...over,
});

const column = (down: number, up: number): CardFace[] => [
  ...Array.from({ length: down }, (_, i) => ({ card: i, faceUp: false })),
  ...Array.from({ length: up }, (_, i) => ({ card: 20 + i, faceUp: true })),
];

describe('mise en page du Klondike', () => {
  it('portrait : 7 colonnes dans la largeur, pioche à droite pour un droitier', () => {
    const l = computeKlondikeLayout(phone());
    expect(l.orientation).toBe('portrait');
    const t6 = l.piles.t6 as { x: number };
    expect(t6.x + l.cardW).toBeLessThanOrEqual(390 * 3);
    expect((l.piles.t0 as { x: number }).x).toBeGreaterThanOrEqual(0);
    expect((l.piles.stock as { x: number }).x).toBe(t6.x);
    expect(l.cardH).toBe(Math.floor(l.cardW * CARD.aspect));
    expect(l.toolbar.vertical).toBe(false);
  });

  it('mode gaucher : pioche et fondations inversées', () => {
    const l = computeKlondikeLayout(phone({ leftHanded: true }));
    expect((l.piles.stock as { x: number }).x).toBe((l.piles.t0 as { x: number }).x);
    expect((l.piles.f3 as { x: number }).x).toBe((l.piles.t6 as { x: number }).x);
  });

  it('paysage : disposition latérale et cartes plus grandes qu’en portrait sur la même hauteur', () => {
    const l = computeKlondikeLayout(
      phone({
        width: 844 * 3,
        height: 390 * 3,
        safe: { top: 0, right: 47 * 3, bottom: 21 * 3, left: 47 * 3 },
      }),
    );
    expect(l.orientation).toBe('landscape');
    expect(l.toolbar.vertical).toBe(true);
    const right = Math.max(...Object.values(l.piles).map((p) => p.x)) + l.cardW;
    expect(right).toBeLessThanOrEqual(844 * 3);
    // Les fondations tiennent en hauteur.
    expect((l.piles.f3 as { y: number }).y + l.cardH).toBeLessThanOrEqual(390 * 3);
    const left = computeKlondikeLayout(
      phone({ width: 844 * 3, height: 390 * 3, leftHanded: true }),
    );
    expect(left.toolbar.x).toBe(0);
  });

  it('tablette : cartes plus grandes que sur téléphone, mais plafonnées sur grand écran', () => {
    const tablet = computeKlondikeLayout(
      phone({
        width: 820 * 2,
        height: 1180 * 2,
        dpr: 2,
        safe: { top: 24, right: 0, bottom: 40, left: 0 },
      }),
    );
    const small = computeKlondikeLayout(phone());
    expect(tablet.cardW / 2).toBeGreaterThan(small.cardW / 3);
    const desktop = computeKlondikeLayout(
      phone({ width: 2560, height: 1440, dpr: 1, safe: { top: 0, right: 0, bottom: 0, left: 0 } }),
    );
    expect(desktop.cardW).toBeLessThanOrEqual(CARD.maxWidthCss);
  });

  it('resserre une colonne trop longue pour qu’elle tienne à l’écran', () => {
    const l = computeKlondikeLayout(phone());
    const long = column(6, 13);
    const pos = cardPositions(l, 't6', long, 1);
    const last = pos[pos.length - 1] as { y: number };
    expect(last.y + l.cardH).toBeLessThanOrEqual(l.tableauBottom + 1);
    // L'index des cartes visibles reste lisible (écart minimal respecté).
    const gap = (pos[10] as { y: number }).y - (pos[9] as { y: number }).y;
    expect(gap).toBeGreaterThanOrEqual(Math.floor(l.cardH * CARD.faceUpMin) - 1);
    // Une colonne courte garde les écarts confortables.
    const short = cardPositions(l, 't0', column(1, 3), 1);
    const shortGap = (short[2] as { y: number }).y - (short[1] as { y: number }).y;
    expect(Math.abs(shortGap - l.cardH * CARD.faceUpOffset)).toBeLessThanOrEqual(1);
  });

  it('étale les trois cartes du dessus de la défausse en pioche 3', () => {
    const l = computeKlondikeLayout(phone({ drawCount: 3 }));
    const waste = column(0, 5);
    const pos = cardPositions(l, 'waste', waste, 3);
    const base = l.piles.waste as { x: number; y: number };
    expect(pos[0]).toEqual({ x: base.x, y: base.y });
    expect(pos[1]).toEqual({ x: base.x, y: base.y });
    expect((pos[3] as { x: number }).x).toBe(base.x + l.wasteFan.dx);
    expect((pos[4] as { x: number }).x).toBe(base.x + 2 * l.wasteFan.dx);
    const one = cardPositions(l, 'waste', waste, 1);
    expect(one.every((p) => p.x === base.x)).toBe(true);
    expect(
      cardPositions(l, 'f0', column(0, 3), 1).every((p) => p.x === (l.piles.f0 as { x: number }).x),
    ).toBe(true);
    expect(cardPositions(l, 'nope', column(0, 2), 1)).toEqual([
      { x: 0, y: 0 },
      { x: 0, y: 0 },
    ]);
  });
});

describe('éventail de la défausse en pioche 3 (portrait)', () => {
  it('ne chevauche jamais la pioche ni les fondations', () => {
    for (const leftHanded of [false, true]) {
      const l = computeKlondikeLayout(phone({ drawCount: 3, leftHanded }));
      const waste = l.piles.waste as { x: number };
      const topRight = waste.x + 2 * l.wasteFan.dx + l.cardW;
      const neighbours = leftHanded
        ? [(l.piles.f0 as { x: number }).x]
        : [(l.piles.stock as { x: number }).x];
      for (const x of neighbours) expect(topRight).toBeLessThan(x);
    }
  });
});
