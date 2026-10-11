import { useTranslation } from 'react-i18next';
import { hrefs, type SettingsSection } from '../router';
import { FieldsSection } from './FieldsSection';

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
          <span className="settings__link settings__link--planned">
            {t('settings.statusValues')}
            <span className="badge" aria-hidden="true">
              {t('settings.planned')}
            </span>
            <span className="sr-only">: {t('settings.plannedNote')}</span>
          </span>
        </nav>
        <section className="settings__content">
          <FieldsSection />
        </section>
      </div>
    </>
  );
}
