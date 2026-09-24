/**
 * Qualité adaptative : si l'appareil peine (images par seconde en baisse), on
 * allège d'abord les effets d'ambiance du décor, jamais les cartes. On remonte
 * prudemment quand tout redevient fluide.
 *
 * Niveaux : 2 = tout, 1 = ambiance allégée, 0 = décor fixe.
 */
export type QualityLevel = 0 | 1 | 2;

export class QualityMonitor {
  private level: QualityLevel = 2;
  private avgFrameMs = 16.7;
  private slowFor = 0;
  private fastFor = 0;
  private warmup = 1500;

  constructor(
    private readonly onChange: (level: QualityLevel) => void,
    private maxLevel: QualityLevel = 2,
    start: QualityLevel = maxLevel,
  ) {
    this.level = Math.min(start, maxLevel) as QualityLevel;
  }

  get current(): QualityLevel {
    return this.level;
  }

  /** Plafond imposé (ex. : « animations réduites » ⇒ 0) ; on repart de ce plafond. */
  setMax(max: QualityLevel): void {
    this.maxLevel = max;
    this.set(max);
  }

  private set(level: QualityLevel): void {
    if (level === this.level) return;
    this.level = level;
    this.slowFor = 0;
    this.fastFor = 0;
    this.onChange(level);
  }

  /** À appeler à chaque image avec la durée de l'image (ms). */
  sample(deltaMs: number): void {
    // Les pauses (onglet masqué, dialogue système) ne comptent pas.
    if (deltaMs <= 0 || deltaMs > 250) return;
    if (this.warmup > 0) {
      this.warmup -= deltaMs;
      return;
    }
    this.avgFrameMs += (deltaMs - this.avgFrameMs) * 0.05;
    if (this.avgFrameMs > 21) {
      this.slowFor += deltaMs;
      this.fastFor = 0;
      if (this.slowFor > 2000 && this.level > 0) this.set((this.level - 1) as QualityLevel);
    } else if (this.avgFrameMs < 17.8) {
      this.fastFor += deltaMs;
      this.slowFor = 0;
      if (this.fastFor > 12000 && this.level < this.maxLevel) {
        this.set((this.level + 1) as QualityLevel);
      }
    } else {
      this.slowFor = Math.max(0, this.slowFor - deltaMs);
    }
  }
}

/**
 * Niveau de départ : les appareils modestes (peu de cœurs ou de mémoire)
 * commencent avec une ambiance allégée ; le suivi des images par seconde
 * remonte ensuite le niveau si tout est fluide.
 */
export function initialQuality(): QualityLevel {
  const nav = globalThis.navigator as (Navigator & { deviceMemory?: number }) | undefined;
  const cores = nav?.hardwareConcurrency ?? 4;
  const memory = nav?.deviceMemory ?? 4;
  return cores <= 4 || memory <= 2 ? 1 : 2;
}
