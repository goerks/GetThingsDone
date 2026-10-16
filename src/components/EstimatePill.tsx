import { useTranslation } from 'react-i18next';
import { SPECIAL_SYMBOLS } from './estimateSymbols';
import type { Story } from '../domain/types';
import { useBuiltin } from './useBuiltin';

/**
 * The estimate of a story as a small pill (#54): the number card, the special card ("?" or "☕"), or a dashed pill
 * with a dash when the story is not estimated.
 */
export function EstimatePill({ story }: { story: Pick<Story, 'points' | 'special'> }) {
  const { t } = useTranslation();
  const builtin = useBuiltin();
  if (story.points !== null) {
    return (
      <span className="pill" title={builtin.pointsTitle(story.points)}>
        {story.points}
      </span>
    );
  }
  if (story.special) {
    return (
      <span className="pill" title={t(`estimate.special.${story.special}`)}>
        {SPECIAL_SYMBOLS[story.special]}
      </span>
    );
  }
  return (
    <span className="pill pill--none" role="img" title={t('estimate.none')} aria-label={t('estimate.none')}>
      –
    </span>
  );
}
