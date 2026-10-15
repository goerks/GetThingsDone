import { useTranslation } from 'react-i18next';
import { issueNumberOf } from '../domain/github';
import type { Story } from '../domain/types';
import { useFeature } from './useFeature';

/**
 * The issue number of an imported story, as a link to the issue on GitHub (#30). Nothing while the GitHub feature is
 * off or for a story that was not imported. A click or Enter opens GitHub and does not open the story.
 */
export function GithubBadge({ story }: { story: Pick<Story, 'github'> }) {
  const { t } = useTranslation();
  const on = useFeature('github');
  const number = story.github ? issueNumberOf(story.github.url) : null;
  if (!on || !story.github || number === null) return null;
  return (
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
  );
}
