import { useTranslation } from 'react-i18next';
import { hrefs, type SettingsSection } from '../router';
import { FieldsSection } from './FieldsSection';
import { MapSection } from './MapSection';
import { DefinitionsSection } from './DefinitionsSection';
import { FeaturesSection } from './FeaturesSection';
import { DataSection } from './DataSection';
import { StatusValuesSection } from './StatusValuesSection';

/** Settings of the workspace: a list of sections next to the content of the chosen one. */
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
          <a href={hrefs.settingsStatuses} className="settings__link" aria-current={section === 'statuses' ? 'page' : undefined}>
            {t('statusValues.title')}
          </a>
          <a href={hrefs.settingsMap} className="settings__link" aria-current={section === 'map' ? 'page' : undefined}>
            {t('settings.map.title')}
          </a>
          <a href={hrefs.settingsDefinitions} className="settings__link" aria-current={section === 'definitions' ? 'page' : undefined}>
            {t('definitions.title')}
          </a>
          <a href={hrefs.settingsFeatures} className="settings__link" aria-current={section === 'features' ? 'page' : undefined}>
            {t('settings.features.title')}
          </a>
          <a href={hrefs.settingsData} className="settings__link" aria-current={section === 'data' ? 'page' : undefined}>
            {t('settings.data.title')}
          </a>
        </nav>
        <section className="settings__content">
          {section === 'statuses' ? (
            <StatusValuesSection />
          ) : section === 'map' ? (
            <MapSection />
          ) : section === 'definitions' ? (
            <DefinitionsSection />
          ) : section === 'features' ? (
            <FeaturesSection />
          ) : section === 'data' ? (
            <DataSection />
          ) : (
            <FieldsSection />
          )}
        </section>
      </div>
    </>
  );
}
