import { useTranslation } from 'react-i18next';
import { averageVelocity, velocityRows } from '../domain/velocity';
import { useApp } from '../state/AppState';
import { useBuiltin } from './useBuiltin';

/**
 * The points in a sprint next to the team's average velocity, for example "30 planned · Ø 21" (#24). Without a
 * completed sprint there is no average; while points are hidden there is nothing to show.
 */
export function SprintPlan({ points, className }: { points: number; className?: string }) {
  const { t } = useTranslation();
  const app = useApp();
  const builtin = useBuiltin();
  if (!builtin.shown('story', 'points')) return null;
  const average = averageVelocity(velocityRows(app.sprints));
  return (
    <span className={className} data-testid="sprint-plan">
      {average ? t('velocity.planAverage', { points, average: average.points }) : t('velocity.plan', { points })}
    </span>
  );
}
