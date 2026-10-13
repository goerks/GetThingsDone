import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Presses a key that moves a picked-up card or row, and waits until the screen reader announces the new place.
 *
 * The drag and drop library starts listening to the keys with a timer, a moment after the pick-up. In a slow or busy
 * browser the announcement of the pick-up can come before that, and the first arrow key is then lost: nothing moves
 * and nothing is announced. A lost key never moves anything later, so pressing it again is safe.
 */
export async function pressUntilAnnounced(page: Page, key: string, announced: Locator): Promise<void> {
  await expect(async () => {
    await page.keyboard.press(key);
    await expect(announced).toHaveCount(1, { timeout: 1000 });
  }).toPass({ timeout: 10_000 });
}
