import { useTranslation } from 'react-i18next';
import { hrefs, type SettingsSection } from '../router';
import { FieldsSection } from './FieldsSection';
import { MapSection } from './MapSection';
import { DefinitionsSection } from './DefinitionsSection';
import { ReleasesSection } from './ReleasesSection';
import { DataSection } from './DataSection';
import { TeamSection } from './TeamSection';
import { GithubSection } from './GithubSection';
import { StatusValuesSection } from './StatusValuesSection';
import { useApp } from '../state/AppState';

/** The features with a tab of their own (#61), in the order of the navigation. */
const FEATURE_TABS = [
  { key: 'releases', section: 'releases', href: hrefs.settingsReleases },
  { key: 'team', section: 'team', href: hrefs.settingsTeam },
  { key: 'github', section: 'github', href: hrefs.settingsGithub }
] as const;

/** Settings of the workspace: a list of sections next to the content of the chosen one. */
export function SettingsPage({ section }: { section: SettingsSection }) {
  const { t } = useTranslation();
  const { settings } = useApp();

  return (
    <>
      <div className="page-head">
        <h1>{t('settings.title')}</h1>
      </div>
      <div className="settings">
        <nav className="settings__nav" aria-label={t('settings.sections')}>
          <div className="settings__group" role="group" aria-label={t('settings.groups.workspace')}>
            <p className="settings__group-title" aria-hidden="true">
              {t('settings.groups.workspace')}
            </p>
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
            <a href={hrefs.settingsData} className="settings__link" aria-current={section === 'data' ? 'page' : undefined}>
              {t('settings.data.title')}
            </a>
          </div>
          <div className="settings__group" role="group" aria-label={t('settings.groups.features')}>
            <p className="settings__group-title" aria-hidden="true">
              {t('settings.groups.features')}
            </p>
            {FEATURE_TABS.map(({ key, section: target, href }) => (
              <a key={key} href={href} className="settings__link" aria-current={section === target ? 'page' : undefined}>
                {t(`settings.features.${key}.name`)}{' '}
                <span className={`badge${settings.features[key] ? '' : ' badge--off'}`}>{t(settings.features[key] ? 'settings.features.on' : 'settings.features.off')}</span>
              </a>
            ))}
          </div>
        </nav>
        <section className="settings__content">
          {section === 'statuses' ? (
            <StatusValuesSection />
          ) : section === 'map' ? (
            <MapSection />
          ) : section === 'definitions' ? (
            <DefinitionsSection />
          ) : section === 'releases' ? (
            <ReleasesSection />
          ) : section === 'team' ? (
            <TeamSection />
          ) : section === 'github' ? (
            <GithubSection />
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
