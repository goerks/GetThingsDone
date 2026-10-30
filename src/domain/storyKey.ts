import type { Story } from './types';

/**
 * The ID of a story (#66): the key of its issue (`#31` on GitHub, `PROJ-123` on Jira) while the synchronisation is on
 * and the story is linked, else its own key (`S-4`). The own key is kept in both cases, so the search finds the story by
 * it and it is shown again when the connection is removed.
 */
export function storyKey(story: Pick<Story, 'code' | 'link'>, syncOn = true): string {
  return syncOn && story.link ? story.link.key : story.code;
}
