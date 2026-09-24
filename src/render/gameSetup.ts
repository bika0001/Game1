import type Phaser from 'phaser';
import { rankLabels } from '../i18n';
import { app } from './app';
import { generateCardTextures, type CardMetrics } from './cardart/textures';
import { prepareDecorTexture } from './decor/decors';
import { ensureFxTextures } from './decor/fxTextures';
import { computeKlondikeLayout, type KlondikeLayout } from './layout/klondikeLayout';
import { devicePixelRatio, safeInsets } from './viewport';

/** Mise en page du Klondike pour l'écran courant. */
export function klondikeLayoutFor(
  scene: Phaser.Scene,
  dpr: number,
  drawCount: 1 | 3,
): KlondikeLayout {
  return computeKlondikeLayout({
    width: scene.scale.width,
    height: scene.scale.height,
    dpr,
    safe: safeInsets(dpr),
    leftHanded: app.settings.leftHanded,
    drawCount,
    bannerHeight: 0,
    uiScale: 1,
  });
}

/** Textures des cartes à la taille de la mise en page (régénérées seulement si elle change). */
export function cardTexturesFor(scene: Phaser.Scene, layout: KlondikeLayout): CardMetrics {
  const labels = rankLabels();
  return generateCardTextures(scene, layout.cardW, layout.cardH, {
    rankLabels: labels,
    back: 'waves',
    aceLabel: labels[0] ?? 'A',
  });
}

/** Ligne où reposent les objets du décor : juste au-dessus de la barre d'outils. */
export function floorBottomFor(scene: Phaser.Scene, layout: KlondikeLayout, dpr: number): number {
  return layout.toolbar.vertical ? scene.scale.height - safeInsets(dpr).bottom : layout.toolbar.y;
}

/**
 * Prépare pendant le menu les textures coûteuses de la partie (fond du décor,
 * cartes, effets) : au lancement, la donne commence sans temps mort.
 */
export function prewarmGame(scene: Phaser.Scene): void {
  const dpr = devicePixelRatio();
  const layout = klondikeLayoutFor(scene, dpr, app.settings.drawCount);
  ensureFxTextures(scene, dpr);
  prepareDecorTexture(scene, app.settings.decor, {
    width: scene.scale.width,
    height: scene.scale.height,
    dpr,
    floorBottom: floorBottomFor(scene, layout, dpr),
  });
  cardTexturesFor(scene, layout);
}
