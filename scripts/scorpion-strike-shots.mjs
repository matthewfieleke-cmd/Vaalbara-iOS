/* Films a champion's combat poses in a duel, frame by frame, so a sweep that
 * is over in half a second can be judged pose by pose instead of by catching
 * it live. Written for the scorpion's tail strike; takes any champion so the
 * other species' attack and swat sets can be checked the same way.
 *
 * Grabs the duel canvas every animation frame into an in-page buffer (drawn
 * down small first, which is what keeps it cheap enough not to disturb the
 * timing it is measuring), then picks the busiest run of frames afterwards.
 *
 *   node scripts/scorpion-strike-shots.mjs [baseUrl] [champion] [faction]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.argv[2] ?? 'http://localhost:4310';
/** Champion to lead with, so any species' combat poses can be filmed. */
const LEAD = (process.argv[3] ?? 'scorpion').toLowerCase();
const FACTION = process.argv[4] ?? null;
const OUT = `screenshots/${LEAD}`;
fs.mkdirSync(OUT, { recursive: true });

const DEVICES = [
  { tag: 'iphone', name: 'iPhone 15 Pro', w: 393, h: 852, dpr: 3 },
  { tag: 'ipad', name: 'iPad Pro 13"', w: 1024, h: 1366, dpr: 2 },
];

const browser = await chromium.launch();
for (const d of DEVICES) {
  const ctx = await browser.newContext({
    viewport: { width: d.w, height: d.h },
    deviceScaleFactor: d.dpr,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`  [pageerror] ${e.message}`));

  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  if (await page.locator('.ignite-overlay').count()) {
    await page.mouse.click(d.w / 2, d.h / 2);
    await page.waitForTimeout(1200);
  }
  const skip = page.locator('.skip-btn');
  if (await skip.count()) await skip.click({ force: true });
  await page.waitForSelector('.menu', { timeout: 15000 });
  await page.click('text=Duels', { force: true });
  await page.waitForSelector('.duel-setup', { timeout: 6000 });
  await page.waitForTimeout(700);

  if (FACTION) {
    const fb = page.locator(`.duel-fbtn.${FACTION}`);
    if (await fb.count()) {
      await fb.click({ force: true });
      await page.waitForTimeout(500);
    }
  }
  // The setup asks for a full running order, and the first name picked leads
  // the duel — so take the lead champion first, then fill the rest without
  // re-clicking it, which would toggle it back out and leave the order short.
  const cards = page.locator('.duel-roster .duel-card');
  const n = await cards.count();
  let scorpIdx = -1;
  for (let i = 0; i < n; i++) {
    if (((await cards.nth(i).innerText()) || '').toLowerCase().includes(LEAD)) scorpIdx = i;
  }
  if (scorpIdx >= 0) await cards.nth(scorpIdx).click({ force: true });
  for (let i = 0; i < n; i++) {
    if (i !== scorpIdx) await cards.nth(i).click({ force: true });
  }

  await page.click('text=Enter the Arena', { force: true });
  await page.waitForSelector('.duel-screen canvas', { timeout: 8000 });
  await page.waitForTimeout(1800);

  /* Record every animation frame of the duel canvas into an in-page buffer.
   * Drawing down small first is what keeps it cheap enough not to disturb the
   * timing it is measuring. Rounds are then played until the scorpion has
   * actually swung — the opening exchange can just as easily be the foe's. */
  await page.evaluate(() => {
    const cv = document.querySelector('.duel-screen canvas');
    const off = document.createElement('canvas');
    const S = 0.5;
    off.width = Math.round(cv.width * S);
    off.height = Math.round(cv.height * S);
    const octx = off.getContext('2d');
    window.__shots = [];
    window.__rec = true;
    const tick = () => {
      if (!window.__rec) return;
      octx.drawImage(cv, 0, 0, off.width, off.height);
      window.__shots.push(off.toDataURL('image/jpeg', 0.8));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const strike = page.locator('.duel-btn.strike');
  for (let round = 0; round < 6; round++) {
    if (!(await strike.count()) || !(await strike.isEnabled().catch(() => false))) {
      await page.waitForTimeout(500);
      continue;
    }
    await strike.click({ force: true });
    await page.waitForTimeout(4000);
  }
  await page.evaluate(() => { window.__rec = false; });

  const shots = await page.evaluate(() => window.__shots);
  console.log(`${d.name}: captured ${shots.length} frames`);

  const bufs = shots.map((s) => Buffer.from(s.split(',')[1], 'base64'));
  const dir = `${OUT}/${d.tag}`;
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  for (let i = 0; i < bufs.length; i++) {
    fs.writeFileSync(`${dir}/f${String(i).padStart(4, '0')}.jpg`, bufs[i]);
  }
  console.log(`  wrote ${bufs.length} frames to ${dir}`);

  await ctx.close();
}
await browser.close();
console.log('done');
