import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { seedSnapshot } from './data/seed';
import { todayIso } from './domain/sprints';
import i18n, { initI18n } from './i18n';
import type { Snapshot } from './domain/types';

/*
 * Major UI update (#55): board cards, compact board, backlog points and numbers, no shortcut hints. The tests follow
 * the test cases the PO approved in the issue (AC1 and AC8.1 to AC8.3 partly are checked by hand or in e2e/uiUpdate.spec.ts).
 */

beforeAll(() => {
  initI18n('en');
});

beforeEach(async () => {
  await i18n.changeLanguage('en');
  window.localStorage.clear();
});

const demo = (change: (snapshot: Snapshot) => Snapshot = (snapshot) => snapshot): Snapshot => change(seedSnapshot(todayIso()));

async function open(hash: string, snapshot: Snapshot = demo()): Promise<LocalStorageRepository> {
  window.location.hash = hash;
  const repository = new LocalStorageRepository();
  await repository.replaceAll(snapshot);
  render(<App repository={repository} />);
  await screen.findByRole('heading', { level: 1 });
  return repository;
}

const card = (code: string): Promise<HTMLElement> => screen.findByRole('group', { name: new RegExp(`^${code}:`) });
/** A backlog row is named "Rank 3, S-3: …". */
const row = (code: string): Promise<HTMLElement> => screen.findByRole('group', { name: new RegExp(`, ${code}:`) });

describe('board card', () => {
  it('AC2.1 shows the progress as a small "☑ 2/4" and no progress bar', async () => {
    // Given S-1 with 4 acceptance criteria, 2 of them accepted
    await open('#/board');
    // When I look at the card of S-1
    const s1 = await card('S-1');
    // Then it says "☑ 2/4" and has no progress bar
    expect(within(s1).getByText('☑ 2/4')).toBeInTheDocument();
    expect(s1.querySelector('.progress')).toBeNull();
  });

  it('AC2.2 turns green when all criteria are accepted', async () => {
    // Given S-5 with all criteria accepted and S-3 with none
    await open('#/board', demo((snapshot) => ({ ...snapshot, stories: snapshot.stories.map((story) => (story.code === 'S-5' ? { ...story, criteria: story.criteria.map((item) => ({ ...item, done: true })) } : story)) })));
    // When I compare both cards
    const s5 = await card('S-5');
    const s3 = await card('S-3');
    // Then only S-5 has the green indicator
    expect(s5.querySelector('.card__tasks--done')).not.toBeNull();
    expect(s3.querySelector('.card__tasks')).not.toBeNull();
    expect(s3.querySelector('.card__tasks--done')).toBeNull();
  });

  it('AC2.3 changes with the criteria of the story', async () => {
    // Given S-1 shows "☑ 2/4"
    const user = userEvent.setup();
    await open('#/board');
    await user.click(await card('S-1'));
    // When I tick one more criterion and close the story
    const dialog = await screen.findByRole('dialog', { name: /^S-1:/ });
    const open_ = within(dialog).getAllByRole('checkbox').filter((box) => !(box as HTMLInputElement).checked);
    await user.click(open_[0]);
    await user.keyboard('{Escape}');
    // Then the card shows "☑ 3/4"
    expect(within(await card('S-1')).getByText('☑ 3/4')).toBeInTheDocument();
  });

  it('AC2.4 reads "2 of 4 criteria accepted" to a screen reader, not only "2/4"', async () => {
    // Given the board is open
    await open('#/board');
    // When a screen reader reaches the indicator of S-1
    const s1 = await card('S-1');
    // Then the full sentence is there, and the short form is hidden from it
    expect(within(s1).getByText('2 of 4 criteria accepted')).toHaveClass('sr-only');
    expect(within(s1).getByText('☑ 2/4').parentElement?.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('AC3.1 shows the priority as a letter with the full word as tooltip and screen reader text', async () => {
    // Given S-1 is "Must", S-3 "Should" and S-6 "Could"
    await open('#/board');
    // When I look at the cards
    const letters: Array<[string, string, string]> = [
      ['S-1', 'M', 'Must'],
      ['S-3', 'S', 'Should'],
      ['S-6', 'C', 'Could']
    ];
    for (const [code, letter, word] of letters) {
      // Then the letter and, as tooltip and for screen readers, the full word
      const badge = (await card(code)).querySelector('.card__letter') as HTMLElement;
      expect(badge).toHaveTextContent(`${letter}Priority: ${word}`);
      expect(badge).toHaveAttribute('title', `Priority: ${word}`);
      expect(within(badge).getByText(`Priority: ${word}`)).toHaveClass('sr-only');
    }
  });

  it('AC3.2 shows the epic first, then the labels, and the tasks at the end of one line', async () => {
    // Given S-6 with an epic and the labels "UI" and "Accessibility"
    await open('#/board');
    // When I look at its card
    const meta = (await card('S-6')).querySelector('.card__meta') as HTMLElement;
    // Then one line holds the epic, then the two labels, then "☑ 0/4"
    const parts = Array.from(meta.children);
    expect(parts[0]).toHaveClass('epic');
    expect(parts.slice(1, -1).map((part) => part.textContent?.replace(/^Labels: /, '').trim())).toEqual(['UI', 'Accessibility']);
    expect(parts[parts.length - 1]).toHaveClass('card__tasks');
    expect(parts[parts.length - 1]).toHaveTextContent('☑ 0/4');
  });

  it('AC3.3 shows only two labels and "+2" with a tooltip for the rest', async () => {
    // Given a story with four labels
    await open(
      '#/board',
      demo((snapshot) => ({
        ...snapshot,
        fields: snapshot.fields.map((field) =>
          field.id === 'field-demo-labels' ? { ...field, options: [...field.options, { id: 'opt-backup', label: 'Backup', colorKey: 'green' as const }] } : field
        ),
        stories: snapshot.stories.map((story) =>
          story.code === 'S-6' ? { ...story, values: { ...story.values, 'field-demo-labels': ['opt-ui', 'opt-data', 'opt-a11y', 'opt-backup'] } } : story
        )
      }))
    );
    // When I look at its card
    const meta = (await card('S-6')).querySelector('.card__meta') as HTMLElement;
    // Then two labels and "+2" are shown, and the tooltip names the others
    expect(meta.querySelectorAll('.card-field:not(.card-field--more)')).toHaveLength(2);
    const more = meta.querySelector('.card-field--more') as HTMLElement;
    expect(more).toHaveTextContent('+2');
    expect(more).toHaveAttribute('title', '2 more: Accessibility, Backup');
  });

  it('AC3.4 shows no empty chips for a story without labels', async () => {
    // Given S-3 without labels
    await open('#/board');
    // When I look at its card
    const meta = (await card('S-3')).querySelector('.card__meta') as HTMLElement;
    // Then only the epic is there
    expect(meta.querySelector('.epic')).not.toBeNull();
    expect(meta.querySelectorAll('.card-field')).toHaveLength(0);
  });

  it('AC3.5 reads the criteria in the chosen language', async () => {
    // Given the board is open in German
    await open('#/board');
    await i18n.changeLanguage('de');
    // When I look at the card of S-1
    const s1 = await card('S-1');
    // Then the screen reader text is German
    expect(await within(s1).findByText('2 von 4 Kriterien abgenommen')).toBeInTheDocument();
  });
});

describe('compact board', () => {
  const toggle = (): HTMLElement => screen.getByRole('button', { name: 'Compact' });

  it('AC4.1 switches to one line per story with a pressed button', async () => {
    // Given the board is open and "Compact" is not pressed
    const user = userEvent.setup();
    await open('#/board');
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    // When I click "Compact"
    await user.click(toggle());
    // Then the button is pressed and a story shows priority, title, epic dot, "☑ 2/4" and points in one line
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    const s1 = await card('S-1');
    expect(s1).toHaveClass('card--compact');
    expect(s1.querySelector('.card__letter')).not.toBeNull();
    expect(s1.querySelector('.card__epic-dot')).not.toBeNull();
    expect(within(s1).getByText('☑ 2/4')).toBeInTheDocument();
    expect(s1.querySelector('.pill')).not.toBeNull();
    expect(s1.querySelector('.card__meta')).toBeNull();
  });

  it('AC4.2 switches back to the normal cards', async () => {
    // Given the compact view is on
    const user = userEvent.setup();
    await open('#/board');
    await user.click(toggle());
    // When I click "Compact" again
    await user.click(toggle());
    // Then the normal cards are back and the button is not pressed
    expect(toggle()).toHaveAttribute('aria-pressed', 'false');
    expect(await card('S-1')).not.toHaveClass('card--compact');
  });

  it('AC4.3 remembers the choice after a reload', async () => {
    // Given the compact view is on
    const user = userEvent.setup();
    const repository = await open('#/board');
    await user.click(toggle());
    // When I load the app again
    cleanup();
    render(<App repository={repository} />);
    await screen.findByRole('heading', { level: 1 });
    // Then it is still on
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
    expect(await card('S-1')).toHaveClass('card--compact');
  });

  it('AC4.4 switches with the keyboard', async () => {
    // Given the board is open
    const user = userEvent.setup();
    await open('#/board');
    // When I focus "Compact" with Tab and press Enter
    toggle().focus();
    await user.keyboard('{Enter}');
    // Then the compact view is on
    expect(toggle()).toHaveAttribute('aria-pressed', 'true');
  });

  it('AC4.5 gives a compact line the full title and the epic name as tooltips', async () => {
    // Given the compact view and S-6 with a long title
    const user = userEvent.setup();
    await open('#/board');
    await user.click(toggle());
    // When I look at the line
    const s6 = await card('S-6');
    // Then the full title is the tooltip, and the epic dot names its epic
    expect(within(s6).getByRole('button', { name: /Operate the board with the keyboard only/ })).toHaveAttribute('title', 'Operate the board with the keyboard only');
    expect(s6.querySelector('.card__epic-dot')?.getAttribute('title')).toBeTruthy();
  });
});

describe('backlog', () => {
  it('AC5.1 shows the points of the sprint header as round as those of a story', async () => {
    // Given the backlog with Sprint 1 and 23 points
    await open('#/backlog');
    // When I compare the sprint total with the points of S-3
    const sprint = screen.getByRole('region', { name: 'Sprint 1' });
    const total = within(sprint).getByTestId('sprint-points');
    const s3 = within(await row('S-3')).getByRole('button', { name: /points/i });
    // Then both are round points
    expect(total).toHaveClass('pill');
    expect(s3).toHaveClass('pill');
    expect(total).toHaveTextContent('23');
  });

  it('AC6.1 puts the number of an item outside the row, as its first element', async () => {
    // Given the backlog is open
    await open('#/backlog');
    // When I look at the row of S-3
    const s3 = await row('S-3');
    // Then its number is a separate element that the style places on the left, outside the white row
    const code = s3.querySelector('.backlog__code');
    expect(code).toHaveTextContent('S-3');
    expect(s3.querySelector('.backlog__rank')).toBeNull();
    expect(s3.firstElementChild).toBe(code);
  });
});

describe('points in the backlog', () => {
  const pointsOf = async (code: string): Promise<HTMLElement> => within(await row(code)).getByRole('button', { name: /points of/i });
  const total = (): HTMLElement => within(screen.getByRole('region', { name: 'Sprint 1' })).getByTestId('sprint-points');
  const input = (code: string): HTMLElement => within(screen.getByRole('group', { name: new RegExp(`^Rank \\d+, ${code}:`) })).getByRole('textbox');

  it('AC7.1 edits the points with a click and Enter, and the sprint total follows', async () => {
    // Given S-1 has 3 points and the sprint 23
    const user = userEvent.setup();
    const repository = await open('#/backlog');
    // When I click the 3, type 8 and press Enter
    await user.click(await pointsOf('S-1'));
    await user.keyboard('8{Enter}');
    // Then S-1 has 8 points, the sprint 28, also after loading again
    expect(await pointsOf('S-1')).toHaveTextContent('8');
    expect(total()).toHaveTextContent('28');
    expect((await repository.load()).stories.find((story) => story.code === 'S-1')?.points).toBe(8);
  });

  it('AC7.2 saves when I click away', async () => {
    // Given S-1 has 3 points
    const user = userEvent.setup();
    await open('#/backlog');
    // When I click the 3, type 5 and click somewhere else
    await user.click(await pointsOf('S-1'));
    await user.keyboard('5');
    await user.click(screen.getByRole('heading', { level: 1 }));
    // Then S-1 has 5 points and the sprint 25
    expect(await pointsOf('S-1')).toHaveTextContent('5');
    expect(total()).toHaveTextContent('25');
  });

  it('AC7.3 cancels with Escape', async () => {
    // Given S-1 has 3 points
    const user = userEvent.setup();
    await open('#/backlog');
    // When I click the 3, type 9 and press Escape
    await user.click(await pointsOf('S-1'));
    await user.keyboard('9{Escape}');
    // Then S-1 still has 3 points and the sprint 23
    expect(await pointsOf('S-1')).toHaveTextContent('3');
    expect(total()).toHaveTextContent('23');
  });

  it.each([['abc'], ['-3'], ['3,5'], ['101']])('AC7.4 does not save "%s" and shows the hint', async (typed) => {
    // Given S-1 has 3 points and the field is open
    const user = userEvent.setup();
    await open('#/backlog');
    await user.click(await pointsOf('S-1'));
    // When I type the value and press Enter
    await user.keyboard(`${typed}{Enter}`);
    // Then it is not saved, the field is red with the hint, and Escape gives back the 3
    expect(input('S-1')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Only numbers, 0–100');
    expect(total()).toHaveTextContent('23');
    await user.keyboard('{Escape}');
    expect(await pointsOf('S-1')).toHaveTextContent('3');
  });

  it.each([['0'], ['100']])('AC7.4 saves the limit %s', async (typed) => {
    // Given S-1 has 3 points
    const user = userEvent.setup();
    await open('#/backlog');
    // When I type the limit and press Enter
    await user.click(await pointsOf('S-1'));
    await user.keyboard(`${typed}{Enter}`);
    // Then it is saved
    expect(await pointsOf('S-1')).toHaveTextContent(typed);
  });

  it('AC7.5 edits with the keyboard only and keeps the focus on the points', async () => {
    // Given the backlog is open
    const user = userEvent.setup();
    await open('#/backlog');
    // When I focus the points of S-1, press Enter, type 8 and press Enter
    (await pointsOf('S-1')).focus();
    await user.keyboard('{Enter}8{Enter}');
    // Then S-1 has 8 points and the focus is back on them
    const points = await pointsOf('S-1');
    expect(points).toHaveTextContent('8');
    expect(points).toHaveFocus();
  });

  it('AC7.6 does not open the story when I click the points', async () => {
    // Given the backlog is open
    const user = userEvent.setup();
    await open('#/backlog');
    // When I click the points of S-1
    await user.click(await pointsOf('S-1'));
    // Then only the field opens
    expect(input('S-1')).toHaveFocus();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('AC7.7 removes the points when the field is empty', async () => {
    // Given S-1 has 3 points and the sprint 23
    const user = userEvent.setup();
    const repository = await open('#/backlog');
    // When I clear the field and press Enter
    await user.click(await pointsOf('S-1'));
    await user.clear(input('S-1'));
    await user.keyboard('{Enter}');
    // Then S-1 has no points (0) and the sprint 20, also after loading again
    expect(await pointsOf('S-1')).toHaveTextContent('0');
    expect(total()).toHaveTextContent('20');
    expect((await repository.load()).stories.find((story) => story.code === 'S-1')?.points).toBe(0);
  });
});

describe('no shortcut hints', () => {
  it('AC8.1 writes no shortcut on the "New" buttons, which keep working', async () => {
    // Given the pages with a "New …" button
    for (const [hash, name] of [['#/board', 'New story'], ['#/backlog', 'New story'], ['#/map', 'New story'], ['#/epics', 'New epic']] as const) {
      cleanup();
      await open(hash);
      // When I look at the button
      const button = screen.getByRole('button', { name });
      // Then it has only its text, but still announces the shortcut to assistive technology
      expect(button.textContent).toBe(name);
      expect(button.querySelector('kbd')).toBeNull();
      expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+N Meta+N');
    }
  });

  it('AC8.2 shows no hint in the search field, its list or the dialogs', async () => {
    // Given the board is open
    const user = userEvent.setup();
    await open('#/board');
    // When I look at the search field, open it and type, and open "New story"
    expect(document.querySelector('.search__shortcut')).toBeNull();
    await user.click(screen.getByRole('combobox', { name: /search/i }));
    await user.keyboard('S-');
    // Then no key legend and no key hint is there
    expect(document.querySelector('.search__dropdown kbd')).toBeNull();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'New story' }));
    const dialog = await screen.findByRole('dialog', { name: 'New story' });
    expect(within(dialog).queryByText(/saves · Esc cancels/)).not.toBeInTheDocument();
  });

  it('AC8.3 keeps the shortcuts working', async () => {
    // Given the board is open and no text field has the focus
    const user = userEvent.setup();
    await open('#/board');
    // When I press Ctrl+F, Escape and Ctrl+N
    await user.keyboard('{Control>}f{/Control}');
    expect(screen.getByRole('combobox', { name: /search/i })).toHaveFocus();
    await user.keyboard('{Escape}');
    (document.activeElement as HTMLElement | null)?.blur();
    await user.keyboard('{Control>}n{/Control}');
    // Then the search got the focus and the dialog "New story" opens
    expect(await screen.findByRole('dialog', { name: 'New story' })).toBeInTheDocument();
  });
});

describe('search list', () => {
  it('AC8.5 shows no key legend in the search list, and the keys keep working', async () => {
    // Given the board is open
    const user = userEvent.setup();
    await open('#/board');
    // When I click into the search field and type "S-"
    await user.click(screen.getByRole('combobox', { name: /search/i }));
    await user.keyboard('S-');
    // Then the list shows no line with key shortcuts
    const dropdown = document.querySelector('.search__dropdown') as HTMLElement;
    expect(dropdown.querySelector('kbd')).toBeNull();
    expect(within(dropdown).queryByText(/^(move|open|close|fields)$/)).not.toBeInTheDocument();
    // And the arrow keys and Enter still open a result
    await user.keyboard('{ArrowDown}{Enter}');
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });
});

describe('story map cards', () => {
  it('AC9.1 shows a card on the story map exactly like on the board', async () => {
    // Given S-6 as the board shows it
    await open('#/board');
    const onBoard = (await card('S-6')).innerHTML;
    cleanup();
    // When I look at the card of S-6 on the story map
    await open('#/map');
    const onMap = await card('S-6');
    // Then it is the same card: same parts, same markup
    expect(onMap).toHaveClass('card');
    expect(onMap.innerHTML).toBe(onBoard);
  });

  it('AC9.2 shows one line per story on the map with "Compact", like on the board', async () => {
    // Given the story map
    const user = userEvent.setup();
    await open('#/map');
    // When I press "Compact"
    await user.click(screen.getByRole('button', { name: 'Compact' }));
    // Then a card is the compact line of the board
    const onMap = await card('S-6');
    expect(onMap).toHaveClass('card--compact');
    expect(onMap.querySelector('.card__meta')).toBeNull();
    expect(within(onMap).getByText('☑ 0/4')).toBeInTheDocument();
  });
});
