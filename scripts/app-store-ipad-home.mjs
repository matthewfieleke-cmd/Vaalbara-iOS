/* Recapture only the 13" iPad Home Screen shot (2064 × 2752).
 *   npx vite preview --port 4310
 *   node scripts/app-store-ipad-home.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BASE = process.argv[2] ?? 'http://localhost:4310';
const OUT = path.resolve('app-store-screenshots/ipad-13');
fs.mkdirSync(OUT, { recursive: true });

const W = 1032;
const H = 1376;
const DPR = 2;

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: DPR,
  hasTouch: true,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

await page.goto(BASE, { waitUntil: 'networkidle' });
await page.waitForTimeout(1600);
if (await page.locator('.ignite-overlay').count()) {
  await page.mouse.click(W / 2, H / 2);
  await page.waitForTimeout(1100);
}
const skip = page.locator('.skip-btn');
if (await skip.count()) await skip.click({ force: true });
await page.waitForSelector('.menu', { timeout: 20000 });
await page.waitForTimeout(800);

const raw = `${OUT}/_06-home.png`;
const dest = `${OUT}/06-home.png`;
await page.screenshot({ path: raw, type: 'png' });
const meta = await sharp(raw).metadata();
const pipeline = sharp(raw);
if (meta.width !== 2064 || meta.height !== 2752) {
  await pipeline.resize(2064, 2752, { fit: 'cover', position: 'centre' }).png({ compressionLevel: 9, palette: false }).toFile(dest);
} else {
  await pipeline.png({ compressionLevel: 9, palette: false }).toFile(dest);
}
fs.unlinkSync(raw);
console.log(`Wrote ${dest}  (${Math.round(fs.statSync(dest).size / 1024)} KB)`);
await browser.close();
