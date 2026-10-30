import { useCallback } from 'react';
import { storyKey } from '../domain/storyKey';
import type { Story } from '../domain/types';
import { useFeature } from './useFeature';

/** The ID of a story as the screen shows it (#66): the key of its issue while the sync is on and the story is linked, else its own key. */
export function useStoryKey(): (story: Pick<Story, 'code' | 'link'>) => string {
  const on = useFeature('sync');
  return useCallback((story) => storyKey(story, on), [on]);
}
