/**
 * Analytics. Phases 1 à 3 : console. Phase 4 : Firebase Analytics, même interface.
 */
export type AnalyticsEvent =
  | 'session_start'
  | 'game_start'
  | 'game_won'
  | 'game_abandoned'
  | 'hint_used'
  | 'undo_count'
  | 'autocomplete_used'
  | 'daily_completed'
  | 'port_reached'
  | 'item_unlocked'
  | 'ad_rewarded_shown'
  | 'ad_interstitial_shown'
  | 'settings_changed';

export type AnalyticsParams = Record<string, string | number | boolean>;

export interface AnalyticsService {
  track(event: AnalyticsEvent, params?: AnalyticsParams): void;
}

export const analytics: AnalyticsService = {
  track(event, params = {}) {
    console.info(`[analytics] ${event}`, params);
  },
};
