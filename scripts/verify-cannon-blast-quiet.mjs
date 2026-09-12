/* Browser proof: no bore glow, no full-screen wash, small muzzle flash. */
import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/opt/cursor/artifacts';
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
page.on('console', (msg) => {
  if (msg.type() === 'error') console.log('PAGEERR', msg.text());
});

await page.goto('http://127.0.0.1:5173/?p1ticks=14&p2ticks=400', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
if (await page.locator('.ignite-overlay').count()) {
  await page.locator('.ignite-overlay').click({ force: true });
}
await page.waitForSelector('.skip-btn', { timeout: 8000 });
await page.click('.skip-btn');
await page.waitForSelector('.menu', { timeout: 8000 });
await page.locator('.menu .cta-label', { hasText: 'Battle' }).click({ force: true });
await page.locator('button', { hasText: 'March to the Basalt Fields' }).click({ force: true });
await page.locator('button', { hasText: 'Play offline now' }).click({ force: true });
await page.waitForSelector('.game-screen', { timeout: 8000 });

const waitPhase = async (phase, ms = 20000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const p = await page.evaluate(() => window.__vbState?.phase ?? null);
    if (p === phase) return p;
    await page.waitForTimeout(250);
  }
  throw new Error(`timed out waiting for ${phase}`);
};

await waitPhase('oasis', 25000);
await page.waitForTimeout(3200);

const snap = async (name) => {
  const path = `${OUT}/${name}`;
  await page.locator('.game-canvas-wrap, .game-screen').first().screenshot({ path });
  console.log('wrote', path);
  return path;
};

const info = await page.evaluate(() => {
  const st = window.__vbState;
  return {
    phase: st?.phase,
    timers: st?.cannons?.map((c) => ({ owner: c.owner, hp: c.hp, atk: c.atkTimer })) ?? [],
    projectiles: st?.projectiles?.map((p) => p.kind) ?? [],
  };
});
console.log('oasis idle', JSON.stringify(info));
await snap('p2_cannon_quiet_idle.png');

await page.evaluate(() => {
  const st = window.__vbState;
  if (!st) return;
  for (const c of st.cannons) c.atkTimer = 0;
});
await page.waitForFunction(
  () => window.__vbState?.projectiles?.some((p) => p.kind === 'cannon') === true,
  null,
  { timeout: 4000 },
);
await snap('p2_cannon_quiet_muzzle.png');

const mid = await page.evaluate(() => ({
  projectiles: window.__vbState?.projectiles?.map((p) => p.kind) ?? [],
  timers: window.__vbState?.cannons?.map((c) => c.atkTimer) ?? [],
}));
console.log('muzzle', JSON.stringify(mid));

await page.waitForTimeout(700);
await snap('p2_cannon_quiet_after.png');
await browser.close();
