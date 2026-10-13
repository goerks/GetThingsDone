import { featureOn } from '../domain/settings';
import type { FeatureKey } from '../domain/types';
import { useApp } from '../state/AppState';

/** Whether a feature toggle is on (Settings › Features). */
export function useFeature(key: FeatureKey): boolean {
  return featureOn(useApp().settings, key);
}
