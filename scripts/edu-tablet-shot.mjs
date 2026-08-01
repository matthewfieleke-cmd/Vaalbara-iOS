/* Quick look at the classroom hub and one chapter at tablet width. */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4310';
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1024, height: 1366 },
  deviceScaleFactor: 2,
  hasTouch: true,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1700);
if (await page.locator('.ignite-overlay').count()) {
  await page.mouse.click(512, 683);
  await page.waitForTimeout(1100);
}
const skip = page.locator('.skip-btn');
if (await skip.count()) await skip.click({ force: true });
await page.waitForSelector('.menu', { timeout: 15000 });

await page.click('.btn-teach', { force: true });
await page.waitForSelector('.education', { timeout: 5000 });
await page.waitForTimeout(700);
await page.screenshot({ path: '/tmp/tablet-shots/edu-hub.png' });

await page.locator('.edu-toc-card').first().click({ force: true });
await page.waitForTimeout(900);
await page.screenshot({ path: '/tmp/tablet-shots/edu-topic.png' });

await browser.close();
console.log('done');
