import type { Insets } from './layout/klondikeLayout';

/**
 * Écran : le canevas est dimensionné en pixels physiques (net sur les écrans
 * haute densité) puis réduit en CSS. Les marges de sécurité (encoches) sont
 * lues via une sonde CSS `env(safe-area-inset-*)`.
 */

export const MAX_DPR = 3;
/** Budget de pixels du canevas : au-delà, la fluidité passe avant la finesse. */
export const MAX_CANVAS_PIXELS = 6_500_000;

export function cssViewport(): { width: number; height: number } {
  const vv = globalThis.visualViewport;
  return {
    width: Math.max(1, Math.round(vv?.width ?? globalThis.innerWidth)),
    height: Math.max(1, Math.round(vv?.height ?? globalThis.innerHeight)),
  };
}

/**
 * Densité de rendu effective. Certaines vues web intégrées (et certains cadres)
 * annoncent 1 sur des téléphones à écran haute densité : le jeu serait alors
 * flou. Sur un appareil tactile de taille téléphone ou tablette, on rend au
 * moins en 2,5×. Le total de pixels reste plafonné pour préserver la fluidité.
 */
export function devicePixelRatio(): number {
  const reported = globalThis.devicePixelRatio || 1;
  const nav = globalThis.navigator as Navigator | undefined;
  const touch = (nav?.maxTouchPoints ?? 0) > 0;
  const screenShort = Math.min(globalThis.screen?.width ?? 0, globalThis.screen?.height ?? 0);
  let dpr = reported;
  if (touch && screenShort > 0 && screenShort < 1100 && reported < 2) dpr = 2.5;
  dpr = Math.min(MAX_DPR, Math.max(1, dpr));
  const { width, height } = cssViewport();
  const budget = Math.sqrt(MAX_CANVAS_PIXELS / (width * height));
  return Math.max(1, Math.min(dpr, budget));
}

/** Marges de sécurité en pixels physiques. */
export function safeInsets(dpr: number): Insets {
  const probe = document.getElementById('safe-area-probe');
  if (!probe) return { top: 0, right: 0, bottom: 0, left: 0 };
  const style = getComputedStyle(probe);
  const px = (v: string): number => (parseFloat(v) || 0) * dpr;
  return {
    top: px(style.top),
    right: px(style.right),
    bottom: px(style.bottom),
    left: px(style.left),
  };
}
