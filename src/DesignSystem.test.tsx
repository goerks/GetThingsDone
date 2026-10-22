// The design system catalogue (#70): the stories show the real tokens and components.
import { readFileSync } from 'node:fs';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { composeStories } from '@storybook/react-vite';
import * as foundationStories from './design-system/Foundations.stories';
import { COLOR_GROUPS } from './design-system/tokens';
import * as bareStories from './ui/Bare.stories';
import * as buttonStories from './ui/Button.stories';
import * as fieldStories from './ui/Fields.stories';
import * as iconButtonStories from './ui/IconButton.stories';
import * as labelStories from './ui/Labels.stories';

const foundations = composeStories(foundationStories);
const buttons = composeStories(buttonStories);
const bare = composeStories(bareStories);
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
