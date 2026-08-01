/* Captures every screen at phone and tablet viewports so the iPad side-rail
 * layout can be eyeballed side by side. Assumes `vite preview --port 4310`. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = 'http://localhost:4310';
const OUT = '/tmp/tablet-shots';
fs.mkdirSync(OUT, { recursive: true });

const VIEWPORTS = [
  { tag: 'phone', width: 393, height: 852, dsf: 3 },
  { tag: 'ipad11', width: 834, height: 1194, dsf: 2 },
  { tag: 'ipad13', width: 1024, height: 1366, dsf: 2 },
];

const only = process.argv[2];
const browser = await chromium.launch();

for (const vp of VIEWPORTS) {
  if (only && only !== vp.tag) continue;
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.dsf,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(`  [${vp.tag}] PAGEERROR:`, e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') console.log(`  [${vp.tag}] CONSOLE:`, m.text());
  });

  const shot = (name) => page.screenshot({ path: `${OUT}/${vp.tag}-${name}.png` });

  const toMenu = async () => {
    await page.goto(BASE, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1700);
    if (await page.locator('.ignite-overlay').count()) {
      await page.mouse.click(vp.width / 2, vp.height / 2);
      await page.waitForTimeout(1100);
    }
    const skip = page.locator('.skip-btn');
    if (await skip.count()) await skip.click({ force: true });
    await page.waitForSelector('.menu', { timeout: 15000 });
  };

  await toMenu();
  await page.waitForTimeout(400);
  await shot('01-menu');

  await page.click('text=Battle', { force: true });
  await page.waitForSelector('.faction-select', { timeout: 5000 });
  await shot('02-faction');
  await page.click('text=March to the Basalt Fields', { force: true });
  await page.waitForSelector('.matchmaking', { timeout: 5000 });
  await page.click('text=Play offline now', { force: true });
  await page.waitForSelector('.game-screen', { timeout: 10000 });
  await page.waitForTimeout(3200);
  await shot('03-battle');

  // Bank aqua, then actually deploy a few waves so the rail's warband
  // readout has something in it when the shot is taken.
  const board = await page.locator('.game-canvas-wrap').boundingBox();
  const gates = [
    { x: board.x + board.width * 0.32, y: board.y + board.height * 0.9 },
    { x: board.x + board.width * 0.68, y: board.y + board.height * 0.9 },
  ];
  for (let wave = 0; wave < 6; wave++) {
    await page.waitForTimeout(4200);
    const affordable = page.locator('.hand .card:not(.unaffordable)');
    if (!(await affordable.count())) continue;
    await affordable.first().click({ force: true });
    await page.waitForTimeout(250);
    const g = gates[wave % 2];
    await page.mouse.move(g.x, g.y);
    await page.mouse.down();
    await page.mouse.move(g.x, g.y - 4, { steps: 3 });
    await page.mouse.up();
    await page.waitForTimeout(250);
  }
  await page.waitForTimeout(2500);
  await shot('04-battle-live');

  await toMenu();
  await page.click('text=Duels', { force: true });
  await page.waitForSelector('.duel-setup', { timeout: 5000 });
  await page.waitForTimeout(1000);
  await shot('05-duel-setup');
  const roster = page.locator('.duel-roster .duel-card');
  const n = await roster.count();
  for (let i = 0; i < n; i++) await roster.nth(i).click({ force: true });
  await page.click('text=Enter the Arena', { force: true });
  await page.waitForSelector('.duel-screen', { timeout: 5000 });
  await page.waitForTimeout(3600);
  await shot('06-duel');

  await toMenu();
  await page.click('.btn-teach', { force: true });
  await page.waitForSelector('.education', { timeout: 5000 });
  await page.waitForTimeout(700);
  await shot('07-education');

  await ctx.close();
  console.log(`[${vp.tag}] captured`);
}

await browser.close();
console.log(`shots in ${OUT}`);
