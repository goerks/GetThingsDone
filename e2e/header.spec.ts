import { expect, test } from '@playwright/test';

/*
 * End-to-end test of the sticky header (#15). The window is made low, so every page has to scroll.
 */

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-10-13T10:00:00+02:00'));
  await page.setViewportSize({ width: 1200, height: 420 });
});

for (const [view, address] of [
  ['Backlog', '/#/backlog'],
  ['Board', '/#/board'],
  ['Settings', '/#/settings/statuses']
] as const) {
  test(`AC1.1 keeps the header at the top of the window while the ${view} page scrolls`, async ({ page }) => {
    // Given a window that is too low to show the whole page
    await page.goto(address);
    const header = page.getByRole('banner');
    await expect(header).toBeVisible();
    const scrollable = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
    expect(scrollable).toBeGreaterThan(100);

    // When I scroll to the end of the page
    await page.mouse.move(600, 300);
    await page.mouse.wheel(0, 5000);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);

    // Then the header with views, search, theme, language and settings is still at the top of the window
    await expect.poll(async () => (await header.boundingBox())?.y).toBe(0);
    await expect(header.getByRole('navigation', { name: 'Main' })).toBeInViewport();
    await expect(header.getByRole('combobox', { name: 'Search' })).toBeInViewport();
    await expect(header.getByRole('link', { name: 'Settings' })).toBeInViewport();

    // And I can switch the view from there
    await header.getByRole('link', { name: 'Epics' }).click();
    await expect(page.getByRole('heading', { name: 'Epics', level: 1 })).toBeVisible();
  });
}
