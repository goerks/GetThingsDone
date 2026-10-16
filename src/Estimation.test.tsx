import { beforeAll, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { todayIso } from './domain/sprints';
import type { Snapshot, Story } from './domain/types';
import { initI18n } from './i18n';

beforeAll(() => {
  initI18n('en');
});

/*
 * Estimating with cards (#54): the test cases the product owner approved in the issue. The demo data has S-3 with 5
 * points, S-1 as the reference of 3 (S-1 and S-5 have 3 points), and S-2 with 2 points.
 */

async function open(hash: string, snapshot: Snapshot = seedSnapshot(todayIso())): Promise<LocalStorageRepository> {
  window.location.hash = hash;
  const repository = new LocalStorageRepository();
  await repository.replaceAll(snapshot);
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
  return repository;
}

const withStories = (snapshot: Snapshot, change: (story: Story) => Story): Snapshot => ({ ...snapshot, stories: snapshot.stories.map(change) });
const saved = async (repository: LocalStorageRepository, id: string): Promise<Story> => {
  const story = (await repository.load()).stories.find((item) => item.id === id);
  if (!story) throw new Error(`Story ${id} is missing`);
  return story;
};
const row = (code: string): HTMLElement => screen.getByRole('group', { name: new RegExp(`${code}: `) });
const notEstimated = (container: HTMLElement): HTMLElement => within(container).getByRole('img', { name: 'Not estimated' });

/** Opens a story from the backlog and returns its dialog. */
async function openStory(user: ReturnType<typeof userEvent.setup>, code: string): Promise<HTMLElement> {
  await user.dblClick(row(code));
  return screen.findByRole('dialog', { name: new RegExp(`^${code}: `) });
}

describe('a new story is not estimated (AC1)', () => {
  it('AC1.1 creates a story from the New story dialog without an estimate', async () => {
    // Given I am in the backlog
    const user = userEvent.setup();
    const repository = await open('#/backlog');
    // When I create the story "Upload a profile picture" with "New story"
    await user.click(screen.getByRole('button', { name: 'New story' }));
    const dialog = screen.getByRole('dialog', { name: 'New story' });
    expect(within(dialog).getByLabelText('Points')).toHaveDisplayValue('Not estimated');
    await user.type(within(dialog).getByLabelText('Title'), 'Upload a profile picture');
    await user.click(within(dialog).getByRole('button', { name: 'Add story' }));
    // Then the story shows the dashed pill with a dash and no number
    const created = row('S-8');
    expect(notEstimated(created)).toHaveTextContent('–');
    expect(within(created).queryByTitle(/points?$/)).not.toBeInTheDocument();
    expect((await repository.load()).stories.find((story) => story.code === 'S-8')).toMatchObject({ points: null, special: null });
  });

  it('AC1.2 creates a story with the quick add without an estimate', async () => {
    // Given I am at the board
    const user = userEvent.setup();
    const repository = await open('#/board');
    // When I add "Password reset" in the column "To do"
    const todo = await screen.findByRole('region', { name: /^To do/ });
    await user.click(within(todo).getByRole('button', { name: '+ Story in To do' }));
    await user.type(within(todo).getByRole('textbox', { name: 'Title of the new story in To do' }), 'Password reset{Enter}');
    // Then the story shows the dashed pill with a dash
    expect(notEstimated(row('S-8'))).toBeInTheDocument();
    const stored = (await repository.load()).stories.find((story) => story.code === 'S-8');
    expect(stored).toMatchObject({ points: null, special: null });
  });

  it('AC1.3 keeps a new story not estimated after the app is loaded again', async () => {
    // Given a story created with the quick add
    const user = userEvent.setup();
    const repository = await open('#/board');
    const todo = await screen.findByRole('region', { name: /^To do/ });
    await user.click(within(todo).getByRole('button', { name: '+ Story in To do' }));
    await user.type(within(todo).getByRole('textbox', { name: 'Title of the new story in To do' }), 'Profile picture{Enter}');
    // When I load the app again
    cleanup();
    render(<App repository={repository} />);
    await screen.findByRole('heading', { level: 1 });
    // Then the story is still not estimated
    expect(notEstimated(row('S-8'))).toBeInTheDocument();
  });
});

describe('estimating with cards (AC2)', () => {
  it('AC2.1 estimates a story by choosing the Fibonacci card 3', async () => {
    // Given the story dialog of a story that is not estimated shows the cards 1 to 21, "?" and the coffee cup
    const user = userEvent.setup();
    const repository = await open('#/backlog', withStories(seedSnapshot(todayIso()), (story) => (story.id === 'story-3' ? { ...story, points: null } : story)));
    const dialog = await openStory(user, 'S-3');
    const cards = within(dialog).getAllByRole('radio');
    expect(cards.map((card) => card.textContent?.replace(/S-\d+$/, ''))).toEqual(['1', '2', '3', '5', '8', '13', '21', '?', '☕']);
    // When I choose the card 3
    await user.click(within(dialog).getByRole('radio', { name: /^3,/ }));
    // Then the card 3 is chosen and the story keeps the 3 after a reload
    expect(within(dialog).getByRole('radio', { name: /^3,/ })).toHaveAttribute('aria-checked', 'true');
    expect(await saved(repository, 'story-3')).toMatchObject({ points: 3, special: null });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(within(row('S-3')).getByTitle('3 points')).toBeInTheDocument();
  });

  it('AC2.2 takes the estimate back when the chosen card is chosen again', async () => {
    // Given S-3 is estimated with 5
    const user = userEvent.setup();
    const repository = await open('#/backlog');
    const dialog = await openStory(user, 'S-3');
    expect(within(dialog).getByRole('radio', { name: '5' })).toHaveAttribute('aria-checked', 'true');
    // When I click the chosen card 5 again
    await user.click(within(dialog).getByRole('radio', { name: '5' }));
    // Then the story is not estimated again
    expect(within(dialog).getByRole('radio', { name: '5' })).toHaveAttribute('aria-checked', 'false');
    expect(await saved(repository, 'story-3')).toMatchObject({ points: null, special: null });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(notEstimated(row('S-3'))).toBeInTheDocument();
  });

  it('AC2.3 estimates an epic with a T-shirt size card', async () => {
    // Given the dialog of the epic "Boards"
    const user = userEvent.setup();
    const repository = await open('#/epics');
    await user.click(screen.getByRole('button', { name: /^Boards/ }));
    const dialog = screen.getByRole('dialog', { name: 'Boards' });
    const sizes = within(dialog).getByRole('radiogroup', { name: 'Size' });
    expect(within(sizes).getAllByRole('radio').map((card) => card.textContent)).toEqual(['XS', 'S', 'M', 'L', 'XL']);
    // When I choose the card L
    await user.click(within(sizes).getByRole('radio', { name: 'L' }));
    // Then L is chosen and stays after a reload
    expect(within(sizes).getByRole('radio', { name: 'L' })).toHaveAttribute('aria-checked', 'true');
    expect((await repository.load()).epics.find((epic) => epic.id === 'epic-boards')?.size).toBe('L');
  });

  it('AC2.4 chooses a card with the arrow keys and Enter', async () => {
    // Given a story that is not estimated, with the focus on the first card
    const user = userEvent.setup();
    const repository = await open('#/backlog', withStories(seedSnapshot(todayIso()), (story) => (story.id === 'story-3' ? { ...story, points: null } : story)));
    const dialog = await openStory(user, 'S-3');
    within(dialog).getAllByRole('radio')[0].focus();
    // When I move to the card 5 with the arrow keys and press Enter
    await user.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}{Enter}');
    // Then the card 5 is chosen, and a screen reader reads it as a chosen radio button named "5"
    const five = within(dialog).getByRole('radio', { name: '5' });
    expect(five).toHaveAttribute('aria-checked', 'true');
    expect(five).toHaveFocus();
    expect(await saved(repository, 'story-3')).toMatchObject({ points: 5 });
  });

  it('AC2.5 treats the cards "?" and the coffee cup as not estimated', async () => {
    // Given the story S-3 is not estimated and the backlog sums 18 points of the other stories of Sprint 1
    const user = userEvent.setup();
    const repository = await open('#/backlog', withStories(seedSnapshot(todayIso()), (story) => (story.id === 'story-3' ? { ...story, points: null } : story)));
    const dialog = await openStory(user, 'S-3');
    // When I choose the card "?"
    await user.click(within(dialog).getByRole('radio', { name: 'Unsure (?)' }));
    // Then the story shows "?" and counts as "without estimate", not as 0 points
    expect(await saved(repository, 'story-3')).toMatchObject({ points: null, special: 'unsure' });
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(within(row('S-3')).getByText('?')).toBeInTheDocument();
    expect(screen.getByText('6 stories · 18 points · 1 without estimate')).toBeInTheDocument();
    // And the coffee cup does the same
    const again = await openStory(user, 'S-3');
    await user.click(within(again).getByRole('radio', { name: 'Break (coffee)' }));
    expect(await saved(repository, 'story-3')).toMatchObject({ points: null, special: 'break' });
    await user.click(within(again).getByRole('button', { name: 'Close' }));
    expect(within(row('S-3')).getByText('☕')).toBeInTheDocument();
    expect(screen.getByText('6 stories · 18 points · 1 without estimate')).toBeInTheDocument();
  });
});

describe('reference stories (AC3)', () => {
  /** S-5 is estimated with 3 like S-1; the demo data marks S-1 as the reference of 3. */
  const demo = (): Snapshot => withStories(seedSnapshot(todayIso()), (story) => (story.id === 'story-1' ? { ...story, reference: false } : story));

  it('AC3.1 marks a story as the reference of its value', async () => {
    // Given S-1 is estimated with 3 and is no reference yet
    const user = userEvent.setup();
    const repository = await open('#/backlog', demo());
    const dialog = await openStory(user, 'S-1');
    // When I mark S-1 as the reference for 3
    await user.click(within(dialog).getByRole('checkbox', { name: 'This story is the reference for 3' }));
    // Then the list "Reference stories" names S-1 at 3, and the card 3 carries the key of the story
    const list = within(dialog).getByRole('list', { name: 'Reference stories' });
    expect(within(list).getByText(/S-1 Create a story with title and description/)).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: '3, reference story S-1' })).toHaveClass('deck__card--reference');
    expect(await saved(repository, 'story-1')).toMatchObject({ reference: true });
  });

  it('AC3.2 replaces the reference of a value when a second story is marked', async () => {
    // Given S-1 is the reference for 3 and S-5 is also estimated with 3
    const user = userEvent.setup();
    const repository = await open('#/backlog');
    const dialog = await openStory(user, 'S-5');
    // When I mark S-5 as the reference for 3
    await user.click(within(dialog).getByRole('checkbox', { name: 'This story is the reference for 3' }));
    // Then a notice says that S-5 replaces S-1, and only S-5 is a reference for 3
    expect(await screen.findByText('S-5 is now the reference for 3; it replaces S-1.')).toBeInTheDocument();
    expect(await saved(repository, 'story-5')).toMatchObject({ reference: true });
    expect(await saved(repository, 'story-1')).toMatchObject({ reference: false });
  });

  it('AC3.3 removes the reference mark', async () => {
    // Given S-1 is the reference for 3
    const user = userEvent.setup();
    const repository = await open('#/backlog');
    const dialog = await openStory(user, 'S-1');
    expect(within(dialog).getByRole('radio', { name: '3, reference story S-1' })).toBeInTheDocument();
    // When I take the mark away
    await user.click(within(dialog).getByRole('checkbox', { name: 'This story is the reference for 3' }));
    // Then the list names no story for 3 and the card has no yellow line
    expect(within(dialog).getByText(/No reference stories yet/)).toBeInTheDocument();
    expect(within(dialog).getByRole('radio', { name: '3' })).not.toHaveClass('deck__card--reference');
    expect(await saved(repository, 'story-1')).toMatchObject({ reference: false });
  });

  it('AC3.4 opens a reference story from the list', async () => {
    // Given S-1 is the reference for 3 and I look at S-3
    const user = userEvent.setup();
    await open('#/backlog');
    const dialog = await openStory(user, 'S-3');
    // When I click S-1 in the list of the reference stories
    await user.click(within(dialog).getByRole('button', { name: /S-1 Create a story with title and description/ }));
    // Then the story S-1 opens
    expect(await screen.findByRole('dialog', { name: /^S-1: / })).toBeInTheDocument();
  });

  it('AC3.5 removes the reference mark when the reference story gets another estimate', async () => {
    // Given S-1 is the reference for 3
    const user = userEvent.setup();
    const repository = await open('#/backlog');
    const dialog = await openStory(user, 'S-1');
    // When I estimate S-1 with 5
    await user.click(within(dialog).getByRole('radio', { name: '5' }));
    // Then S-1 is no longer the reference for 3
    expect(await saved(repository, 'story-1')).toMatchObject({ points: 5, reference: false });
    expect(within(dialog).queryByRole('radio', { name: '3, reference story S-1' })).not.toBeInTheDocument();
  });
});

describe('stories that were estimated before the cards (AC4)', () => {
  it('AC4.1 migrates stories with the old default of 3 points to not estimated', async () => {
    // Given data stored before the cards: S-1 has the old default of 3 points, S-2 has 8, no story has a card marker
    const legacy = seedSnapshot(todayIso());
    window.localStorage.setItem(
      'getitdone.snapshot.v1',
      JSON.stringify({
        ...legacy,
        stories: legacy.stories.map(({ special: _special, reference: _reference, ...story }) => ({ ...story, points: story.id === 'story-1' ? 3 : story.id === 'story-2' ? 8 : story.points }))
      })
    );
    window.location.hash = '#/backlog';
    // When I open the app after the update
    const repository = new LocalStorageRepository();
    render(<App repository={repository} />);
    await screen.findByRole('heading', { level: 1 });
    // Then the story with 3 points is not estimated and the others keep their points
    expect(notEstimated(row('S-1'))).toBeInTheDocument();
    expect(within(row('S-2')).getByTitle('8 points')).toBeInTheDocument();
    expect(await saved(repository, 'story-1')).toMatchObject({ points: null });
    // And a story estimated with 3 afterwards keeps it
    const user = userEvent.setup();
    const dialog = await openStory(user, 'S-1');
    await user.click(within(dialog).getByRole('radio', { name: '3' }));
    cleanup();
    render(<App repository={new LocalStorageRepository()} />);
    await screen.findByRole('heading', { level: 1 });
    expect(await saved(repository, 'story-1')).toMatchObject({ points: 3 });
  });
});

describe('sums with stories that are not estimated (AC5)', () => {
  it('AC5.1 names the stories without estimate in the sum', async () => {
    // Given Sprint 1 holds S-1 with 3 points and S-2 and S-3 without an estimate; the rest is not in the sprint
    await open(
      '#/backlog',
      withStories(seedSnapshot(todayIso()), (story) =>
        story.sprintId === 'sprint-1' ? (['story-1', 'story-2', 'story-3'].includes(story.id) ? { ...story, points: story.id === 'story-1' ? 3 : null } : { ...story, sprintId: null }) : story
      )
    );
    // When I look at the sum
    // Then it says 3 points and 2 without estimate
    expect(screen.getByText('3 stories · 3 points · 2 without estimate')).toBeInTheDocument();
  });

  it('AC5.2 does not count a story without estimate in the sprint plan', async () => {
    // Given Sprint 2 is planned with S-1 (3 points) and S-2 without an estimate
    const user = userEvent.setup();
    const snapshot = seedSnapshot(todayIso());
    await open('', {
      ...snapshot,
      sprints: snapshot.sprints.map((sprint) => (sprint.id === 'sprint-1' ? { ...sprint, state: 'completed' as const } : sprint)),
      stories: snapshot.stories.map((story) => ({
        ...story,
        sprintId: story.id === 'story-1' || story.id === 'story-2' ? 'sprint-2' : story.sprintId === 'sprint-1' ? null : story.sprintId,
        points: story.id === 'story-2' ? null : story.points
      }))
    });
    // When I open the start dialog of the sprint
    await user.click(await screen.findByRole('button', { name: 'Start sprint' }));
    const dialog = await screen.findByRole('dialog', { name: 'Start sprint' });
    // Then 3 points are planned and the dialog names the story without estimate; no 0 is shown for it
    expect(within(dialog).getByText('Planned points').nextSibling).toHaveTextContent('3');
    expect(within(dialog).getByText('1 story without estimate (S-2) counts as no points.')).toBeInTheDocument();
  });

  it('AC5.3 gives the pill of a story without estimate a text for the tooltip and for screen readers', async () => {
    // Given a backlog with a story that is not estimated
    await open('#/backlog', withStories(seedSnapshot(todayIso()), (story) => (story.id === 'story-3' ? { ...story, points: null } : story)));
    // Then the pill has the text "Not estimated" as tooltip and as name
    const pill = notEstimated(row('S-3'));
    expect(pill).toHaveAttribute('title', 'Not estimated');
  });
});
