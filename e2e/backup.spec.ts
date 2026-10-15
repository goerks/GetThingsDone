import { expect, test, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';

/*
 * End-to-end tests of export and import of all data (#16) in a real browser, following the test cases the PO approved
 * in the issue. The clock is fixed to Thursday 15 October 2026, the day of the file name in the test cases.
 */

const KEY = 'getitdone.snapshot.v1';

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-15T10:00:00+02:00'));
});

async function openData(page: Page): Promise<void> {
  await page.goto('/#/settings/data');
  await expect(page.getByRole('heading', { level: 2, name: 'Data' })).toBeVisible();
}

/** The stored data of the app. */
const stored = (page: Page) => page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? '{}'), KEY);

/** Changes the stored data and reloads, as the test cases do ("I change the title of S-3, delete an epic, move S-5"). */
async function change(page: Page): Promise<void> {
  await page.evaluate((key) => {
    const data = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    data.stories = data.stories.map((story: { code: string; title: string; status: string }) =>
      story.code === 'S-3' ? { ...story, title: 'Anders' } : story.code === 'S-5' ? { ...story, status: 'done' } : story
    );
    data.stories = data.stories.map((story: { epicId: string | null }) => ({ ...story, epicId: story.epicId === data.epics[0].id ? null : story.epicId }));
    data.epics = data.epics.slice(1);
    window.localStorage.setItem(key, JSON.stringify(data));
  }, KEY);
  await page.reload();
  await expect(page.getByRole('heading', { level: 2, name: 'Data' })).toBeVisible();
}

/** Clicks "Export all data" and returns the name and the text of the saved file. */
async function exportFile(page: Page): Promise<{ name: string; text: string }> {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export all data' }).click();
  const file = await download;
  const path = await file.path();
  return { name: file.suggestedFilename(), text: await readFile(path, 'utf8') };
}

const asFile = (text: string, name = 'getitdone-2026-10-15.json') => ({ name, mimeType: 'application/json', buffer: Buffer.from(text) });

async function importFile(page: Page, text: string, name?: string): Promise<void> {
  await page.getByLabel('Export file to import').setInputFiles(asFile(text, name));
}

test('AC1.1 finds the section Data from the gear', async ({ page }) => {
  // Given the app is open on the board
  await page.goto('/#/board');
  // When I click the gear and then "Data"
  await page.getByRole('link', { name: 'Settings' }).click();
  await page.getByRole('link', { name: 'Data' }).click();
  // Then I see the cards "Export data" and "Import data"
  await expect(page.getByRole('heading', { level: 3, name: 'Export data' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Import data' })).toBeVisible();
});

test('AC1.2 exports all data with one click', async ({ page }) => {
  // Given the demo data
  await openData(page);
  const data = await stored(page);
  // When I click "Export all data"
  const file = await exportFile(page);
  // Then the file "getitdone-2026-10-15.json" is saved with all data
  expect(file.name).toBe('getitdone-2026-10-15.json');
  const saved = JSON.parse(file.text);
  expect(saved).toMatchObject({ format: 'getitdone-backup', version: 1 });
  expect(saved.data.stories).toHaveLength(data.stories.length);
  // And the card says what was exported
  await expect(page.getByRole('status').filter({ hasText: 'Exported: getitdone-2026-10-15.json' })).toContainText(`${data.stories.length} stories`);
});

test('AC2.1 asks before replacing', async ({ page }) => {
  // Given a file with 5 more stories than the app holds
  await openData(page);
  const before = await stored(page);
  const exported = JSON.parse((await exportFile(page)).text);
  exported.data.stories = [...exported.data.stories, ...Array.from({ length: 5 }, (_, i) => ({ ...exported.data.stories[0], id: `more-${i}`, code: `S-9${i}`, title: `More ${i}` }))];
  // When I choose the file
  await importFile(page, JSON.stringify(exported));
  // Then the dialog compares the file with today's data and warns, and nothing has changed yet
  const dialog = page.getByRole('dialog', { name: 'Import data?' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('row', { name: /Stories/ }).getByRole('cell')).toHaveText([String(before.stories.length + 5), String(before.stories.length)]);
  await expect(dialog.getByRole('note')).toContainText('All your current data will be replaced');
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused();
  expect((await stored(page)).stories).toHaveLength(before.stories.length);
});

test('AC2.3 replaces the data and keeps it after a reload', async ({ page }) => {
  // Given a file with 5 more stories and the confirmation is open
  await openData(page);
  const before = await stored(page);
  const exported = JSON.parse((await exportFile(page)).text);
  exported.data.stories = [...exported.data.stories, ...Array.from({ length: 5 }, (_, i) => ({ ...exported.data.stories[0], id: `more-${i}`, code: `S-9${i}`, title: `More ${i}` }))];
  await importFile(page, JSON.stringify(exported));
  // When I click "Replace data"
  await page.getByRole('dialog', { name: 'Import data?' }).getByRole('button', { name: 'Replace data' }).click();
  // Then the card says what was imported
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(`Imported: ${before.stories.length + 5} stories`)).toBeVisible();
  // And the data are there after a reload, on the board too
  await page.reload();
  expect((await stored(page)).stories).toHaveLength(before.stories.length + 5);
  await page.goto('/#/backlog');
  await expect(page.getByText('More 4')).toBeVisible();
});

test('AC3.1 gives back the data of the export after changes', async ({ page }) => {
  // Given an export, and then a changed title, a deleted epic and a moved story
  await openData(page);
  const original = await stored(page);
  const file = await exportFile(page);
  await change(page);
  expect((await stored(page)).stories.find((story: { code: string }) => story.code === 'S-3').title).toBe('Anders');
  // When I import the exported file and confirm
  await importFile(page, file.text);
  await page.getByRole('dialog', { name: 'Import data?' }).getByRole('button', { name: 'Replace data' }).click();
  await expect(page.getByText(/^✓ Imported:/)).toBeVisible();
  // Then the data are the same as at the export, also after a reload
  await page.reload();
  expect(await stored(page)).toEqual(original);
});

test('AC3.2 gives back every part of the data after fresh demo data', async ({ page }) => {
  // Given the demo data with a ticked criterion and a changed setting, exported
  await openData(page);
  await page.evaluate((key) => {
    const data = JSON.parse(window.localStorage.getItem(key) ?? '{}');
    data.stories[0].criteria = data.stories[0].criteria.map((criterion: object) => ({ ...criterion, done: true }));
    data.settings = { ...data.settings, mapRows: 'releases' };
    window.localStorage.setItem(key, JSON.stringify(data));
  }, KEY);
  await page.reload();
  const original = await stored(page);
  const file = await exportFile(page);
  // When I start with fresh demo data and import the file
  await page.evaluate((key) => window.localStorage.removeItem(key), KEY);
  await page.reload();
  expect(await stored(page)).not.toEqual(original);
  await importFile(page, file.text);
  await page.getByRole('dialog', { name: 'Import data?' }).getByRole('button', { name: 'Replace data' }).click();
  await expect(page.getByText(/^✓ Imported:/)).toBeVisible();
  // Then criteria, sprints, releases with their history, fields, statuses and settings are as before the export
  const after = await stored(page);
  for (const part of ['epics', 'sprints', 'releases', 'events', 'stories', 'statuses', 'fields', 'assignments', 'settings']) {
    expect(after[part], part).toEqual(original[part]);
  }
});

test('AC4.1 refuses a text file and leaves the data unchanged', async ({ page }) => {
  // Given the demo data and a text file
  await openData(page);
  const before = await stored(page);
  // When I choose the text file
  await page.getByLabel('Export file to import').setInputFiles({ name: 'notizen.txt', mimeType: 'text/plain', buffer: Buffer.from('Hallo') });
  // Then a message says why, there is no confirmation, and the data are the same
  await expect(page.getByRole('alert')).toHaveText('⚠ This file cannot be imported: It is not a Get It Done export file. Your data are unchanged.');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await stored(page)).toEqual(before);
});

test('AC5.3 shows the demo hint in the preview', async ({ page }) => {
  // Given the web preview on "Data"
  await openData(page);
  // When I look at the card "Import data"
  // Then it says that the import only replaces the demo data of this browser
  await expect(page.getByText('This is a demo. The import replaces the demo data only in this browser.')).toBeVisible();
});

test('AC6.2 exports with the keyboard only', async ({ page }) => {
  // Given the section "Data"
  await openData(page);
  // When I reach "Export all data" with Tab and press Enter
  await page.getByRole('link', { name: 'Data', exact: true }).focus();
  const exportButton = page.getByRole('button', { name: 'Export all data' });
  for (let step = 0; step < 10 && !(await exportButton.evaluate((button) => button === document.activeElement)); step += 1) await page.keyboard.press('Tab');
  await expect(exportButton).toBeFocused();
  const download = page.waitForEvent('download');
  await page.keyboard.press('Enter');
  // Then the file is saved
  expect((await download).suggestedFilename()).toBe('getitdone-2026-10-15.json');
  // And the next Tab reaches "Choose file …"
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Choose file …' })).toBeFocused();
});
