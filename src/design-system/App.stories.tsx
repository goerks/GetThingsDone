import { useEffect } from 'react';
import { SortableContext } from '@dnd-kit/sortable';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { userEvent } from 'storybook/test';
import { BoardColumn } from '../components/BoardColumn';
import { ContextMenu, type MenuItem } from '../components/ContextMenu';
import { EpicTag } from '../components/EpicTag';
import { Header } from '../components/Header';
import { MemberFilterBar } from '../components/MemberFilterBar';
import { ReleaseCard } from '../components/ReleaseCard';
import { StatusDot } from '../components/StatusDot';
import { SortableStoryCard } from '../components/StoryCard';
import { SprintLabelContent } from '../pages/MapPage';
import { useApp } from '../state/AppState';
import { useDetails } from '../state/Details';
import { useToast } from '../state/Toast';
import { DemoApp } from './DemoApp';

const meta: Meta = {
  title: 'App',
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <DemoApp>
        <Story />
      </DemoApp>
    )
  ]
};
export default meta;
type Story = StoryObj;

function Cards({ compact }: { compact: boolean }) {
  const app = useApp();
  const epics = new Map(app.epics.map((epic) => [epic.id, epic]));
  const stories = app.stories.slice(0, 4);
  return (
    <SortableContext items={stories.map((story) => story.id)}>
      <ul className="column__list" style={{ maxWidth: compact ? '30rem' : '22rem' }}>
        {stories.map((story) => (
          <li key={story.id}>
            <SortableStoryCard story={story} epic={epics.get(story.epicId ?? '')} compact={compact} />
          </li>
        ))}
      </ul>
    </SortableContext>
  );
}

/** The card of a story on the board and in the backlog: key, title, criteria, epic, points, assignee, fields. */
export const StoryCards: Story = { render: () => <Cards compact={false} /> };

/** The compact form of the story map: one line per story. */
export const StoryCardsCompact: Story = { render: () => <Cards compact /> };

function EpicTags() {
  const app = useApp();
  return (
    <div className="catalogue-row">
      {app.epics.map((epic) => (
        <EpicTag key={epic.id} epic={epic} />
      ))}
    </div>
  );
}

/** The epic name with its colour dot. The name is always written: colour is never alone. */
export const EpicTagList: Story = { render: () => <EpicTags /> };

function StatusDots() {
  const app = useApp();
  return (
    <div className="catalogue-row">
      {app.statuses.map((status) => (
        <StatusDot key={status.id} status={status.id} />
      ))}
    </div>
  );
}

export const StatusDotList: Story = { render: () => <StatusDots /> };

function ReleaseCards() {
  const app = useApp();
  return (
    <ul className="release-list">
      {app.releases.map((release) => (
        <li key={release.id}>
          <ReleaseCard release={release} />
        </li>
      ))}
    </ul>
  );
}

/** A release as a card: state, period, numbers, progress and the change of scope. */
export const ReleaseCardList: Story = { render: () => <ReleaseCards /> };

function SprintCards() {
  const app = useApp();
  return (
    <div className="catalogue-row" style={{ alignItems: 'start' }}>
      {app.sprints.map((sprint) => (
        <div key={sprint.id} className={`map-sprint${sprint.state === 'running' ? ' map-sprint--running' : ''}`} style={{ width: '14rem', position: 'static' }}>
          <SprintLabelContent sprint={sprint} stories={app.stories.filter((story) => story.sprintId === sprint.id)} labelId={`sprint-label-${sprint.id}`} />
        </div>
      ))}
    </div>
  );
}

/** The sprint on the story map: name, dates, sum and plan; the running sprint has an accent edge. */
export const SprintCardList: Story = { render: () => <SprintCards /> };

function Lanes({ withDrop }: { withDrop: boolean }) {
  const app = useApp();
  const epics = new Map(app.epics.map((epic) => [epic.id, epic]));
  const sprintId = app.sprints.find((sprint) => sprint.state === 'running')?.id ?? null;
  return (
    <div className="board" style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'start' }}>
      {app.statuses.map((status, index) => (
        <div key={status.id} style={{ width: '17rem' }}>
          <BoardColumn
            status={status.id}
            stories={index === app.statuses.length - 2 ? [] : app.stories.filter((story) => story.status === status.id).slice(0, 2)}
            epics={epics}
            sprintId={sprintId}
            drop={withDrop && index === 1 ? { beforeId: null } : undefined}
          />
        </div>
      ))}
    </div>
  );
}

/** The lanes of the board: head with status dot and count, cards, an empty lane. */
export const BoardLanes: Story = { render: () => <Lanes withDrop={false} /> };

/** While a story is dragged over a lane, the lane is marked as the target. */
export const BoardLaneDropTarget: Story = { render: () => <Lanes withDrop /> };

/** The header with navigation, search, theme, language and settings. */
export const HeaderBar: Story = {
  parameters: { layout: 'fullscreen' },
  render: () => <Header route={{ name: 'board' }} theme="light" onToggleTheme={() => undefined} onShowShortcuts={() => undefined} />
};

/** The filter above the board: everyone, one team member, or nobody. */
export const MemberFilter: Story = {
  render: () => <MemberFilterBar filter={{ kind: 'all' }} onChange={() => undefined} />
};

const MENU: MenuItem[] = [
  { id: 'status', label: 'Status', submenu: [{ id: 'todo', label: 'To do', checked: true }, { id: 'done', label: 'Done' }] },
  { id: 'sprint', label: 'Sprint' },
  { id: 'epic', label: 'Epic' },
  { id: 'points', label: 'Points' }
];

/** The context menu of a card. */
export const ContextMenuOpen: Story = {
  render: () => <ContextMenu x={24} y={24} label="Story S-3" items={MENU} onClose={() => undefined} />
};

function ToastDemo({ tone }: { tone?: 'error' }) {
  const toast = useToast();
  useEffect(() => {
    toast.notify(tone === 'error' ? 'The story could not be saved.' : 'S-3 moved to Done.', tone === 'error' ? undefined : { label: 'Undo', onClick: () => undefined }, { sticky: true, tone });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** A short notice with an action; it stays while the pointer or the focus is on it. */
export const ToastNotice: Story = { render: () => <ToastDemo /> };

export const ToastError: Story = { render: () => <ToastDemo tone="error" /> };

function OpenOnMount({ kind }: { kind: 'story' | 'epic' | 'sprint' | 'release' }) {
  const details = useDetails();
  useEffect(() => {
    if (kind === 'story') details.openStory('story-1');
    else if (kind === 'epic') details.openEpic('epic-boards');
    else if (kind === 'sprint') details.openSprint('sprint-1');
    else details.openRelease('release-beta');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return null;
}

/** The details of a story: description, criteria, status, epic, points, history. */
export const StoryDialogOpen: Story = { render: () => <OpenOnMount kind="story" /> };

export const EpicDialogOpen: Story = { render: () => <OpenOnMount kind="epic" /> };

export const SprintDialogOpen: Story = { render: () => <OpenOnMount kind="sprint" /> };

export const ReleaseDialogOpen: Story = { render: () => <OpenOnMount kind="release" /> };

export const CardFocus: Story = {
  render: () => <Cards compact={false} />,
  play: async () => {
    await userEvent.tab();
  }
};
