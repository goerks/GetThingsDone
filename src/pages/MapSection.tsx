import { useTranslation } from 'react-i18next';
import { MAP_ROWS, effectiveMapRows, featureOn } from '../domain/settings';
import type { MapRows } from '../domain/types';
import { hrefs } from '../router';
import { useApp } from '../state/AppState';

/** Preview of the choice: a row label column and a few cells, the same for both choices. */
function Preview() {
  return (
    <span className="choice__preview" aria-hidden="true">
      {Array.from({ length: 8 }, (_, index) => (
        <i key={index} className={index % 4 === 0 ? 'choice__preview-label' : undefined} />
      ))}
    </span>
  );
}

/**
 * Settings › Story map (#10): what the rows of the story map are. The choice is a team setting, saved at once.
 * The map page links here.
 */
export function MapSection() {
  const { t } = useTranslation();
  const app = useApp();
  const releasesEnabled = featureOn(app.settings, 'releases');
  const rows = effectiveMapRows(app.settings);

  return (
    <div className="map-settings">
      <div className="map-settings__head">
        <h2>{t('settings.map.title')}</h2>
        <a href="#/map" className="map-settings__back">
          {t('settings.map.back')}
        </a>
      </div>
      {!releasesEnabled && (
        <p className="hint hint--warn" role="note">
          {t('settings.map.off')} <a href={hrefs.settingsReleases}>{t('settings.map.toReleases')}</a>
        </p>
      )}
      <fieldset className="choices">
        <legend>{t('settings.map.rows')}</legend>
        <div className="choices__list">
          {MAP_ROWS.map((choice: MapRows) => (
            <label key={choice} className={`choice${rows === choice ? ' choice--selected' : ''}${choice === 'releases' && !releasesEnabled ? ' choice--off' : ''}`}>
              <span className="choice__top">
                <input
                  type="radio"
                  name="map-rows"
                  value={choice}
                  checked={rows === choice}
                  disabled={choice === 'releases' && !releasesEnabled}
                  onChange={() => app.setMapRows(choice)}
                />
                <span className="choice__name">{t(`settings.map.${choice}.name`)}</span>
                {choice === 'sprints' && <span className="badge">{t('settings.map.default')}</span>}
                {choice === 'releases' && !releasesEnabled && <span className="badge badge--off">{t('settings.map.unavailable')}</span>}
              </span>
              <span className="muted">{t(`settings.map.${choice}.hint`)}</span>
              <Preview />
              <span className="muted choice__rows">{t(`settings.map.${choice}.preview`)}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <p className="muted">{t('settings.map.saved')}</p>
      {rows === 'releases' && app.releases.length === 0 && (
        <p className="hint hint--info" role="note">
          {t('settings.map.noReleases')} <a href={hrefs.releases}>{t('settings.map.createRelease')}</a>
        </p>
      )}
    </div>
  );
}
