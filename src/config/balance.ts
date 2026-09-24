/**
 * Valeurs d'équilibrage. Tout nombre qui règle le ressenti du jeu vit ici.
 */

/** Score standard du Klondike (pas de scoring « Vegas »). */
export const KLONDIKE_SCORING = {
  wasteToTableau: 5,
  toFoundation: 10,
  flip: 5,
  foundationToTableau: -15,
  recycle: 0,
  /** Le score ne descend jamais sous ce plancher. */
  minScore: 0,
} as const;

/** Bonus de temps à la victoire (seulement si le chrono est affiché) : numerator / max(secondes, minSeconds). */
export const TIME_BONUS = {
  numerator: 700_000,
  minSeconds: 30,
} as const;

/** Nombre de passages dans la pioche quand l'option « limité » est choisie. */
export const LIMITED_PASSES = {
  draw1: 1,
  draw3: 3,
} as const;

/** Solveur. */
export const SOLVER = {
  /** Limite de nœuds pour un indice (Web Worker). */
  hintMaxNodes: 200_000,
  /** Temps maximal pour un indice avant de basculer sur l'heuristique. */
  hintMaxTimeMs: 1_500,
  /** Limite de nœuds pour la génération de la banque de donnes (déterministe). */
  bankMaxNodes: 250_000,
} as const;

/** Détection « plus aucun coup possible » : taille maximale de l'exploration. */
export const BLOCK_DETECTION_MAX_NODES = 20_000;

/** Monétisation (phase 2 : pubs simulées ; phase 3 : AdMob). */
export const ADS = {
  interstitialMinGamesBeforeFirst: 3,
  interstitialEveryNGames: 2,
  interstitialMinIntervalSec: 120,
  freeHintsPerDay: 3,
  hintsPerRewardedAd: 3,
  bannerInGame: true,
} as const;
