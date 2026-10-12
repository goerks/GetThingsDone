import { useTranslation } from 'react-i18next';
import { useApp } from '../state/AppState';

/**
 * Settings › Releases (#10): whether the team plans with releases at all. Off hides the Releases page, the release
 * field of stories and the release rows of the story map; nothing is deleted, so switching on again brings everything back.
 */
export function ReleasesSection() {
  const { t } = useTranslation();
  const app = useApp();
  const enabled = app.settings.releasesEnabled;

  return (
    <div className="map-settings">
      <div className="map-settings__head">
        <h2>{t('settings.releases.title')}</h2>
      </div>
      <label className="check">
        <input type="checkbox" checked={enabled} onChange={(event) => app.setReleasesEnabled(event.target.checked)} />
        {t('settings.releases.enabled')}
      </label>
      <p className="muted">{t('settings.releases.hint')}</p>
      <p className="muted">{t('settings.releases.saved')}</p>
      {!enabled && (
        <p className="hint hint--info" role="note">
          {t('settings.releases.offNote')}
        </p>
      )}
    </div>
  );
}
