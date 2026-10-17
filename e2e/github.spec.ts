import { expect, test, type Page } from '@playwright/test';

/*
 * End-to-end tests of the GitHub connection in a real browser (#30), following the test cases the PO approved in the
 * issue. The web build has a simulated GitHub (repository goerks/GetThingsDone with the open issues #31 Login, #35 Export
 * as CSV and #38 Dark mode, the closed issue #29 and a pull request); the settings page has buttons to change it.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
  await page.goto('/#/settings/features');
  await expect(page.getByRole('heading', { name: 'Features', level: 2 })).toBeVisible();
});

const REPO = 'goerks/GetThingsDone';

/** Switches the feature on and connects the simulated repository, with the mouse. */
async function connect(page: Page, token = 'any-token'): Promise<void> {
  await page.getByRole('switch', { name: /GitHub connection/ }).click();
  await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'Connections' }).click();
  await page.getByLabel('Repository (owner/name)').fill(REPO);
  await page.getByLabel('Access token').fill(token);
  await page.getByRole('button', { name: 'Test connection' }).click();
}

async function toBacklog(page: Page): Promise<void> {
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Backlog' }).click();
  await expect(page.getByRole('heading', { name: 'Backlog', level: 1 })).toBeVisible();
}

const synchronise = async (page: Page) => {
  await page.getByRole('button', { name: 'Synchronise' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  return dialog;
};

test('AC1.2 and AC1.3 switch the feature on, connect the repository and show a working connection', async ({ page }) => {
  // Given the feature is off and there is no section "GitHub"
  await expect(page.getByRole('switch', { name: /GitHub connection/ })).not.toBeChecked();
  await expect(page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'Connections' })).toHaveCount(0);
  // When I switch it on, enter repository and token and test the connection
  await connect(page);
  // Then the connection works and the token cannot be read any more
  await expect(page.getByText('✓ Connection ok · 3 open issues')).toBeVisible();
  await expect(page.getByLabel('Access token')).toHaveValue('');
  await expect(page.getByLabel('Access token')).toHaveAttribute('type', 'password');
});

test('AC1.7 marks the preview as a demo', async ({ page }) => {
  // Given the preview, When I open the section GitHub
  await page.getByRole('switch', { name: /GitHub connection/ }).click();
  await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'Connections' }).click();
  // Then it says "Demo" and offers the simulated GitHub
  await expect(page.locator('.badge--demo').first()).toHaveText('Demo');
  await expect(page.getByRole('region', { name: 'Demo: simulated GitHub' })).toBeVisible();
});

test('AC1.6 keeps the repository after a reload but asks for the token again', async ({ page }) => {
  // Given a connection
  await connect(page);
  await expect(page.getByText('✓ Connection ok · 3 open issues')).toBeVisible();
  // When I reload the page
  await page.reload();
  // Then the repository is there and the token is not
  await expect(page.getByLabel('Repository (owner/name)')).toHaveValue(REPO);
  await expect(page.getByLabel('Access token')).not.toHaveAttribute('placeholder', /Token saved/);
  await expect(page.getByText(/Enter the token again/)).toBeVisible();
});

test('AC1.4 says what is wrong with the repository', async ({ page }) => {
  // Given the section GitHub
  await page.getByRole('switch', { name: /GitHub connection/ }).click();
  await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'Connections' }).click();
  await page.getByLabel('Access token').fill('any-token');
  // When I test an empty repository, a wrong form and a repository that does not exist
  await page.getByRole('button', { name: 'Test connection' }).click();
  await expect(page.getByRole('alert')).toHaveText('The repository is missing.');
  await page.getByLabel('Repository (owner/name)').fill('abc');
  await page.getByRole('button', { name: 'Test connection' }).click();
  await expect(page.getByRole('alert')).toHaveText('Use the form owner/name.');
  await page.getByLabel('Repository (owner/name)').fill('goerks/gibtesnicht');
  await page.getByRole('button', { name: 'Test connection' }).click();
  // Then each case has its own hint
  await expect(page.getByRole('alert')).toContainText('Repository not found');
});

test('AC2.1 imports the open issues, AC2.2 imports them only once and AC4.1 shows number and link', async ({ page }) => {
  // Given a connected repository and a backlog without imported stories
  await connect(page);
  await expect(page.getByText('✓ Connection ok · 3 open issues')).toBeVisible();
  await toBacklog(page);
  // When I synchronise for the first time
  const first = await synchronise(page);
  // Then 3 stories are new, without the closed issue and the pull request
  await expect(first.locator('.github-result__counts li').first()).toContainText('3');
  await first.getByRole('button', { name: 'Close' }).click();
  for (const title of ['Login', 'Export as CSV', 'Dark mode']) await expect(page.getByRole('button', { name: title, exact: true })).toBeVisible();
  await expect(page.getByText('Imprint page')).toHaveCount(0);
  await expect(page.getByText('fix typo')).toHaveCount(0);
  // And each shows its number as a link to the issue
  const link = page.getByRole('link', { name: 'Open issue #31 on GitHub' });
  await expect(link).toHaveText('#31');
  await expect(link).toHaveAttribute('href', 'https://github.com/goerks/GetThingsDone/issues/31');
  await expect(link).toHaveAttribute('target', '_blank');
  // And a second sync adds nothing
  const second = await synchronise(page);
  await expect(second.locator('.github-result__counts li').first()).toContainText('0');
  await expect(second).toContainText('Everything is up to date');
  await second.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('link', { name: /Open issue #31/ })).toHaveCount(1);
  // And the imported stories are still there after a reload
  await page.reload();
  await expect(page.getByRole('link', { name: 'Open issue #31 on GitHub' })).toHaveCount(1);
});

/** Goes to a page of the app without loading it again, so the token in the memory of the page stays. */
const goTo = (page: Page, hash: string): Promise<void> => page.evaluate((target) => void (window.location.hash = target), hash);

test('AC3.1 brings the changes of GitHub into the stories and shows them (also AC3.2, AC3.3 and AC3.7)', async ({ page }) => {
  // Given three imported stories
  await connect(page);
  await expect(page.getByText('✓ Connection ok · 3 open issues')).toBeVisible();
  await toBacklog(page);
  await (await synchronise(page)).getByRole('button', { name: 'Close' }).click();
  // When #31 is renamed and gets a label, #35 is closed on GitHub, and I synchronise
  await goTo(page, '#/settings/github');
  await page.getByRole('button', { name: 'Rename #31, new label' }).click();
  await page.getByRole('button', { name: 'Close #35' }).click();
  await goTo(page, '#/backlog');
  const dialog = await synchronise(page);
  // Then the dialog names the changes and the closed issue is counted as done
  await expect(dialog.getByText('Title changed: “Login” → “Login-Seite”')).toBeVisible();
  await expect(dialog.getByText('Labels: new bug')).toBeVisible();
  await expect(dialog.getByText('Closed on GitHub → status “Done”')).toBeVisible();
  await dialog.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Login-Seite', exact: true })).toBeVisible();
  // And the criteria of #31 follow GitHub, and #35 goes back to "To do" when it is opened again
  await goTo(page, '#/settings/github');
  await page.getByRole('button', { name: 'Change the criteria of #31' }).click();
  await page.getByRole('button', { name: 'Reopen #35' }).click();
  await goTo(page, '#/backlog');
  const again = await synchronise(page);
  await expect(again.getByText('Criteria: 1 new')).toBeVisible();
  await expect(again.getByText('Reopened on GitHub → status “To do”')).toBeVisible();
});

test('AC5.1 tells me when there is no network, AC5.2 when the token is refused, and the app keeps working', async ({ page, context }) => {
  // Given a connected repository
  await connect(page);
  await expect(page.getByText('✓ Connection ok · 3 open issues')).toBeVisible();
  await toBacklog(page);
  // When the network is gone and I synchronise
  await context.setOffline(true);
  const offline = await synchronise(page);
  // Then a clear message appears and the backlog still works
  await expect(offline.getByRole('alert')).toHaveText('No connection to GitHub. The app keeps working with your local data.');
  await offline.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByRole('button', { name: 'Synchronise' })).toBeFocused();
  await expect(page.getByRole('link', { name: /Open issue/ })).toHaveCount(0);
  await context.setOffline(false);
  // And with a refused token, the message says so
  await page.goto('/#/settings/github');
  await page.getByLabel('Access token').fill('falsch');
  await page.getByRole('button', { name: 'Test connection' }).click();
  await expect(page.getByRole('alert')).toContainText('GitHub refused the access token');
});

test('AC6.2 works with the keyboard only, from the switch to the closed result dialog', async ({ page }) => {
  // Given the features page with the focus on the switch
  const keyboard = page.keyboard;
  await page.getByRole('switch', { name: /GitHub connection/ }).focus();
  // When I switch the feature on and go to the section GitHub with Enter
  await keyboard.press('Space');
  await expect(page.getByRole('switch', { name: /GitHub connection/ })).toBeChecked();
  await page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'Connections' }).focus();
  await keyboard.press('Enter');
  // And fill in repository and token with Tab, then test the connection with Enter
  await page.getByLabel('Repository (owner/name)').focus();
  await keyboard.type(REPO);
  await keyboard.press('Tab');
  await expect(page.getByLabel('Access token')).toBeFocused();
  await keyboard.type('any-token');
  await keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Test connection' })).toBeFocused();
  await keyboard.press('Enter');
  await expect(page.getByText('✓ Connection ok · 3 open issues')).toBeVisible();
  // And open the backlog, synchronise and close the dialog with Escape
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Backlog' }).focus();
  await keyboard.press('Enter');
  await page.getByRole('button', { name: 'Synchronise' }).focus();
  await keyboard.press('Enter');
  // Then the dialog holds the focus, and Escape gives it back to the button
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Close' })).toBeFocused();
  await keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('button', { name: 'Synchronise' })).toBeFocused();
  await expect(page.getByRole('link', { name: 'Open issue #31 on GitHub' })).toBeVisible();
});

/** The menu of the story with this code in the backlog. */
async function openMenu(page: Page, code: string): Promise<void> {
  await page.locator('.backlog__row', { hasText: code }).first().click({ button: 'right' });
  await expect(page.getByRole('menu')).toBeVisible();
}

test('AC10.1 creates an issue from a story of my own, links it, and AC10.3 does not offer it a second time', async ({ page }) => {
  // Given a connected repository with writing on
  await connect(page);
  await expect(page.getByText('✓ Connection ok · 3 open issues')).toBeVisible();
  await expect(page.getByRole('checkbox', { name: 'Also write to GitHub' })).not.toBeChecked();
  await page.getByRole('checkbox', { name: 'Also write to GitHub' }).check();
  await toBacklog(page);
  // When I choose "Create on GitHub" in the menu of a story of my own
  await openMenu(page, 'S-1');
  await page.getByRole('menuitem', { name: 'Create on GitHub' }).click();
  // Then the story shows the number of the new issue as a link
  await expect(page.locator('.backlog__row', { hasText: 'S-1' }).first().getByRole('link', { name: /Open issue #\d+ on GitHub/ })).toBeVisible();
  // And the menu does not offer it again
  await openMenu(page, 'S-1');
  await expect(page.getByRole('menuitem', { name: 'Create on GitHub' })).toHaveCount(0);
});

test('AC7.6 says what the token needs when GitHub refuses to write', async ({ page }) => {
  // Given a token that may only read, and writing on
  await connect(page, 'nurlesen');
  await expect(page.getByText('✓ Connection ok · 3 open issues')).toBeVisible();
  await page.getByRole('checkbox', { name: 'Also write to GitHub' }).check();
  await toBacklog(page);
  // When I try to create an issue
  await openMenu(page, 'S-1');
  await page.getByRole('menuitem', { name: 'Create on GitHub' }).click();
  // Then a notice names the missing right and the story stays without a number
  await expect(page.getByText(/Issues: read and write/)).toBeVisible();
  await expect(page.locator('.backlog__row', { hasText: 'S-1' }).first().getByRole('link', { name: /Open issue/ })).toHaveCount(0);
});

test('AC11.1 lists GitHub as connected and the other services as planned', async ({ page }) => {
  await connect(page);
  await expect(page.getByText('✓ Connection ok · 3 open issues')).toBeVisible();
  const services = page.locator('.github-services li');
  await expect(services).toHaveText(['GitHubconnected', 'GitLabplanned', 'Jiraplanned', 'Trelloplanned']);
});
