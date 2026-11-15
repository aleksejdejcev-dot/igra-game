import { expect, test } from '@playwright/test';

test('главная страница показывает локальную книгу рекордов при недоступном PHP', async ({ page }) => {
  await page.route('**/api/leaderboard.php', route => route.abort());
  await page.goto('/');
  await expect(page.locator('.start-records-table .leaderboard-source')).toHaveText('Локальный рекорд · хранится в этом браузере');
  await expect(page.locator('.start-records-table tbody')).toContainText('В книге пока нет записей.');
});
