/**
 * Direction artistique : palette, typographies et proportions.
 */

export const PALETTE = {
  navy: 0x12355b,
  turquoise: 0x2a9d8f,
  sand: 0xe9d8a6,
  foam: 0xfafaf7,
  coral: 0xe76f51,
  text: 0x1b1b1b,
  /** Tapis bleu-vert profond. */
  tableCenter: 0x13606d,
  tableEdge: 0x0b3a46,
  /** Surbrillance des indices. */
  glow: 0xffd166,
} as const;

export const CSS = {
  navy: '#12355B',
  turquoise: '#2A9D8F',
  sand: '#E9D8A6',
  foam: '#FAFAF7',
  coral: '#E76F51',
  text: '#1B1B1B',
  cardRed: '#C0262D',
  cardBlack: '#1B1B1B',
  cardBorder: '#CFC8B6',
  muted: '#6B7C85',
  panel: '#FAFAF7',
  overlay: 'rgba(8, 30, 38, 0.72)',
} as const;

export const FONTS = {
  ui: '"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  title: 'Georgia, "Times New Roman", serif',
  card: '"Helvetica Neue", Arial, Roboto, sans-serif',
} as const;

/** Proportions des cartes et du tableau (relatives à la taille des cartes). */
export const CARD = {
  /** Hauteur / largeur. */
  aspect: 1.4,
  /** Écart horizontal entre colonnes (× largeur). */
  gap: 0.1,
  radius: 0.085,
  /** Décalage vertical d'une carte cachée / visible (× hauteur), et minimums. */
  faceDownOffset: 0.12,
  faceDownMin: 0.055,
  faceUpOffset: 0.3,
  /** Doit rester ≥ hauteur de l'index du haut des faces (≈ 0,2) pour qu'il reste lisible. */
  faceUpMin: 0.215,
  /** Éventail de la défausse en pioche 3 (× largeur ou × hauteur). */
  wasteFan: 0.24,
  /** Largeur maximale d'une carte, en pixels CSS (grands écrans). */
  maxWidthCss: 132,
} as const;

/** Durées d'animation (ms) ; divisées par REDUCED_MOTION_FACTOR si l'option est active. */
export const ANIM = {
  move: 190,
  moveMax: 320,
  flip: 170,
  snapBack: 200,
  dealStagger: 22,
  cascadeStagger: 85,
  shake: 260,
  hintPulse: 1200,
} as const;

export const REDUCED_MOTION_FACTOR = 3.5;
