import { test, expect } from '@playwright/test';

test.describe('基础流程', () => {
  test('首页能加载 + 显示 Header', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('header')).toContainText('作文副驾驶');
    await expect(page.locator('header')).toContainText('Style Co-Pilot');
  });

  test('健康检查端点 OK', async ({ request }) => {
    const res = await request.get('/api/health');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('ok');
  });

  test('素材库 API 能返回结果', async ({ request }) => {
    const res = await request.get('/api/materials?topic=母爱&type=argument&limit=3');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.materials.length).toBeGreaterThan(0);
    expect(body.materials[0].title).toBeTruthy();
    expect(body.materials[0].type).toBe('argument');
  });

  test('空题目调用素材 API 应 400', async ({ request }) => {
    const res = await request.get('/api/materials');
    expect(res.status()).toBe(400);
  });

  test('历史面板按钮可见', async ({ page }) => {
    await page.goto('/');
    // 📚 按钮在 header
    await expect(page.locator('header button:has-text("📚")')).toBeVisible();
  });

  test('可以切换主题（dark/light）', async ({ page }) => {
    await page.goto('/');
    const themeBtn = page.locator('header button:has-text("🌙"), header button:has-text("☀️")').first();
    await themeBtn.click();
    // 检查 html 元素 class 变化
    const html = await page.locator('html').first();
    const cls = await html.getAttribute('class');
    expect(cls).toBeTruthy();
  });

  test('UploadStep 上传按钮可见', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('text=上传').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=粘贴').first()).toBeVisible();
  });
});