import { createContext, useCallback, useContext, useMemo, useState, type MouseEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ContextMenu, type MenuItem } from '../components/ContextMenu';
import { statusLabel } from '../components/statusLabel';
import { useBuiltin } from '../components/useBuiltin';
import { sortEpics } from '../domain/epics';
import { sortSprints } from '../domain/sprints';
import { STATUS_CATEGORIES, statusColor, statusesIn } from '../domain/statuses';
import { POINT_VALUES } from '../domain/types';
import { useApp } from './AppState';
import { useDetails } from './Details';

interface StoryMenuApi {
  /** Opens the menu of a story at the pointer, or at the card when the menu key or Shift+F10 was used. */
  openFor(storyId: string, event: MouseEvent<HTMLElement>): void;
  /** The story whose menu is open, or null: its card, row or chip shows that it is the chosen one. */
  openId: string | null;
}

const StoryMenuContext = createContext<StoryMenuApi | null>(null);

/** The context menu of a story; cards, rows and chips call `openFor` from their `onContextMenu`. */
export function useStoryMenu(): StoryMenuApi {
  const value = useContext(StoryMenuContext);
  if (!value) throw new Error('useStoryMenu must be used inside StoryMenuProvider');
  return value;
}

interface Open {
  storyId: string;
  x: number;
  y: number;
  opener: HTMLElement | null;
}

/** Status, sprint, epic and points of a story from a menu, on the board, backlog and story map (#32, Q1). */
export function StoryMenuProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const app = useApp();
  const details = useDetails();
  const builtin = useBuiltin();
  const [open, setOpen] = useState<Open | null>(null);

  const openFor = useCallback((storyId: string, event: MouseEvent<HTMLElement>) => {
    event.preventDefault();
    const element = event.currentTarget;
    let { clientX: x, clientY: y } = event;
    // The menu key and Shift+F10 report no pointer position: the menu then opens at the card.
    if (x === 0 && y === 0) {
      const rect = element.getBoundingClientRect();
      x = rect.left + 24;
      y = rect.top + Math.min(rect.height, 48);
    }
    setOpen({ storyId, x, y, opener: element });
  }, []);

  const close = (): void => {
    const opener = open?.opener;
    setOpen(null);
    // The focus goes back to the card, as after a dialog.
    opener?.focus?.();
  };

  const story = open ? app.stories.find((item) => item.id === open.storyId) : undefined;
  const items = useMemo<MenuItem[]>(() => {
    if (!story) return [];
    const choose = (patch: Parameters<typeof app.changeStory>[1]) => (): void => {
      app.changeStory(story.id, patch);
      setOpen(null);
      // The card may have moved to another column or section, so it is looked up again once the page has updated.
      setTimeout(() => document.querySelector<HTMLElement>(`[data-story-id="${story.id}"]`)?.focus(), 0);
    };
    const list: MenuItem[] = [
      {
        id: 'open',
        label: t('menu.open'),
        onSelect: () => {
          setOpen(null);
          details.openStory(story.id);
        }
      },
      {
        id: 'status',
        label: t('menu.status'),
        submenu: STATUS_CATEGORIES.flatMap((category) => statusesIn(app.statuses, category)).map((status) => ({
          id: status.id,
          label: statusLabel(t, app.statuses, status.id),
          dot: statusColor(app.statuses, status.id),
          checked: story.status === status.id,
          onSelect: choose({ status: status.id })
        }))
      },
      {
        id: 'sprint',
        label: t('menu.sprint'),
        submenu: [
          { id: 'sprint-none', label: t('sprint.notPlanned'), checked: story.sprintId === null, onSelect: choose({ sprintId: null }) },
          ...sortSprints(app.sprints).map((sprint) => ({
            id: sprint.id,
            label: sprint.name,
            checked: story.sprintId === sprint.id,
            onSelect: choose({ sprintId: sprint.id })
          }))
        ]
      }
    ];
    if (builtin.shown('story', 'epic')) {
      list.push({
        id: 'epic',
        label: t('menu.epic'),
        submenu: [
          { id: 'epic-none', label: t('epics.noEpic'), checked: story.epicId === null, onSelect: choose({ epicId: null }) },
          ...sortEpics(app.epics).map((epic) => ({
            id: epic.id,
            label: epic.name,
            dot: `var(--epic-${epic.colorKey})`,
            checked: story.epicId === epic.id,
            onSelect: choose({ epicId: epic.id })
          }))
        ]
      });
    }
    if (builtin.shown('story', 'points')) {
      list.push({
        id: 'points',
        label: builtin.label('points', t('menu.points')),
        submenu: POINT_VALUES.map((value) => ({
          id: `points-${value}`,
          label: String(value),
          checked: story.points === value,
          onSelect: choose({ points: value })
        }))
      });
    }
    return list;
    // `choose` closes over the current opener; the menu is rebuilt when a story or the opened menu changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [story, open, app.statuses, app.sprints, app.epics, t]);

  const openId = open?.storyId ?? null;
  const api = useMemo<StoryMenuApi>(() => ({ openFor, openId }), [openFor, openId]);

  return (
    <StoryMenuContext.Provider value={api}>
      {children}
      {open && story && <ContextMenu x={open.x} y={open.y} label={t('menu.label', { code: story.code })} items={items} onClose={close} />}
    </StoryMenuContext.Provider>
  );
}
