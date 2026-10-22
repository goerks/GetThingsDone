// The design system catalogue (#70): the stories show the real tokens and components.
import { readFileSync } from 'node:fs';
import { beforeAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as foundationStories from './design-system/Foundations.stories';
import { COLOR_GROUPS } from './design-system/tokens';
import * as appStories from './design-system/App.stories';
import { initI18n } from './i18n';
import * as bareStories from './ui/Bare.stories';
import * as buttonStories from './ui/Button.stories';
import * as fieldStories from './ui/Fields.stories';
import * as iconButtonStories from './ui/IconButton.stories';
import * as labelStories from './ui/Labels.stories';

beforeAll(() => {
  initI18n('en');
});

const foundations = composeStories(foundationStories);
const buttons = composeStories(buttonStories);
const bare = composeStories(bareStories);
const appCatalogue = composeStories(appStories);
const iconButtons = composeStories(iconButtonStories);
const fields = composeStories(fieldStories);
const labels = composeStories(labelStories);

const tokensCss = readFileSync('docs/design/tokens.css', 'utf8');

describe('foundations', () => {
  test.each([
    ['Colors', foundations.Colors, ['--bg', '--accent', '--danger', '--ok', '--epic-teal']],
    ['Typography', foundations.Typography, ['--font-size-lg', '--weight-semibold', '--leading-normal']],
    ['Spacing', foundations.Spacing, ['--space-px', '--space-4', '--space-12']],
    ['Radius', foundations.Radius, ['--radius-sm', '--radius-pill', '--radius-round']],
    ['Elevation', foundations.Elevation, ['--elevation-1', '--elevation-4', '--elevation-panel']],
    ['Layers', foundations.Layers, ['--z-header', '--z-dropdown', '--z-menu']],
    ['Motion', foundations.Motion, ['--duration-fast', '--duration-slow', '--ease']],
    ['Icons', foundations.Icons, ['GripIcon', 'TrashIcon']],
    ['Accessibility', foundations.Accessibility, ['Contrast', 'Target size', 'Focus', 'Keyboard']]
  ])('AC1.1 the page "%s" shows its values with names', (_title, Story, names) => {
    // Given the catalogue page
    // When it is shown
    render(<Story />);
    // Then every listed token or rule appears by name
    for (const name of names) expect(screen.getAllByText(name).length).toBeGreaterThan(0);
  });

  test('AC1.1 every token of the colour page is defined in the token file', () => {
    // Given the colours of the catalogue
    const names = COLOR_GROUPS.flatMap((group) => group.names);
    // Then each one is declared in the token file
    for (const name of names) expect(tokensCss).toContain(`${name}:`);
  });

  test('AC1.2 every colour of the catalogue has a light and a dark value', () => {
    // Given the light and the dark block of the token file
    const dark = tokensCss.slice(tokensCss.indexOf(':root[data-theme="dark"]'), tokensCss.indexOf('\n}\n', tokensCss.indexOf(':root[data-theme="dark"]')));
    const light = tokensCss.slice(0, tokensCss.indexOf(':root[data-theme="dark"]'));
    // Then every listed colour is declared in both, except the soft shadow tokens that only switch in value
    for (const name of COLOR_GROUPS.flatMap((group) => group.names)) {
      expect(light).toContain(`${name}:`);
      expect(dark).toContain(`${name}:`);
    }
  });
});

describe('components', () => {
  test('AC1.3 shows every button variant in the normal, small, pressed and disabled state', () => {
    // Given the catalogue page of the button
    // When it is shown
    render(<buttons.Variants />);
    // Then there are seven variants, each in four states
    expect(screen.getAllByRole('button')).toHaveLength(28);
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(7);
    expect(screen.getAllByRole('button').filter((button) => (button as HTMLButtonElement).disabled)).toHaveLength(7);
    // And the variants use the classes of the app
    for (const variant of ['btn--primary', 'btn--quiet', 'btn--ghost', 'btn--danger', 'btn--danger-quiet', 'btn--link']) {
      expect(document.querySelectorAll(`.${variant}`).length).toBeGreaterThan(0);
    }
    expect(document.querySelectorAll('.btn--small').length).toBe(7);
  });

  test('AC1.3 has a hover and a focus story for the button, and the keyboard focuses it', async () => {
    // Given the stories for hover and focus, which play the interaction in the catalogue
    expect(buttons.Hover.play).toBeTypeOf('function');
    expect(buttons.Focus.play).toBeTypeOf('function');
    // When the primary button is shown and I press Tab
    render(<buttons.Focus />);
    await userEvent.tab();
    // Then it has the focus
    expect(screen.getByRole('button', { name: 'Save' })).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Save' })).toHaveClass('btn--primary');
  });

  test('AC1.3 shows the icon button, form fields, checks, badge and pill with their states', () => {
    // Given the catalogue pages
    // When the icon buttons are shown
    const icons = render(<iconButtons.Variants />);
    // Then there are four of them, one switched on and one disabled
    expect(screen.getAllByRole('button')).toHaveLength(4);
    expect(icons.container.querySelectorAll('.icon-btn--quiet')).toHaveLength(2);
    expect(icons.container.querySelectorAll('.icon-btn--on')).toHaveLength(1);
    icons.unmount();
    // When the text fields are shown
    const texts = render(<fields.TextInputs />);
    // Then there is a wrong and a disabled field
    expect(screen.getByLabelText('Wrong')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Disabled')).toBeDisabled();
    texts.unmount();
    // When the checks are shown
    render(<fields.Checks />);
    // Then there are three checkboxes and two radio buttons
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    // And badge and pill render
    render(<labels.Badges />);
    render(<labels.Pills />);
    expect(screen.getByText('Release 1.0')).toHaveClass('badge');
    expect(screen.getByText('13')).toHaveClass('pill');
  });

  test('AC2.1 every class a component renders exists in the style sheet of the app', () => {
    // Given the style sheet of the app
    const css = readFileSync('src/styles/app.css', 'utf8');
    // When the shared components are shown
    render(<buttons.Variants />);
    render(<fields.TextInputs />);
    render(<fields.Selects />);
    render(<fields.Checks />);
    render(<labels.Badges />);
    // Then each class they use is styled by the app, so the catalogue and the app look the same
    const classes = new Set<string>();
    for (const element of document.querySelectorAll('[class]')) element.classList.forEach((name) => classes.add(name));
    const catalogueOnly = (name: string) => name.startsWith('catalogue-');
    for (const name of classes) if (!catalogueOnly(name)) expect(css, name).toContain(`.${name}`);
  });
});

describe('bare elements', () => {
  test('AC1.3 shows the drag handle, check inputs and bare elements', async () => {
    // Given the catalogue page of the bare elements
    // When the handles and the check inputs are shown
    render(<bare.DragHandles />);
    render(<bare.CheckInputs />);
    render(<bare.BareElements />);
    // Then the handles are buttons with a name, the check inputs are checkboxes and radio buttons
    expect(screen.getByRole('button', { name: 'Move Login page' })).toHaveClass('drag-handle');
    expect(screen.getByRole('button', { name: 'Move Sort cards' })).toBeDisabled();
    expect(screen.getAllByRole('checkbox')).toHaveLength(3);
    expect(screen.getAllByRole('radio')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('app components in the catalogue', () => {
  test('AC9.1 shows the cards of stories, epics, releases and sprints with demo data', async () => {
    // Given the catalogue pages with the demo data of the app
    // When the story cards are shown
    const cards = render(<appCatalogue.StoryCards />);
    // Then four story cards with their key and title stand there
    expect(await screen.findAllByRole('group', { name: /^S-\d+: / })).toHaveLength(4);
    cards.unmount();
    // When the compact cards are shown, then there are four of them as well
    const compact = render(<appCatalogue.StoryCardsCompact />);
    expect(await screen.findAllByRole('group', { name: /^S-\d+: / })).toHaveLength(4);
    compact.unmount();
    // When the epic tags, release cards and sprint cards are shown
    const epics = render(<appCatalogue.EpicTagList />);
    // Then the epic names are written, the releases and the sprints are there with their names
    expect(await screen.findByText('Boards')).toBeInTheDocument();
    epics.unmount();
    const releases = render(<appCatalogue.ReleaseCardList />);
    expect(await screen.findByText('Release 1.0 – Public Beta')).toBeInTheDocument();
    releases.unmount();
    render(<appCatalogue.SprintCardList />);
    expect(await screen.findByText('Sprint 1')).toBeInTheDocument();
    expect(screen.getByText('Sprint 2')).toBeInTheDocument();
  });

  test('AC9.2 shows the lanes of the board with cards, an empty lane and the drop target', async () => {
    // Given the lanes of the board
    // When they are shown
    const lanes = render(<appCatalogue.BoardLanes />);
    // Then there is a lane per status, and one of them is empty
    expect(await screen.findAllByRole('region')).toHaveLength(4);
    expect([...lanes.container.querySelectorAll('.column__count')].map((count) => count.textContent)).toContain('0');
    lanes.unmount();
    // When a story is dragged over a lane, then the lane is marked
    const target = render(<appCatalogue.BoardLaneDropTarget />);
    await screen.findAllByRole('region');
    expect(target.container.querySelectorAll('[data-drop-target="true"]')).toHaveLength(1);
  });

  test('AC9.3 shows the header, the filter, the context menu and the notices', async () => {
    // Given the pages of the catalogue
    // When the header is shown, then it has the main navigation
    const header = render(<appCatalogue.HeaderBar />);
    expect(await screen.findByRole('navigation', { name: 'Main' })).toBeInTheDocument();
    header.unmount();
    // When the filter is shown, then "All" is pressed
    const filter = render(<appCatalogue.MemberFilter />);
    expect((await screen.findAllByRole('button', { pressed: true })).length).toBe(1);
    filter.unmount();
    // When the context menu is shown, then it has its items
    const menu = render(<appCatalogue.ContextMenuOpen />);
    expect(await screen.findByRole('menu')).toBeInTheDocument();
    menu.unmount();
    // When the notices are shown, then the message and the action are there
    const notice = render(<appCatalogue.ToastNotice />);
    expect(await screen.findByText('S-3 moved to Done.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeInTheDocument();
    notice.unmount();
    render(<appCatalogue.ToastError />);
    expect(await screen.findByText('The story could not be saved.')).toBeInTheDocument();
  });

  test.each([
    ['story', appCatalogue.StoryDialogOpen],
    ['epic', appCatalogue.EpicDialogOpen],
    ['sprint', appCatalogue.SprintDialogOpen],
    ['release', appCatalogue.ReleaseDialogOpen]
  ])('AC9.4 shows the %s dialog with demo data', async (_kind, Story) => {
    // Given the dialog page
    // When it is shown
    render(<Story />);
    // Then the dialog is open
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  test('AC9.6 the catalogue pages use the components of the app and do not copy their markup', () => {
    // Given the source of the catalogue pages
    const source = readFileSync('src/design-system/App.stories.tsx', 'utf8');
    // Then they import the real components
    for (const name of ['SortableStoryCard', 'BoardColumn', 'ReleaseCard', 'EpicTag', 'StatusDot', 'Header', 'MemberFilterBar', 'ContextMenu', 'SprintLabelContent']) {
      expect(source).toContain(`import`);
      expect(source).toMatch(new RegExp(`import \\{[^}]*\\b${name}\\b[^}]*\\} from`));
    }
    // And they do not write the classes of a card themselves
    expect(source).not.toMatch(/className="(card|release-card|column)\b/);
  });
});
