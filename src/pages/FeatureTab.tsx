import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { FeatureKey } from '../domain/types';
import { useApp } from '../state/AppState';

/**
 * Settings tab of a feature (#61): the switch at the top, saved at once, and below it the settings of the feature.
 * While the feature is off the tab is a start page: what the feature does, that its data is kept, and a button to
 * switch it on. Nothing is deleted by switching it off.
 */
export function FeatureTab({ feature, children }: { feature: FeatureKey; children?: ReactNode }) {
  const { t } = useTranslation();
  const app = useApp();
  const on = app.settings.features[feature];
  const name = t(`settings.features.${feature}.name`);

  return (
    <div className="feature-tab">
      <div className="map-settings__head feature-tab__head">
        <h2>{name}</h2>
        <label className="check feature__toggle">
          <input type="checkbox" role="switch" aria-label={name} checked={on} onChange={(event) => app.setFeature(feature, event.target.checked)} />
          <span>{t(on ? 'settings.features.enabled' : 'settings.features.disabled')}</span>
        </label>
      </div>
      <p className="muted">{t(`settings.features.${feature}.description`)}</p>
      {on ? (
        children
      ) : (
        <div className="feature-tab__start">
          <p className="muted">{t(`settings.features.${feature}.offNote`)}</p>
          <div>
            <button type="button" className="btn btn--primary" onClick={() => app.setFeature(feature, true)}>
              {t('settings.features.switchOn', { name })}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
