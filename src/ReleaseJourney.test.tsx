import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { initI18n } from './i18n';
import { dayOf } from './domain/history';
import type { Story } from './domain/types';

beforeAll(() => {
  initI18n('en');
});

/** Release 2.0 runs from Monday 5 Oct to Friday 23 Oct 2026. Time is controlled, so a three-week release takes a second. */
const day = (value: string): void => {
  vi.setSystemTime(new Date(`${value}T10:00:00`));
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-10-05T09:00:00') });
});

afterEach(() => {
  vi.useRealTimers();
});

function story(index: number, title: string, points: number): Story {
  return {
    id: `s${index}`,
    code: `S-${index}`,
    title,
    description: '',
    epicId: null,
    points,
    status: 'todo',
    sprintId: null,
    releaseId: null,
    rank: index,
    criteria: [],
    values: {},
    checks: {},
    doneItems: null
  };
}

const ui = userEvent.setup();

async function openRelease(): Promise<HTMLElement> {
  await ui.click(await screen.findByRole('button', { name: /Release 2\.0/ }));
  return screen.findByRole('dialog', { name: /Release 2\.0/ });
}

async function closeDialog(): Promise<void> {
  await ui.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}

/** Opens the release, its tab "Stories", picks a story by the search and closes the dialog again. */
async function addByKey(query: string): Promise<void> {
  const dialog = await openRelease();
  await ui.click(within(dialog).getByRole('tab', { name: /^Stories/ }));
  await ui.type(within(dialog).getByRole('combobox', { name: 'Add a story' }), query);
  await ui.keyboard('{Enter}');
  await closeDialog();
}

/** Opens a story from the list of the release and changes one of its fields. */
async function changeStory(title: string, change: (dialog: HTMLElement) => Promise<void>): Promise<void> {
  const release = await openRelease();
  await ui.click(within(release).getByRole('tab', { name: /^Stories/ }));
  await ui.click(within(release).getByRole('button', { name: title }));
  const dialog = await screen.findByRole('dialog', { name: new RegExp(title) });
  await change(dialog);
  await closeDialog();
}

const setStatus = (status: string) => async (dialog: HTMLElement) => ui.selectOptions(within(dialog).getByLabelText('Status'), status);
const setPoints = (points: string) => async (dialog: HTMLElement) => ui.click(within(dialog).getByRole('radio', { name: points }));

describe('a release from planning to the last day', () => {
  it('plans, grows, shrinks and burns down, and the reports tell the same story', async () => {
    const repository = new LocalStorageRepository();
    const seed = seedSnapshot('2026-10-05');
    await repository.replaceAll({
      ...seed,
      releases: [],
      events: [],
      stories: [story(1, 'Alpha', 5), story(2, 'Bravo', 3), story(3, 'Charlie', 2), story(4, 'Delta', 5), story(5, 'Echo', 8), story(6, 'Foxtrot', 3)]
    });
    window.location.hash = '#/releases';
    render(<App repository={repository} />);
    await screen.findByRole('heading', { name: 'Releases', level: 1 });

    // Mon 5 Oct: the PO plans the release with Ctrl+N: four stories, 15 points, from 5 to 23 October.
    await ui.keyboard('{Control>}n{/Control}');
    const form = await screen.findByRole('dialog', { name: 'New release' });
    await ui.type(within(form).getByLabelText('Title'), 'Release 2.0');
    fireEvent.change(within(form).getByLabelText('Start'), { target: { value: '2026-10-05' } });
    fireEvent.change(within(form).getByLabelText('End'), { target: { value: '2026-10-23' } });
    await ui.click(within(form).getByRole('button', { name: 'Add release' }));
    for (const key of ['S-1', 'S-2', 'S-3', 'S-4']) await addByKey(key);

    // Wed 7 Oct: Alpha is finished. Left: 10 of 15.
    day('2026-10-07');
    await changeStory('Alpha', setStatus('Done'));

    // Thu 8 Oct: the scope grows: Echo (8 points) joins.
    day('2026-10-08');
    await addByKey('echo');

    // Fri 9 Oct: Bravo turns out bigger: 3 points become 5.
    day('2026-10-09');
    await changeStory('Bravo', setPoints('5'));

    // Mon 12 Oct: Charlie (2 points) is dropped from the release.
    day('2026-10-12');
    const dialog = await openRelease();
    await ui.click(within(dialog).getByRole('tab', { name: /^Stories/ }));
    await ui.click(within(dialog).getByRole('button', { name: 'Remove S-3 from this release' }));
    await closeDialog();

    // Tue 13 Oct (today): Bravo is finished; Delta is finished and, after a test failure, reopened. Status never changes the scope.
    day('2026-10-13');
    await changeStory('Bravo', setStatus('Done'));
    await changeStory('Delta', setStatus('Done'));
    await changeStory('Delta', setStatus('Review'));

    // What was recorded, in order.
    await waitFor(async () => {
      const events = (await repository.load()).events;
      expect(events.map((event) => `${dayOf(event.at)} ${event.kind} ${event.code} ${event.points}`)).toEqual([
        '2026-10-05 added S-1 5',
        '2026-10-05 added S-2 3',
        '2026-10-05 added S-3 2',
        '2026-10-05 added S-4 5',
        '2026-10-07 done S-1 5',
        '2026-10-08 added S-5 8',
        '2026-10-09 points S-2 5',
        '2026-10-12 removed S-3 2',
        '2026-10-13 done S-2 5',
        '2026-10-13 done S-4 5',
        '2026-10-13 reopened S-4 5'
      ]);
    });

    // The card on the releases page: net change since the start is +8 points and no change in the number of stories.
    const card = await screen.findByRole('button', { name: /Release 2\.0/ });
    expect(card).toHaveTextContent('4 Stories');
    expect(card).toHaveTextContent('23 Points');
    expect(card).toHaveTextContent('10 Points done');
    expect(card).toHaveTextContent('Scope since start');
    expect(card).toHaveTextContent('±0 stories');
    expect(card).toHaveTextContent('+8 P');

    // Scope report, in points: 15 at the start, +8 (Echo) +2 (Bravo), −2 (Charlie), 23 now.
    const release = await openRelease();
    await ui.click(within(release).getByRole('tab', { name: 'Scope' }));
    const kpis = () => within(release).getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(kpis()).toEqual([
      ['Scope at the start', '15'],
      ['Increase', '+10'],
      ['Decrease', '−2'],
      ['Scope now', '23']
    ]);
    // The same, in tickets: 4 at the start, +1 (Echo), −1 (Charlie), 4 now. Bravo's points change adds no ticket.
    await ui.click(within(release).getByRole('button', { name: 'Tickets' }));
    expect(kpis()).toEqual([
      ['Scope at the start', '4'],
      ['Increase', '+1'],
      ['Decrease', '−1'],
      ['Scope now', '4']
    ]);
    // The list of changes, newest first. Finishing and reopening are not in it.
    const changes = within(within(release).getByRole('table', { name: 'Changes of the scope' })).getAllByRole('row').slice(1);
    expect(changes.map((row) => row.textContent)).toEqual([
      expect.stringContaining('S-3 CharlieRemoved −1'),
      expect.stringContaining('S-2 BravoPoints 3 → 5 (+2)'),
      expect.stringContaining('S-5 EchoAdded +1')
    ]);

    // Burndown, in tickets first: 4 at the start, 2 left now (Charlie gone, Alpha and Bravo done).
    await ui.click(within(release).getByRole('tab', { name: 'Burndown' }));
    expect(within(release).getByRole('img', { name: 'Burndown in Tickets: 2 left today, 2 of 4 done' })).toBeInTheDocument();
    // In points: 23 in scope, 10 done (Alpha 5, Bravo 5), 13 left. The line goes from 15 (5 Oct) to 0 (23 Oct): 8.3 today.
    await ui.click(within(release).getByRole('button', { name: 'Points' }));
    expect(within(release).getByRole('img', { name: 'Burndown in Points: 13 left today, 10 of 23 done' })).toBeInTheDocument();
    const figures = within(release).getAllByRole('term').map((term) => [term.textContent, term.nextElementSibling?.textContent]);
    expect(figures).toEqual([
      ['Left', '13'],
      ['Done', '10 of 23'],
      ['Against the target line', '4.7 P behind']
    ]);

    // The table has one row per day from 5 to 23 October: what is left, the target line and the change of the scope.
    await ui.click(within(release).getByText('Show as table'));
    const rows = Array.from(within(release).getByRole('table', { name: /Burndown in Points/ }).querySelectorAll('tbody tr')).map((row) =>
      Array.from(row.children).map((cell) => cell.textContent)
    );
    expect(rows).toHaveLength(19);
    const byDay = (label: string) => rows.find((row) => row[0] === label);
    expect(byDay('Oct 5, 2026')).toEqual(['Oct 5, 2026', '15', '15', '–']);
    expect(byDay('Oct 7, 2026')?.[1]).toBe('10'); // Alpha done
    expect(byDay('Oct 8, 2026')).toEqual(['Oct 8, 2026', '18', expect.any(String), '+8']); // Echo joins
    expect(byDay('Oct 9, 2026')?.[1]).toBe('20'); // Bravo +2
    expect(byDay('Oct 12, 2026')).toEqual(['Oct 12, 2026', '18', expect.any(String), '−2']); // Charlie leaves
    expect(byDay('Oct 13, 2026')?.[1]).toBe('13'); // Bravo done
    expect(byDay('Oct 14, 2026')?.[1]).toBe('–'); // the future
    expect(byDay('Oct 23, 2026')).toEqual(['Oct 23, 2026', '–', '0', '–']);
  }, 60000);
});

describe('a release survives a restart', () => {
  it('shows the release, its stories and its history again after the app is opened anew', async () => {
    const seed = seedSnapshot('2026-10-05');
    const first = new LocalStorageRepository();
    await first.replaceAll({ ...seed, releases: [], events: [], stories: [story(1, 'Alpha', 5), story(2, 'Bravo', 3)] });
    window.location.hash = '#/releases';
    const session = render(<App repository={first} />);
    await screen.findByRole('heading', { name: 'Releases', level: 1 });

    await ui.keyboard('{Control>}n{/Control}');
    const form = await screen.findByRole('dialog', { name: 'New release' });
    await ui.type(within(form).getByLabelText('Title'), 'Release 2.0');
    fireEvent.change(within(form).getByLabelText('Start'), { target: { value: '2026-10-05' } });
    fireEvent.change(within(form).getByLabelText('End'), { target: { value: '2026-10-23' } });
    await ui.click(within(form).getByRole('button', { name: 'Add release' }));
    await addByKey('S-1');
    await addByKey('S-2');
    day('2026-10-07');
    await changeStory('Alpha', setStatus('Done'));
    await waitFor(async () => expect((await first.load()).events).toHaveLength(3));

    // The app is closed and opened anew on the same storage, two days later.
    session.unmount();
    day('2026-10-09');
    render(<App repository={new LocalStorageRepository()} />);
    const card = await screen.findByRole('button', { name: /Release 2\.0/ });
    expect(card).toHaveTextContent('2 Stories');
    expect(card).toHaveTextContent('8 Points');
    expect(card).toHaveTextContent('5 Points done');

    const release = await openRelease();
    await ui.click(within(release).getByRole('tab', { name: 'Burndown' }));
    await ui.click(within(release).getByRole('button', { name: 'Points' }));
    expect(within(release).getByRole('img', { name: 'Burndown in Points: 3 left today, 5 of 8 done' })).toBeInTheDocument();
    // The history was kept: a reopened app records no second baseline.
    await waitFor(async () => expect((await new LocalStorageRepository().load()).events).toHaveLength(3));
  });
});
