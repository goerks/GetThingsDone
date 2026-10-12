import { useTranslation } from 'react-i18next';
import { selectableReleases } from '../domain/releases';
import { useApp } from '../state/AppState';

const NO_RELEASE = '';

interface Props {
  id: string;
  value: string | null;
  onChange: (releaseId: string | null) => void;
}

/** Release dropdown: "No release" and every release that is not done (and the story's own release). */
export function ReleaseSelect({ id, value, onChange }: Props) {
  const { t } = useTranslation();
  const app = useApp();
  return (
    <select
      id={id}
      className="select"
      value={value ?? NO_RELEASE}
      onChange={(event) => onChange(event.target.value === NO_RELEASE ? null : event.target.value)}
    >
      <option value={NO_RELEASE}>{t('releases.noRelease')}</option>
      {selectableReleases(app.releases, app.stories, value).map((release) => (
        <option key={release.id} value={release.id}>
          {release.title}
        </option>
      ))}
    </select>
  );
}
