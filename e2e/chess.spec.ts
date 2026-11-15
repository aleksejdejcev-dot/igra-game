import { expect,test } from '@playwright/test';

test('шахматная запись принимает заданные ходы и возвращает незаконный ход',async({page})=>{
 await page.goto('/dev.html?dev=1&task=chess');
 await expect(page.locator('.chess-square')).toHaveCount(64);
 await page.locator('[data-square="d8"]').click();await page.locator('[data-square="d7"]').click();
 await expect(page.locator('[data-square="d8"]')).toContainText('♛');
 await page.locator('[data-square="d8"]').click();await page.locator('[data-square="b6"]').click();
 await page.locator('[data-square="h4"]').click();await page.locator('[data-square="f2"]').click();
 await page.locator('[data-square="b6"]').click();await page.locator('[data-square="f2"]').click();
 await page.locator('[data-square="g1"]').click();await page.locator('[data-square="f2"]').click();
 await expect(page.locator('.task-result-seal')).toBeVisible();
});
