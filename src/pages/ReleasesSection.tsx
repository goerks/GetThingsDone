import { useTranslation } from 'react-i18next';
import { hrefs } from '../router';
import { FeatureTab } from './FeatureTab';

/** Settings › Releases (#61): the switch of the releases feature (#10). The rows of the story map stay in Settings › Story map. */
export function ReleasesSection() {
  const { t } = useTranslation();
  return (
    <FeatureTab feature="releases">
      <div>
        <a href={hrefs.releases}>{t('settings.features.openReleases')}</a>
      </div>
    </FeatureTab>
  );
}
