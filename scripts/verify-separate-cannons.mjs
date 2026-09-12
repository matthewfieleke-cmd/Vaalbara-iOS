/* Browser proof: living Oasis floor, no roof turret, topple painting swaps. */
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
const tap = page.locator('.tap-label, .ignite-overlay');
if (await tap.count()) await page.locator('.ignite-overlay').click({ force: true });
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
await page.waitForTimeout(700);

const snap = async (name) => {
  const path = `${OUT}/${name}`;
  await page.locator('.game-canvas-wrap, .game-screen').first().screenshot({ path });
  console.log('wrote', path);
};

const info = await page.evaluate(() => {
  const st = window.__vbState;
  return {
    phase: st?.phase,
    cannons: st?.cannons?.map((c) => ({ owner: c.owner, hp: c.hp, x: c.x, y: c.y })) ?? [],
    marbles: st?.marbles?.map((m) => ({ owner: m.owner, hp: m.hp, shield: m.shield })) ?? [],
    banner: document.querySelector('.banner h2')?.textContent ?? null,
    pill: document.querySelector('.objective-pill')?.textContent ?? null,
  };
});
console.log('oasis open', JSON.stringify(info));

await snap('p2_separate_cannons_living.png');

await page.evaluate(() => {
  const st = window.__vbState;
  if (!st) return;
  const c1 = st.cannons.find((c) => c.owner === 1);
  if (c1) c1.hp = 0;
});
await page.waitForTimeout(400);
await snap('p2_temple_gun_toppled.png');

await page.evaluate(() => {
  const st = window.__vbState;
  if (!st) return;
  for (const c of st.cannons) c.hp = c.owner === 0 ? 0 : 500;
});
await page.waitForTimeout(400);
await snap('p2_keep_gun_toppled.png');

await page.evaluate(() => {
  const st = window.__vbState;
  if (!st) return;
  for (const c of st.cannons) c.hp = 0;
});
await page.waitForTimeout(400);
await snap('p2_both_guns_toppled.png');

// Restore living and wait for a real shot if one is due.
await page.evaluate(() => {
  const st = window.__vbState;
  if (!st) return;
  for (const c of st.cannons) {
    c.hp = c.maxHp;
    c.atkTimer = 0;
  }
});
for (let i = 0; i < 16; i++) {
  const shot = await page.evaluate(() => {
    const st = window.__vbState;
    return st?.projectiles?.some((p) => p.kind === 'cannon') ?? false;
  });
  if (shot) break;
  await page.waitForTimeout(350);
}
await snap('p2_gun_muzzle_or_shell.png');

const end = await page.evaluate(() => {
  const st = window.__vbState;
  return {
    phase: st?.phase,
    projectiles: st?.projectiles?.map((p) => p.kind) ?? [],
    units: st?.units?.length ?? 0,
  };
});
console.log('end', JSON.stringify(end));
await browser.close();
