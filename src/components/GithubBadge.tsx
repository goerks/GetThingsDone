import { useTranslation } from 'react-i18next';
import { LABELS_FIELD_ID, issueNumberOf, pendingFields } from '../domain/github';
import type { Story } from '../domain/types';
import { useApp } from '../state/AppState';
import { useFeature } from './useFeature';

/**
 * The issue number of an imported story, as a link to the issue on GitHub (#30), and a marker when the story has changes
 * that are not on GitHub yet. Nothing while the GitHub feature is off or for a story that was not imported. A click or
 * Enter opens GitHub and does not open the story.
 */
export function GithubBadge({ story }: { story: Story }) {
  const { t } = useTranslation();
  const app = useApp();
  const on = useFeature('github');
  const number = story.github ? issueNumberOf(story.github.url) : null;
  if (!on || !story.github || number === null) return null;
  const pending = pendingFields(story, app.fields.find((field) => field.id === LABELS_FIELD_ID), app.statuses, { epics: app.epics, releases: app.releases });
  return (
    <>
      <a
        className="github-badge"
        href={story.github.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t('github.issueLink', { number })}
        title={t('github.issueLink', { number })}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
        onPointerDown={(event) => event.stopPropagation()}
        onMouseDown={(event) => event.stopPropagation()}
      >
        #{number}
      </a>
      {pending.length > 0 && (
        <span className="github-pending" title={t('github.pending.title', { fields: pending.map((name) => t(`github.field.${name}`)).join(', ') })}>
          {t('github.pending.badge')}
        </span>
      )}
    </>
  );
}
