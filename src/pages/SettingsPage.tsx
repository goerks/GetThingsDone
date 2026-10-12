import { useTranslation } from 'react-i18next';
import { hrefs, type SettingsSection } from '../router';
import { FieldsSection } from './FieldsSection';
import { MapSection } from './MapSection';
import { ReleasesSection } from './ReleasesSection';

/**
 * Settings of the workspace: a list of sections next to the content of the chosen one.
 * Status values (#5) are shown as planned so the team sees what comes next.
 */
export function SettingsPage({ section }: { section: SettingsSection }) {
  const { t } = useTranslation();

  return (
    <>
      <div className="page-head">
        <h1>{t('settings.title')}</h1>
      </div>
      <div className="settings">
        <nav className="settings__nav" aria-label={t('settings.sections')}>
          <a href={hrefs.settings} className="settings__link" aria-current={section === 'fields' ? 'page' : undefined}>
            {t('fields.title')}
          </a>
          <a href={hrefs.settingsMap} className="settings__link" aria-current={section === 'map' ? 'page' : undefined}>
            {t('settings.map.title')}
          </a>
          <a href={hrefs.settingsReleases} className="settings__link" aria-current={section === 'releases' ? 'page' : undefined}>
            {t('settings.releases.title')}
          </a>
          <span className="settings__link settings__link--planned">
            {t('settings.statusValues')}
            <span className="badge" aria-hidden="true">
              {t('settings.planned')}
            </span>
            <span className="sr-only">: {t('settings.plannedNote')}</span>
          </span>
        </nav>
        <section className="settings__content">
          {section === 'map' ? <MapSection /> : section === 'releases' ? <ReleasesSection /> : <FieldsSection />}
        </section>
      </div>
    </>
  );
}
