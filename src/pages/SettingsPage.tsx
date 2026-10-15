import { useTranslation } from 'react-i18next';
import { hrefs, type SettingsSection } from '../router';
import { FieldsSection } from './FieldsSection';
import { MapSection } from './MapSection';
import { FeaturesSection } from './FeaturesSection';
import { GithubSection } from './GithubSection';
import { useFeature } from '../components/useFeature';
import { StatusValuesSection } from './StatusValuesSection';

/** Settings of the workspace: a list of sections next to the content of the chosen one. */
export function SettingsPage({ section }: { section: SettingsSection }) {
  const { t } = useTranslation();
  const githubOn = useFeature('github');
  // The section "GitHub" only exists while the feature is on; an old link then shows the features.
  const shown: SettingsSection = section === 'github' && !githubOn ? 'features' : section;

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
          <a href={hrefs.settingsFeatures} className="settings__link" aria-current={shown === 'features' ? 'page' : undefined}>
            {t('settings.features.title')}
          </a>
          {githubOn && (
            <a href={hrefs.settingsGithub} className="settings__link" aria-current={shown === 'github' ? 'page' : undefined}>
              {t('github.settings.title')}
            </a>
          )}
        </nav>
        <section className="settings__content">
          {shown === 'statuses' ? (
            <StatusValuesSection />
          ) : shown === 'map' ? (
            <MapSection />
          ) : shown === 'features' ? (
            <FeaturesSection />
          ) : shown === 'github' ? (
            <GithubSection />
          ) : (
            <FieldsSection />
          )}
        </section>
      </div>
    </>
  );
}
