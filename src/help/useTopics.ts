import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import type { HelpEntry } from '../domain/helpSearch';
import { TOPICS, TOUR_TOPIC_ID } from './topics';

/** The topics, including the introduction, with their texts in the current language. */
export function useHelpEntries(): HelpEntry[] {
  const { t } = useTranslation();
  return useMemo(
    () =>
      [...TOPICS.map((topic) => topic.id), TOUR_TOPIC_ID].map((id) => ({
        id,
        title: t(`help.topics.${id}.title`),
        keywords: t(`help.topics.${id}.keywords`),
        body: t(`help.topics.${id}.body`)
      })),
    [t]
  );
}
