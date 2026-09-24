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
  gold: 0xffc857,
  coralDark: 0xc2553b,
  turquoiseDark: 0x1f7a6f,
  foamShade: 0xd9e6e3,
  deep: 0x0b2a3a,
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
  gold: '#FFC857',
  deep: '#0B2A3A',
} as const;

export const FONTS = {
  /** Police arrondie et chaleureuse (titres, boutons, compteurs), embarquée (OFL). */
  display: 'Fredoka, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
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
  /** Éventail de la défausse en pioche 3 : horizontal (× largeur, laisse lire « 10 » en entier)… */
  wasteFanX: 0.45,
  /** … ou vertical en paysage (× hauteur, laisse lire tout l'index). */
  wasteFanY: 0.24,
  /** Largeur maximale d'une carte, en pixels CSS (grands écrans). */
  maxWidthCss: 132,
} as const;

/** Durées d'animation (ms) ; divisées par REDUCED_MOTION_FACTOR si l'option est active. */
export const ANIM = {
  /** Vol d'une carte : durée de base et maximum (la durée croît avec la distance). */
  move: 250,
  moveMax: 430,
  /** Glisser-déposer : atterrissage depuis le doigt, retour en cas de refus. */
  drop: 170,
  snapBack: 260,
  flip: 250,
  deal: 360,
  dealStagger: 38,
  shake: 300,
} as const;

export const REDUCED_MOTION_FACTOR = 3.5;
