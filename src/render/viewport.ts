import type { Insets } from './layout/klondikeLayout';

/**
 * Écran : le canevas est dimensionné en pixels physiques (net sur les écrans
 * haute densité) puis réduit en CSS. Les marges de sécurité (encoches) sont
 * lues via une sonde CSS `env(safe-area-inset-*)`.
 */

export const MAX_DPR = 3;

export function devicePixelRatio(): number {
  return Math.min(MAX_DPR, Math.max(1, globalThis.devicePixelRatio || 1));
}

export function cssViewport(): { width: number; height: number } {
  const vv = globalThis.visualViewport;
  return {
    width: Math.round(vv?.width ?? globalThis.innerWidth),
    height: Math.round(vv?.height ?? globalThis.innerHeight),
  };
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
