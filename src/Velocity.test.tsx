import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { applyPreset, PRESETS } from './acceptance/presets';
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
  // The demo data has completed sprints of its own; the tests bring theirs.
  const seed = seedSnapshot(today);
  seed.sprints = seed.sprints.filter((sprint) => sprint.state !== 'completed');
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

async function open(snapshot: Snapshot, hash = '#/board'): Promise<LocalStorageRepository> {
  window.location.hash = hash;
  const repository = new LocalStorageRepository();
  await repository.replaceAll(snapshot);
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
  return repository;
}

const SIX_LABELS = ['Sprint 1: 18 / 12', 'Sprint 2: 22 / 19', 'Sprint 3: 25 / 17', 'Sprint 4: 20 / 22', 'Sprint 5: 24 / 20', 'Sprint 6: 26 / 22'];
const user = (): ReturnType<typeof userEvent.setup> => userEvent.setup();
const button = (): HTMLElement => screen.getByRole('button', { name: /^Velocity/ });
/** Opens the window of the Velocity button on the board. */
async function openVelocity(actor = user()): Promise<HTMLElement> {
  await actor.click(button());
  return screen.getByRole('region', { name: 'Velocity' });
}
const bars = (panel: HTMLElement): Element[] => [...panel.querySelectorAll('[data-sprint-id]')];

describe('velocity window at the board', () => {
  it('AC1.1 shows two bars with numbers per sprint, in order, with a legend', async () => {
    // Given six completed sprints
    await open(demo(SIX));
    // When I open the Velocity window at the board
    const panel = await openVelocity();
    // Then it shows planned and done per sprint, Sprint 1 to 6, and the legend names both
    expect(bars(panel).map((node) => node.getAttribute('aria-label'))).toEqual([
      'Sprint 1: 18 / 12',
      'Sprint 2: 22 / 19',
      'Sprint 3: 25 / 17',
      'Sprint 4: 20 / 22',
      'Sprint 5: 24 / 20',
      'Sprint 6: 26 / 22'
    ]);
    expect([...bars(panel)[0].querySelectorAll('text.velocity-chart__value')].map((node) => node.textContent)).toEqual(['18', '12']);
    const legend = panel.querySelector<HTMLElement>('.velocity__legend')!;
    expect(within(legend).getByText('Planned')).toBeInTheDocument();
    expect(within(legend).getByText('Done')).toBeInTheDocument();
  });

  it('AC1.2 draws the done bar higher than the planned bar when more was done', async () => {
    await open(demo(SIX));
    const sprint = (await openVelocity()).querySelector('[data-sprint-id="done-4"]')!;
    const height = (selector: string): number => Number(sprint.querySelector(selector)!.getAttribute('height'));
    expect(height('.velocity-chart__done')).toBeGreaterThan(height('.velocity-chart__planned'));
  });

  it('AC1.3 shows the last 8 of 10 sprints and the older ones after "Older sprints"', async () => {
    // Given 10 completed sprints
    const actor = user();
    await open(demo(Array.from({ length: 10 }, (_, index) => completed(index + 1, 20, 20))));
    const panel = await openVelocity(actor);
    const names = (): string[] => bars(panel).map((node) => node.querySelector('text:last-child')!.textContent ?? '');
    // Then Sprint 3 to 10 are shown
    expect(names()).toEqual(['Sprint 3', 'Sprint 4', 'Sprint 5', 'Sprint 6', 'Sprint 7', 'Sprint 8', 'Sprint 9', 'Sprint 10']);
    // When I press "Older sprints"
    await actor.click(within(panel).getByRole('button', { name: /Older sprints/ }));
    // Then Sprint 1 and 2 are there as well, and the button is gone
    expect(names()).toHaveLength(10);
    expect(names()[0]).toBe('Sprint 1');
    expect(within(panel).queryByRole('button', { name: /Older sprints/ })).not.toBeInTheDocument();
  });

  it('AC1.4 shows the average on the button and opens and closes with the button, Esc, the close button and a click next to it', async () => {
    // Given the board with six completed sprints
    const actor = user();
    await open(demo(SIX));
    // Then the button shows the average and the window is closed
    expect(button()).toHaveTextContent('Velocity · Ø 21');
    expect(button()).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('region', { name: 'Velocity' })).not.toBeInTheDocument();
    // When I open it, it shows the average in its head; the button closes it again
    const panel = await openVelocity(actor);
    expect(button()).toHaveAttribute('aria-expanded', 'true');
    expect(panel).toHaveTextContent('Ø 21 points · last 3 sprints');
    await actor.click(button());
    expect(screen.queryByRole('region', { name: 'Velocity' })).not.toBeInTheDocument();
    // And Esc, the close button and a click next to the window close it as well
    await openVelocity(actor);
    await actor.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Velocity' })).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
    await openVelocity(actor);
    await actor.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('region', { name: 'Velocity' })).not.toBeInTheDocument();
    await openVelocity(actor);
    await actor.click(screen.getByRole('heading', { level: 1 }));
    expect(screen.queryByRole('region', { name: 'Velocity' })).not.toBeInTheDocument();
  });

  it('AC1.5 shows the details of a sprint on keyboard focus', async () => {
    // Given Sprint 4 got 2 stories with 5 points during the sprint
    const actor = user();
    await open(demo(SIX));
    const panel = await openVelocity(actor);
    // When I go to Sprint 4
    const sprint = panel.querySelector<SVGElement>('[data-sprint-id="done-4"]')!;
    sprint.focus();
    // Then the name, the dates, planned, done with share and the added points are shown
    const tip = await within(panel).findByRole('tooltip');
    expect(tip).toHaveTextContent('Sprint 4');
    expect(tip).toHaveTextContent('Planned at start 20 · Done 22 (110 %)');
    expect(tip).toHaveTextContent('+2 stories, +5 points added');
  });

  it('AC1.6 adds a newly completed sprint to the chart', async () => {
    // Given Sprint 7 runs with 24 points; S-5 (3 points) is done
    const actor = user();
    await open(demo(SIX));
    expect(screen.getByRole('heading', { name: 'Sprint 7', level: 1 })).toBeInTheDocument();
    // When I complete Sprint 7
    await actor.click(screen.getByRole('button', { name: 'Complete sprint' }));
    await actor.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Complete sprint' }));
    // Then Sprint 7 is in the chart with 24 planned and 3 done
    const panel = await openVelocity(actor);
    expect(panel.querySelector('[data-sprint-id="sprint-1"]')).toHaveAttribute('aria-label', 'Sprint 7: 24 / 3');
  });

  it('AC1.7 is also there while no sprint runs', async () => {
    // Given every sprint is completed
    const snapshot = demo(SIX);
    await open({ ...snapshot, sprints: snapshot.sprints.map((sprint) => ({ ...sprint, state: 'completed' as const })) });
    // Then the button is in the head of the board
    expect(button()).toBeInTheDocument();
  });
});

describe('test data of the preview', () => {
  it('AC7.1 loads test data with six completed sprints and a running sprint that can be completed', async () => {
    // Given the demo data and the preset "6 abgeschlossene Sprints" of the acceptance panel
    const actor = user();
    let reloaded = false;
    await applyPreset('velocity6', () => {
      reloaded = true;
    });
    expect(reloaded).toBe(true);
    // When the page has loaded again
    window.location.hash = '#/board';
    render(<App repository={new LocalStorageRepository()} />);
    await screen.findByRole('heading', { name: 'Sprint 7', level: 1 });
    // Then the button shows the average, the window has the six sprints and Sprint 8 is planned with 30 points
    expect(button()).toHaveTextContent('Velocity · Ø 21');
    expect(bars(await openVelocity(actor)).map((node) => node.getAttribute('aria-label'))).toEqual(SIX_LABELS);
    await actor.click(screen.getByRole('button', { name: 'Close' }));
    // And the running Sprint 7 can be completed and is the seventh sprint
    await actor.click(screen.getByRole('button', { name: 'Complete sprint' }));
    await actor.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Complete sprint' }));
    expect(bars(await openVelocity(actor))).toHaveLength(7);
  });

  it.each(PRESETS.filter((preset) => preset.id !== 'demo').map((preset) => [preset.id] as const))('AC7.1 builds the preset %s with a sprint count and points as described', (id) => {
    const snapshot = PRESETS.find((preset) => preset.id === id)!.build(today);
    const completedCount = snapshot.sprints.filter((sprint) => sprint.state === 'completed').length;
    expect({ velocity6: 6, velocity10: 10, velocity2: 2, velocity1: 1, velocity0: 0, velocityStart: 6 }[id]).toBe(completedCount);
    expect(snapshot.sprints.filter((sprint) => sprint.state === 'running')).toHaveLength(id === 'velocityStart' ? 0 : 1);
  });
});

describe('average velocity', () => {
  it('AC2.1 shows the average of the last 3 sprints in the head and on a dashed line', async () => {
    // Given Sprint 4, 5, 6 have 22, 20 and 22 done points
    await open(demo(SIX));
    const panel = await openVelocity();
    // Then the head says Ø 21 and the dashed line is labelled
    expect(panel).toHaveTextContent('Ø 21 points · last 3 sprints');
    expect(panel.querySelector('.velocity-chart__average-label')).toHaveTextContent('Ø 21 (last 3)');
    expect(panel.querySelector('line.velocity-chart__average')).toBeInTheDocument();
  });

  it('AC2.2 names the number of sprints when only 2 are completed', async () => {
    await open(demo([completed(1, 20, 12), completed(2, 30, 24)]));
    expect(await openVelocity()).toHaveTextContent('Ø 18 points · 2 sprints');
    expect(button()).toHaveTextContent('Velocity · Ø 18');
  });

  it('AC2.3 names the single sprint when only 1 is completed', async () => {
    await open(demo([completed(1, 20, 12)]));
    expect(await openVelocity()).toHaveTextContent('Ø 12 points · 1 sprint');
  });
});

describe('planned points next to the average', () => {
  it('AC3.1 shows planned points and the average on each open sprint of the backlog', async () => {
    // Given Sprint 7 runs with 24 points, Sprint 8 is planned with 30, the average is 21
    await open(demo(SIX), '#/backlog');
    // Then each shows its points next to Ø 21
    expect(within(screen.getByRole('region', { name: 'Sprint 7' })).getByTestId('sprint-plan')).toHaveTextContent('24 planned · Ø 21');
    expect(within(screen.getByRole('region', { name: 'Sprint 8' })).getByTestId('sprint-plan')).toHaveTextContent('30 planned · Ø 21');
  });

  it('AC3.2 shows the same on the story map', async () => {
    await open(demo(SIX), '#/map');
    expect(screen.getAllByTestId('sprint-plan').map((node) => node.textContent)).toEqual(['24 planned · Ø 21', '30 planned · Ø 21']);
  });

  it('AC3.3 shows the same in the start dialog', async () => {
    // Given no sprint runs and Sprint 8 is planned
    const actor = user();
    const snapshot = demo(SIX);
    await open({ ...snapshot, sprints: snapshot.sprints.filter((sprint) => sprint.id !== 'sprint-1') });
    // When I open "Start sprint"
    await actor.click(await screen.findByRole('button', { name: 'Start sprint' }));
    // Then the dialog shows 30 planned · Ø 21
    expect(within(screen.getByRole('dialog')).getByTestId('sprint-plan')).toHaveTextContent('30 planned · Ø 21');
  });

  it('AC3.4 shows only the planned points while no sprint is completed', async () => {
    await open(demo([]), '#/backlog');
    expect(within(screen.getByRole('region', { name: 'Sprint 7' })).getByTestId('sprint-plan')).toHaveTextContent(/^24 planned$/);
  });

  it('AC3.5 follows the planning when a story is moved into the sprint', async () => {
    // Given Sprint 8 has 30 points
    const actor = user();
    await open(demo(SIX));
    // When S-6 (5 points) is planned in Sprint 8 in its story dialog
    await actor.click(screen.getByRole('group', { name: /^S-6: / }));
    await actor.selectOptions(within(screen.getByRole('dialog')).getByLabelText('Sprint'), 'sprint-2');
    await actor.keyboard('{Escape}');
    await actor.click(screen.getByRole('link', { name: 'Backlog' }));
    // Then Sprint 8 shows 35 planned
    expect(within(await screen.findByRole('region', { name: 'Sprint 8' })).getByTestId('sprint-plan')).toHaveTextContent('35 planned · Ø 21');
  });

  it('AC3.6 does not add a velocity panel to the backlog', async () => {
    await open(demo(SIX), '#/backlog');
    expect(screen.queryByRole('region', { name: 'Velocity' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Velocity/ })).not.toBeInTheDocument();
  });
});

describe('empty state', () => {
  it('AC4.1 explains why there is no chart while no sprint is completed', async () => {
    // Given no completed sprint
    await open(demo([]));
    // Then the button has no average, and the window says why there is no chart
    expect(button()).toHaveTextContent(/^Velocity$/);
    const panel = await openVelocity();
    expect(panel).toHaveTextContent('No sprint completed yet');
    expect(panel).toHaveTextContent('As soon as you complete a sprint on the board, you see here how many points were planned and done.');
    expect(panel.querySelector('svg')).not.toBeInTheDocument();
    expect(panel).not.toHaveTextContent('Ø');
  });
});

describe('table and accessibility', () => {
  it('AC5.1 shows the table together with the chart, newest sprint first, with the points added and the average in the footer', async () => {
    // Given the six sprints
    await open(demo(SIX));
    // When I open the window
    const panel = await openVelocity();
    // Then the chart and the table are both there, no switch, the table lists all six, newest first
    expect(panel.querySelector('svg')).toBeInTheDocument();
    expect(within(panel).queryByRole('button', { name: 'Table' })).not.toBeInTheDocument();
    const table = within(panel).getByRole('table');
    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual(['Sprint', 'Period', 'Completed', 'Planned at start', 'Added', 'Done', 'Share']);
    const rows = within(table).getAllByRole('row').slice(1, 7);
    expect(rows.map((row) => within(row).getByRole('rowheader').textContent)).toEqual(['Sprint 6', 'Sprint 5', 'Sprint 4', 'Sprint 3', 'Sprint 2', 'Sprint 1']);
    expect([...rows[2].querySelectorAll('td')].filter((_, index) => index > 1).map((cell) => cell.textContent)).toEqual(['20', '+5', '22', '110 %']);
    expect(table).toHaveTextContent('Ø of the last 3 sprints: 21');
  });

  it('AC5.2 lists all 10 sprints in the table, not only 8', async () => {
    await open(demo(Array.from({ length: 10 }, (_, index) => completed(index + 1, 20, 20))));
    const table = within(await openVelocity()).getByRole('table');
    expect(within(table).getAllByRole('rowheader').filter((cell) => cell.closest('tbody'))).toHaveLength(10);
  });

  it('AC5.3 describes the chart for screen readers', async () => {
    await open(demo(SIX));
    const panel = await openVelocity();
    expect(within(panel).getByRole('group', { name: 'Velocity chart: planned and completed points of the last 6 completed sprints' })).toBeInTheDocument();
    expect(within(panel).getByRole('table', { name: 'Velocity per completed sprint' })).toBeInTheDocument();
  });
});

describe('languages, keyboard and help', () => {
  it('AC6.1 translates the button and the window into DE, EN, FR and IT', async () => {
    const expected: Record<string, [string, string, string]> = {
      de: ['Velocity · Ø 21', 'Ältere Sprints', 'Schliessen'],
      en: ['Velocity · Ø 21', 'Older sprints', 'Close'],
      fr: ['Vélocité · Ø 21', 'Sprints précédents', 'Fermer'],
      it: ['Velocity · Ø 21', 'Sprint precedenti', 'Chiudi']
    };
    await open(demo(Array.from({ length: 10 }, (_, index) => completed(index + 1, 20, 21))));
    const actor = user();
    for (const [language, [label, older, close]] of Object.entries(expected)) {
      // When I change the language
      await i18n.changeLanguage(language);
      // Then the button, the button for older sprints and the close button are in that language
      const toggle = await screen.findByRole('button', { name: label });
      await actor.click(toggle);
      expect(within(screen.getByRole('region', { name: /Velocity|Vélocité/ })).getByRole('button', { name: new RegExp(older) })).toBeInTheDocument();
      await actor.click(screen.getByRole('button', { name: close }));
    }
    await i18n.changeLanguage('en');
  });

  it('AC6.1 translates the empty state', async () => {
    await open(demo([]));
    await i18n.changeLanguage('de');
    await user().click(await screen.findByRole('button', { name: 'Velocity' }));
    expect(await screen.findByText('Noch kein Sprint abgeschlossen')).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });

  it('AC6.2 operates with the keyboard only: open, step through the sprints, close', async () => {
    // Given the board with six sprints
    const actor = user();
    await open(demo(SIX));
    // When I use only the keyboard
    button().focus();
    await actor.keyboard('{Enter}');
    const panel = screen.getByRole('region', { name: 'Velocity' });
    // Then the window is open, the sprints can be reached with Tab and show their details
    await actor.tab();
    await actor.tab();
    expect(document.activeElement).toBe(panel.querySelector('[data-sprint-id="done-1"]'));
    expect(await within(panel).findByRole('tooltip')).toHaveTextContent('Sprint 1');
    // And Esc closes it and the focus is back on the button
    await actor.keyboard('{Escape}');
    expect(screen.queryByRole('region', { name: 'Velocity' })).not.toBeInTheDocument();
    expect(button()).toHaveFocus();
  });

  it('AC6.3 has a help topic for the velocity that links to the board', async () => {
    // Given the help is open on another page (the backlog), so it offers the link
    const actor = user();
    await open(demo(SIX), '#/backlog');
    await actor.click(screen.getByRole('button', { name: 'Help' }));
    const help = screen.getByRole('complementary');
    // When I search for "Velocity"
    await actor.type(within(help).getByRole('searchbox', { name: 'Search help' }), 'Velocity');
    // Then there is a topic that explains the chart and the average, with a link to the board
    await actor.click(await within(help).findByRole('button', { name: /^Velocity/ }));
    expect(await within(help).findByText(/dashed line shows the average of the last three completed sprints/)).toBeInTheDocument();
    expect(within(help).getByRole('link', { name: 'Open Board' })).toHaveAttribute('href', '#/board');
  });
});
