import { useTranslation } from 'react-i18next';
import { FEATURE_KEYS } from '../domain/settings';
import { useApp } from '../state/AppState';

/**
 * Settings › Features (#10): feature toggles of the team. A feature that is off is hidden everywhere, but nothing is
 * deleted, so switching it on again brings everything back. Saved at once.
 */
export function FeaturesSection() {
  const { t } = useTranslation();
  const app = useApp();

  return (
    <div className="map-settings">
      <div className="map-settings__head">
        <h2>{t('settings.features.title')}</h2>
      </div>
      <p className="muted">{t('settings.features.hint')}</p>
      <ul className="features">
        {FEATURE_KEYS.map((key) => {
          const on = app.settings.features[key];
          return (
            <li key={key} className="feature">
              <label className="check feature__toggle">
                <input type="checkbox" role="switch" checked={on} onChange={(event) => app.setFeature(key, event.target.checked)} />
                <span className="feature__name">{t(`settings.features.${key}.name`)}</span>
                <span className={`badge${on ? '' : ' badge--off'}`}>{t(on ? 'settings.features.on' : 'settings.features.off')}</span>
              </label>
              <p className="muted feature__text">{t(`settings.features.${key}.description`)}</p>
              {!on && <p className="muted feature__text">{t(`settings.features.${key}.offNote`)}</p>}
            </li>
          );
        })}
      </ul>
      <p className="muted">{t('settings.features.saved')}</p>
    </div>
  );
}
