import { LABELS_FIELD_ID, pendingFields } from '../domain/sync';
import type { Story } from '../domain/types';
import { openLink } from '../sync/openExternal';
import { useApp } from '../state/AppState';
import { useSyncT } from '../sync/useSyncT';
import { useFeature } from './useFeature';

/**
 * The ID of a story (#66). A story that is linked to an issue of the connected service shows the key of the issue, as a
 * link to the issue (a click or Enter opens the service and does not open the story); every other story shows its own
 * key. `onlyLinked` shows nothing for a story without a link, for the places that have no room for the own key.
 */
export function StoryKey({ story, className = 'card__code', onlyLinked = false }: { story: Story; className?: string; onlyLinked?: boolean }) {
  const { t } = useSyncT();
  const app = useApp();
  const on = useFeature('sync');
  const link = on && story.link?.service === app.settings.sync.service ? story.link : undefined;
  if (!link) return onlyLinked ? null : <span className={className}>{story.code}</span>;
  const label = t('sync.issueLink', { key: link.key });
  return (
    <a
      className={`${className} story-key`}
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.stopPropagation();
        openLink(event, link.url);
      }}
      onKeyDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      {link.key}
    </a>
  );
}

/** The marker "not on <service> yet" of a linked story that has changes the service does not have. Nothing while the sync is off. */
export function PendingMarker({ story }: { story: Story }) {
  const { t } = useSyncT();
  const app = useApp();
  const on = useFeature('sync');
  if (!on || !story.link || story.link.service !== app.settings.sync.service) return null;
  const pending = pendingFields(story, app.fields.find((field) => field.id === LABELS_FIELD_ID), app.statuses, { epics: app.epics, releases: app.releases });
  if (pending.length === 0) return null;
  return (
    <span className="github-pending" title={t('sync.pending.title', { fields: pending.map((name) => t(`sync.field.${name}`)).join(', ') })}>
      {t('sync.pending.badge')}
    </span>
  );
}

/** The own key of a linked story, small, for the story dialog: it is not lost when the issue number takes its place. */
export function LocalKey({ story }: { story: Story }) {
  const { t } = useSyncT();
  const app = useApp();
  const on = useFeature('sync');
  if (!on || !story.link || story.link.service !== app.settings.sync.service) return null;
  return <span className="muted story-key__local">{t('sync.localId', { code: story.code })}</span>;
}
