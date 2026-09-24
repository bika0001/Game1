/**
 * Retour haptique très léger, désactivable.
 * Web : navigator.vibrate. Mobile (phase 3) : @capacitor/haptics, même interface.
 */
export interface HapticsService {
  setEnabled(enabled: boolean): void;
  /** Pose d'une carte. */
  light(): void;
  /** Coup refusé. */
  medium(): void;
  /** Victoire. */
  success(): void;
}

function createWebHaptics(): HapticsService {
  let enabled = true;
  const vibrate = (pattern: number | number[]): void => {
    if (!enabled) return;
    try {
      globalThis.navigator?.vibrate?.(pattern);
    } catch {
      // non supporté
    }
  };
  return {
    setEnabled: (value) => {
      enabled = value;
    },
    light: () => vibrate(8),
    medium: () => vibrate(18),
    success: () => vibrate([12, 60, 12]),
  };
}

export const haptics: HapticsService = createWebHaptics();
