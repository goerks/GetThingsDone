import i18n from 'i18next';
import { beforeAll, describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { LocalStorageRepository } from './data/localStorageRepository';
import { initI18n } from './i18n';

beforeAll(() => {
  initI18n('de');
});

describe('missing required fields in the create dialogs (#32)', () => {
  it('AC2.6 reports a missing title in German, in the app, not in the style of the browser', async () => {
    await i18n.changeLanguage('de');
    // Given the app in German with the dialog "Neue Story" open and the title empty
    window.location.hash = '#/board';
    render(<App repository={new LocalStorageRepository()} />);
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'Neue Story' }));
    const dialog = screen.getByRole('dialog', { name: 'Neue Story' });

    // When I click "Story hinzufügen"
    await user.click(within(dialog).getByRole('button', { name: 'Story hinzufügen' }));

    // Then the message says so in German under the field
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte einen Titel eingeben.');
    expect(within(dialog).getByLabelText('Titel')).toHaveAttribute('aria-invalid', 'true');
  });
});
