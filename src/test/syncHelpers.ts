import { screen, waitFor } from '@testing-library/react';
import type userEvent from '@testing-library/user-event';

type User = ReturnType<typeof userEvent.setup>;

/** Synchronises by hand and waits for the notice that ends the run. There is no dialog (AC17): the notice is the answer. */
export async function sync(user: User): Promise<HTMLElement> {
  const seen = new Set(document.querySelectorAll('.toast'));
  await user.click(await screen.findByRole('button', { name: 'Synchronise' }));
  return waitFor(() => {
    const fresh = [...document.querySelectorAll<HTMLElement>('.toast')].find((item) => !seen.has(item));
    if (!fresh) throw new Error('no notice yet');
    return fresh;
  });
}

/** Synchronises by hand when the rule is "I decide": the choice is the only dialog a sync opens. */
export async function syncAsking(user: User): Promise<HTMLElement> {
  await user.click(await screen.findByRole('button', { name: 'Synchronise' }));
  return screen.findByRole('dialog');
}

/** The single changes of the newest run with changes, as text, read from the sync log in the settings. */
export async function logText(user: User): Promise<string> {
  const back = window.location.hash;
  window.location.hash = '#/settings/sync';
  const toggle = await waitFor(() => {
    const found = document.querySelector<HTMLButtonElement>('.github-log__toggle:not([disabled])');
    if (!found) throw new Error('no run with changes in the log');
    return found;
  });
  await user.click(toggle);
  const text = document.querySelector('.github-log__detail')?.textContent ?? '';
  window.location.hash = back;
  await screen.findByRole('button', { name: 'Synchronise' });
  return text;
}
