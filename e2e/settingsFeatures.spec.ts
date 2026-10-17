import { expect, test, type Page } from '@playwright/test';

/*
 * End-to-end tests of the settings with one tab per feature (#61) in a real browser, following the test cases the PO
 * approved in the issue. Every test starts from the demo data of a fresh browser on Tuesday 13 October 2026.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
});

async function open(page: Page, hash: string): Promise<void> {
  await page.goto(`/${hash}`);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
}

test('AC3.1 the team stays on after a reload', async ({ page }) => {
  // Given the team is switched off in its tab
  await open(page, '#/settings/team');
  await page.getByRole('switch', { name: 'Team' }).uncheck();
  await expect(page.getByRole('button', { name: 'Switch on Team' })).toBeVisible();
  // When I switch it on again and reload the app
  await page.getByRole('button', { name: 'Switch on Team' }).click();
  await expect(page.getByRole('button', { name: 'Add member' })).toBeVisible();
  await page.reload();
  // Then the team is still on and the list says "On"
  await expect(page.getByRole('switch', { name: 'Team' })).toBeChecked();
  await expect(page.getByRole('navigation', { name: 'Settings sections' }).getByRole('link', { name: 'Team On' })).toBeVisible();
});

test('AC4.1 the start page of the team tab', async ({ page }) => {
  // Given the team is off
  await open(page, '#/settings/team');
  await page.getByRole('switch', { name: 'Team' }).uncheck();
  // Then the tab shows the start page with the button and no member list
  await expect(page.getByRole('button', { name: 'Switch on Team' })).toBeVisible();
  await expect(page.getByText('Switched off. Members and assignments are kept and come back when you switch it on.')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Team members' })).toHaveCount(0);
});
