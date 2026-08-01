/* Measures the real drawn resolution of battle and duel art at phone vs
 * tablet viewports, so art re-export decisions are made on numbers rather
 * than guesses. Assumes `vite preview --port 4310` is running. */
import { chromium } from 'playwright';

const BASE = 'http://localhost:4310';

const VIEWPORTS = [
  { name: 'iPhone 15 Pro', width: 393, height: 852, dsf: 3 },
  { name: 'iPad 11" portrait', width: 834, height: 1194, dsf: 2 },
  { name: 'iPad Pro 13" portrait', width: 1024, height: 1366, dsf: 2 },
];

const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('  PAGEERROR:', e.message));

  const toMenu = async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);
    const tap = page.locator('.ignite-overlay');
    if (await tap.count()) {
      await page.mouse.click(vp.width / 2, vp.height / 2);
      await page.waitForTimeout(1200);
    }
    const skip = page.locator('.skip-btn');
    if (await skip.count()) await skip.click({ force: true });
    await page.waitForSelector('.menu', { timeout: 15000 });
  };
  await toMenu();

  console.log(`\n===== ${vp.name}  (${vp.width}x${vp.height} css, dpr ${vp.dsf}) =====`);

  const appBox = await page.evaluate(() => {
    const el = document.querySelector('.app');
    const r = el.getBoundingClientRect();
    return { w: Math.round(r.width), h: Math.round(r.height) };
  });
  console.log(`.app frame:            ${appBox.w} x ${appBox.h} css`);

  // ---- Battle ----
  await page.click('text=Battle', { force: true });
  await page.waitForSelector('.faction-select', { timeout: 5000 });
  await page.click('text=March to the Basalt Fields', { force: true });
  await page.waitForSelector('.matchmaking', { timeout: 5000 });
  await page.click('text=Play offline now', { force: true });
  await page.waitForSelector('.game-screen', { timeout: 10000 });
  await page.waitForTimeout(2500);

  const battle = await page.evaluate(() => {
    const cv = document.querySelector('.game-screen canvas');
    const r = cv.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cssW = r.width;
    const cssH = r.height;
    const WORLD_W = 9;
    const WORLD_H = 15;
    const unit = Math.min(cssW / (WORLD_W + 0.5), cssH / (WORLD_H + 1.6));
    const h = (us, mult) => unit * us * mult * dpr;
    return {
      cssW: Math.round(cssW),
      cssH: Math.round(cssH),
      backingW: cv.width,
      backingH: cv.height,
      dpr,
      unit: +unit.toFixed(2),
      boardDeviceW: Math.round(WORLD_W * unit * dpr),
      boardDeviceH: Math.round(WORLD_H * unit * dpr),
      light: Math.round(h(0.47, 1.9)),
      heavy: Math.round(h(0.52, 2.2)),
      colossal: Math.round(h(0.58, 2.5)),
    };
  });
  console.log(`battle canvas:         ${battle.cssW} x ${battle.cssH} css -> ${battle.backingW} x ${battle.backingH} device (dpr ${battle.dpr})`);
  console.log(`  world unit:          ${battle.unit} css px`);
  console.log(`  arena bg drawn:      ${battle.boardDeviceW} x ${battle.boardDeviceH} device px   [source webp 820x1221, master png 1206x1796]`);
  console.log(`  unit sprite heights: light ${battle.light}px  heavy ${battle.heavy}px  colossal ${battle.colossal}px device`);

  await page.screenshot({ path: `/tmp/measure-battle-${vp.width}.png` });

  // ---- Duel ----
  await toMenu();
  await page.click('text=Duels', { force: true });
  await page.waitForSelector('.duel-setup', { timeout: 5000 });
  await page.waitForTimeout(900);
  const cards = page.locator('.duel-roster .duel-card');
  const n = await cards.count();
  for (let i = 0; i < n; i++) await cards.nth(i).click();
  await page.click('text=Enter the Arena', { force: true });
  await page.waitForSelector('.duel-screen', { timeout: 5000 });
  await page.waitForTimeout(2500);

  const duel = await page.evaluate(() => {
    const cv = document.querySelector('.duel-screen canvas');
    const r = cv.getBoundingClientRect();
    return {
      cssW: Math.round(r.width),
      cssH: Math.round(r.height),
      backingW: cv.width,
      backingH: cv.height,
      // fighterH = H * 0.26 * DUEL_SCALE * fitScale, H in device px
      fighterAt09: Math.round(cv.height * 0.26 * 0.9),
      fighterAt12: Math.round(cv.height * 0.26 * 1.2),
    };
  });
  console.log(`duel canvas:           ${duel.cssW} x ${duel.cssH} css -> ${duel.backingW} x ${duel.backingH} device`);
  console.log(`  duel bg drawn:       ~${duel.backingW} x ${duel.backingH} device px (cover fit)  [source webp 1100x733, master png 1536x1024]`);
  console.log(`  fighter drawn height: ~${duel.fighterAt09}px (scale .9) .. ${duel.fighterAt12}px (scale 1.2) device, before auto-fit shrink`);

  await page.screenshot({ path: `/tmp/measure-duel-${vp.width}.png` });
  await ctx.close();
}

await browser.close();
console.log('\ndone');
