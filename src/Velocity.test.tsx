import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { startItemsOf } from './domain/sprintLife';
import { addDays, todayIso } from './domain/sprints';
import i18n, { initI18n } from './i18n';
import type { Snapshot, Sprint } from './domain/types';

beforeAll(() => {
  initI18n('en');
});

const today = todayIso();

/** A completed sprint with the figures of the approved test cases (#24). */
function completed(number: number, planned: number, done: number, added: { stories: number; points: number } = { stories: 0, points: 0 }): Sprint {
  const start = addDays(today, -14 * (8 - number));
  return {
    id: `done-${number}`,
    name: `Sprint ${number}`,
    startDate: start,
    endDate: addDays(start, 13),
    state: 'completed',
    startItems: [],
    result: {
      completedOn: addDays(start, 13),
      plannedPoints: planned,
      plannedStories: 3,
      donePoints: done,
      doneStories: 3,
      notDonePoints: 0,
      notDoneStories: 0,
      addedStories: added.stories,
      addedPoints: added.points,
      removedStories: 0,
      removedPoints: 0,
      changedPoints: 0
    }
  };
}

/** The six completed sprints of the test cases: planned at the start / done. */
const SIX = [completed(1, 18, 12), completed(2, 22, 19), completed(3, 25, 17), completed(4, 20, 22, { stories: 2, points: 5 }), completed(5, 24, 20), completed(6, 26, 22)];

/**
 * The demo data with the given completed sprints before it. Sprint 1 of the demo becomes the running "Sprint 7" with
 * 24 points; Sprint 2 becomes the planned "Sprint 8", which gets S-7 with 30 points.
 */
function demo(done: Sprint[]): Snapshot {
  const seed = seedSnapshot(today);
  const stories = seed.stories.map((story) =>
    story.id === 'story-1' ? { ...story, points: 4 } : story.id === 'story-7' ? { ...story, points: 30, sprintId: 'sprint-2' } : story
  );
  return {
    ...seed,
    sprints: [
      ...done,
      ...seed.sprints.map((sprint) =>
        sprint.id === 'sprint-1' ? { ...sprint, name: 'Sprint 7', startItems: startItemsOf(stories, 'sprint-1') } : sprint.id === 'sprint-2' ? { ...sprint, name: 'Sprint 8' } : sprint
      )
    ],
    stories
  };
}

async function open(snapshot: Snapshot, hash = '#/backlog'): Promise<LocalStorageRepository> {
  window.location.hash = hash;
  const repository = new LocalStorageRepository();
  await repository.replaceAll(snapshot);
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
  return repository;
}

const velocity = (): HTMLElement => screen.getByRole('region', { name: 'Velocity' });

describe('velocity panel in the backlog', () => {
  it('AC1.1 shows two bars with numbers per sprint, in order, with a legend', async () => {
    // Given six completed sprints
    // When I open the backlog
    await open(demo(SIX));
    // Then "Velocity" shows planned and done per sprint, Sprint 1 to 6, and the legend names both
    const panel = velocity();
    const sprints = panel.querySelectorAll('[data-sprint-id]');
    expect([...sprints].map((node) => node.getAttribute('aria-label'))).toEqual([
      'Sprint 1: 18 / 12',
      'Sprint 2: 22 / 19',
      'Sprint 3: 25 / 17',
      'Sprint 4: 20 / 22',
      'Sprint 5: 24 / 20',
      'Sprint 6: 26 / 22'
    ]);
    expect([...sprints[0].querySelectorAll('text.velocity-chart__value')].map((node) => node.textContent)).toEqual(['18', '12']);
    const legend = panel.querySelector<HTMLElement>('.velocity__legend')!;
    expect(within(legend).getByText('Planned')).toBeInTheDocument();
    expect(within(legend).getByText('Done')).toBeInTheDocument();
  });

  it('AC1.2 draws the done bar higher than the planned bar when more was done', async () => {
    // Given Sprint 4 planned 20 and completed 22
    await open(demo(SIX));
    // When I look at Sprint 4
    const sprint = velocity().querySelector('[data-sprint-id="done-4"]')!;
    // Then the done bar is higher than the planned bar
    const height = (selector: string): number => Number(sprint.querySelector(selector)!.getAttribute('height'));
    expect(height('.velocity-chart__done')).toBeGreaterThan(height('.velocity-chart__planned'));
  });

  it('AC1.3 shows the last 8 of 10 sprints and the older ones after "Older sprints"', async () => {
    // Given 10 completed sprints
    const ten = Array.from({ length: 10 }, (_, index) => completed(index + 1, 20, 20));
    const user = userEvent.setup();
    await open(demo(ten));
    const names = (): string[] => [...velocity().querySelectorAll('[data-sprint-id]')].map((node) => node.querySelector('text:last-child')!.textContent ?? '');
    // Then Sprint 3 to 10 are shown
    expect(names()).toEqual(['Sprint 3', 'Sprint 4', 'Sprint 5', 'Sprint 6', 'Sprint 7', 'Sprint 8', 'Sprint 9', 'Sprint 10']);
    // When I press "Older sprints"
    await user.click(within(velocity()).getByRole('button', { name: /Older sprints/ }));
    // Then Sprint 1 and 2 are there as well, and the button is gone
    expect(names()).toHaveLength(10);
    expect(names()[0]).toBe('Sprint 1');
    expect(within(velocity()).queryByRole('button', { name: /Older sprints/ })).not.toBeInTheDocument();
  });

  it('AC1.4 folds, keeps the average in the head, and stays folded after a reload', async () => {
    // Given the panel is open
    const user = userEvent.setup();
    await open(demo(SIX));
    const toggle = within(velocity()).getByRole('button', { name: 'Velocity' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // When I fold it and reload the app
    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    document.body.innerHTML = '';
    await open(demo(SIX));
    // Then it is still folded, the head shows the average, and I can open it again
    const again = within(velocity()).getByRole('button', { name: 'Velocity' });
    expect(again).toHaveAttribute('aria-expanded', 'false');
    expect(velocity()).toHaveTextContent('Ø 21 points · last 3 sprints');
    await userEvent.setup().click(again);
    expect(again).toHaveAttribute('aria-expanded', 'true');
  });

  it('AC1.5 shows the details of a sprint on keyboard focus', async () => {
    // Given Sprint 4 got 2 stories with 5 points during the sprint
    const user = userEvent.setup();
    await open(demo(SIX));
    // When I tab to Sprint 4
    const sprint = velocity().querySelector<SVGElement>('[data-sprint-id="done-4"]')!;
    sprint.focus();
    await user.hover(sprint);
    // Then the name, the dates, planned, done with share and the added points are shown
    const tip = await within(velocity()).findByRole('tooltip');
    expect(tip).toHaveTextContent('Sprint 4');
    expect(tip).toHaveTextContent('Planned at start 20 · Done 22 (110 %)');
    expect(tip).toHaveTextContent('+2 stories, +5 points added');
  });

  it('AC1.6 adds a newly completed sprint to the chart', async () => {
    // Given Sprint 7 runs with 24 points; S-5 (3 points) is done
    const user = userEvent.setup();
    await open(demo(SIX), '#/board');
    expect(screen.getByRole('heading', { name: 'Sprint 7', level: 1 })).toBeInTheDocument();
    // When I complete Sprint 7
    await user.click(screen.getByRole('button', { name: 'Complete sprint' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Complete sprint' }));
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    // Then Sprint 7 is in the chart with 24 planned and 3 done
    const sprint = (await screen.findByRole('region', { name: 'Velocity' })).querySelector('[data-sprint-id="sprint-1"]')!;
    expect(sprint).toHaveAttribute('aria-label', 'Sprint 7: 24 / 3');
  });
});

describe('average velocity', () => {
  it('AC2.1 shows the average of the last 3 sprints in the head and on a dashed line', async () => {
    // Given Sprint 4, 5, 6 have 22, 20 and 22 done points
    await open(demo(SIX));
    // Then the head says Ø 21 and the dashed line is labelled
    expect(velocity()).toHaveTextContent('Ø 21 points · last 3 sprints');
    const label = velocity().querySelector('.velocity-chart__average-label');
    expect(label).toHaveTextContent('Ø 21 (last 3)');
    expect(velocity().querySelector('line.velocity-chart__average')).toBeInTheDocument();
  });

  it('AC2.2 names the number of sprints when only 2 are completed', async () => {
    // Given 2 completed sprints with 12 and 24 done points
    await open(demo([completed(1, 20, 12), completed(2, 30, 24)]));
    // Then the average is 18 over 2 sprints
    expect(velocity()).toHaveTextContent('Ø 18 points · 2 sprints');
  });

  it('AC2.3 names the single sprint when only 1 is completed', async () => {
    await open(demo([completed(1, 20, 12)]));
    expect(velocity()).toHaveTextContent('Ø 12 points · 1 sprint');
  });
});

describe('planned points next to the average', () => {
  it('AC3.1 shows planned points and the average on each open sprint of the backlog', async () => {
    // Given Sprint 7 runs with 24 points, Sprint 8 is planned with 30, the average is 21
    await open(demo(SIX));
    // Then each shows its points next to Ø 21
    expect(within(screen.getByRole('region', { name: 'Sprint 7' })).getByTestId('sprint-plan')).toHaveTextContent('24 planned · Ø 21');
    expect(within(screen.getByRole('region', { name: 'Sprint 8' })).getByTestId('sprint-plan')).toHaveTextContent('30 planned · Ø 21');
  });

  it('AC3.2 shows the same on the story map', async () => {
    await open(demo(SIX), '#/map');
    const labels = screen.getAllByTestId('sprint-plan').map((node) => node.textContent);
    expect(labels).toEqual(['24 planned · Ø 21', '30 planned · Ø 21']);
  });

  it('AC3.3 shows the same in the start dialog', async () => {
    // Given no sprint runs and Sprint 8 is planned
    const user = userEvent.setup();
    const snapshot = demo(SIX);
    await open({ ...snapshot, sprints: snapshot.sprints.filter((sprint) => sprint.id !== 'sprint-1') }, '#/board');
    // When I open "Start sprint"
    await user.click(await screen.findByRole('button', { name: 'Start sprint' }));
    // Then the dialog shows 30 planned · Ø 21
    expect(within(screen.getByRole('dialog')).getByTestId('sprint-plan')).toHaveTextContent('30 planned · Ø 21');
  });

  it('AC3.4 shows only the planned points while no sprint is completed', async () => {
    // Given no completed sprint; Sprint 7 has 24 points
    await open(demo([]));
    // Then there is no Ø
    expect(within(screen.getByRole('region', { name: 'Sprint 7' })).getByTestId('sprint-plan')).toHaveTextContent(/^24 planned$/);
  });

  it('AC3.5 follows the planning when a story is moved into the sprint', async () => {
    // Given Sprint 8 has 30 points
    const user = userEvent.setup();
    await open(demo(SIX), '#/board');
    // When S-6 (5 points) is planned in Sprint 8 in its story dialog
    await user.click(screen.getByRole('group', { name: /^S-6: / }));
    await user.selectOptions(within(screen.getByRole('dialog')).getByLabelText('Sprint'), 'sprint-2');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('link', { name: 'Backlog' }));
    // Then Sprint 8 shows 35 planned
    expect(within(await screen.findByRole('region', { name: 'Sprint 8' })).getByTestId('sprint-plan')).toHaveTextContent('35 planned · Ø 21');
  });
});

describe('empty state', () => {
  it('AC4.1 explains why there is no chart while no sprint is completed', async () => {
    // Given no completed sprint
    await open(demo([]));
    // Then the panel says so and shows no chart and no average
    const panel = velocity();
    expect(panel).toHaveTextContent('No sprint completed yet');
    expect(panel).toHaveTextContent('As soon as you complete a sprint on the board, you see here how many points were planned and done.');
    expect(panel.querySelector('svg')).not.toBeInTheDocument();
    expect(panel).not.toHaveTextContent('Ø');
  });
});

describe('table and accessibility', () => {
  it('AC5.1 switches to a table, newest sprint first, with the points added and the average in the footer', async () => {
    // Given the six sprints
    const user = userEvent.setup();
    await open(demo(SIX));
    // When I press "Table"
    await user.click(within(velocity()).getByRole('button', { name: 'Table' }));
    // Then the chart is gone and the table lists all six, newest first
    expect(velocity().querySelector('svg')).not.toBeInTheDocument();
    const table = within(velocity()).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Sprint', 'Period', 'Completed', 'Planned at start', 'Added', 'Done', 'Share']);
    const rows = within(table).getAllByRole('row').slice(1, 7);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual(['Sprint 6', 'Sprint 5', 'Sprint 4', 'Sprint 3', 'Sprint 2', 'Sprint 1']);
    const sprint4 = rows[2];
    expect([...sprint4.querySelectorAll('td')].filter((_, index) => index > 1).map((cell) => cell.textContent)).toEqual(['20', '+5', '22', '110 %']);
    expect(table).toHaveTextContent('Ø of the last 3 sprints: 21');
  });

  it('AC5.2 lists all 10 sprints in the table, not only 8', async () => {
    const user = userEvent.setup();
    await open(demo(Array.from({ length: 10 }, (_, index) => completed(index + 1, 20, 20))));
    await user.click(within(velocity()).getByRole('button', { name: 'Table' }));
    expect(within(within(velocity()).getByRole('table')).getAllByRole('rowheader').filter((cell) => cell.closest('tbody'))).toHaveLength(10);
  });

  it('AC5.3 describes the chart and always offers the values as a table for screen readers', async () => {
    // Given the chart is shown
    await open(demo(SIX));
    // Then the chart has a description and the table is in the page, visually hidden
    expect(within(velocity()).getByRole('group', { name: 'Velocity chart: planned and completed points of the last 6 completed sprints' })).toBeInTheDocument();
    const table = within(velocity()).getByRole('table', { name: 'Velocity per completed sprint' });
    expect(table.closest('.sr-only')).not.toBeNull();
    expect(within(table).getAllByRole('rowheader').filter((cell) => cell.closest('tbody'))).toHaveLength(6);
  });
});

describe('languages, keyboard and help', () => {
  it('AC6.1 translates the panel into DE, EN, FR and IT', async () => {
    const expected: Record<string, [string, string, string]> = {
      de: ['Velocity', 'Ältere Sprints', 'Tabelle'],
      en: ['Velocity', 'Older sprints', 'Table'],
      fr: ['Vélocité', 'Sprints précédents', 'Tableau'],
      it: ['Velocity', 'Sprint precedenti', 'Tabella']
    };
    const ten = Array.from({ length: 10 }, (_, index) => completed(index + 1, 20, 20));
    await open(demo(ten));
    for (const [language, [title, older, table]] of Object.entries(expected)) {
      // When I change the language
      await i18n.changeLanguage(language);
      // Then title, button for older sprints and switch are in that language
      const panel = await screen.findByRole('region', { name: title });
      expect(within(panel).getByRole('button', { name: new RegExp(older) })).toBeInTheDocument();
      expect(within(panel).getByRole('button', { name: table })).toBeInTheDocument();
    }
    await i18n.changeLanguage('en');
  });

  it('AC6.1 translates the empty state', async () => {
    await open(demo([]));
    await i18n.changeLanguage('de');
    expect(await screen.findByText('Noch kein Sprint abgeschlossen')).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });

  it('AC6.2 operates with the keyboard only: fold, switch to the table and step through the sprints', async () => {
    // Given the panel with six sprints
    const user = userEvent.setup();
    await open(demo(SIX));
    const panel = velocity();
    // When I use only the keyboard
    const toggle = within(panel).getByRole('button', { name: 'Velocity' });
    toggle.focus();
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{Enter}');
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    // Then the sprints can be reached with Tab and show their details
    const chartButton = within(panel).getByRole('button', { name: 'Chart' });
    chartButton.focus();
    await user.tab();
    await user.tab();
    expect(document.activeElement).toBe(panel.querySelector('[data-sprint-id="done-1"]'));
    expect(await within(panel).findByRole('tooltip')).toHaveTextContent('Sprint 1');
    // And the table switch works with Enter
    const tableButton = within(panel).getByRole('button', { name: 'Table' });
    tableButton.focus();
    await user.keyboard('{Enter}');
    expect(tableButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC6.3 has a help topic for the velocity that links to the backlog', async () => {
    // Given the help is open on another page (the board), so it offers the link
    const user = userEvent.setup();
    await open(demo(SIX), '#/board');
    await user.click(screen.getByRole('button', { name: 'Help' }));
    const help = screen.getByRole('complementary');
    // When I search for "Velocity"
    await user.type(within(help).getByRole('searchbox', { name: 'Search help' }), 'Velocity');
    // Then there is a topic that explains the chart and the average, with a link to the backlog
    await user.click(await within(help).findByRole('button', { name: /^Velocity/ }));
    expect(await within(help).findByText(/dashed line shows the average of the last three completed sprints/)).toBeInTheDocument();
    expect(within(help).getByRole('link', { name: 'Open Backlog' })).toHaveAttribute('href', '#/backlog');
  });
});
