import { useTranslation } from 'react-i18next';
import type { ResultKind } from '../../domain/search';
import { usePageMatches } from '../../state/Search';
import { Button } from '../../ui';

/** While a search is active: how many of the stories on this page match, and a button to clear the search. */
export function HighlightBar({ storyIds }: { storyIds: readonly string[] }) {
  const { t } = useTranslation();
  const matches = usePageMatches();
  if (!matches) return null;
  const count = storyIds.filter((id) => matches.ids.story.has(id)).length;
  return (
    <div className="highlight-bar" role="status">
      <span>
        {t('search.highlightSummary', { matches: count, count: storyIds.length })}{' '}
        <span className="highlight-bar__query">{matches.label}</span>
      </span>
      <Button type="button" size="small" onClick={matches.clear}>
        {t('search.clear')}
      </Button>
    </div>
  );
}

/** Class for an item on a page while a search is active: marked when it matches, dimmed when not. */
export function useMatchClass(id: string, base: string, kind: ResultKind = 'story', dim = true): string {
  const matches = usePageMatches();
  if (!matches) return '';
  if (matches.ids[kind].has(id)) return `${base}--match`;
  return dim ? `${base}--dimmed` : '';
}
