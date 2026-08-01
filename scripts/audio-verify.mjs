/* Proves the soundtrack, the rhythmic grid and the classroom demos still work.
 *
 * Every Web Audio source is instrumented at the prototype so we capture the
 * exact time each note was SCHEDULED for, not merely that something happened.
 * That lets us check the thing that actually matters musically: whether the
 * score still lands on its 16th-note grid (100 BPM, 0.15s) rather than drifting
 * or free-running.
 *
 *   node scripts/audio-verify.mjs [baseUrl]
 *
 * Pass a dev-server URL to also exercise the accelerated phase-2 transition,
 * which is gated behind import.meta.env.DEV.
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] ?? 'http://localhost:4310';
const STEP = 0.15; // one 16th at 100 BPM — MUSIC_16TH_SEC
const failures = [];
const summary = {};
const check = (ok, msg) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${msg}`);
  if (!ok) failures.push(msg);
};

/* Circular concentration of scheduled onsets about the 16th grid. 1.0 = every
 * note dead on a grid line, 0.0 = no rhythmic relationship at all. Phase is
 * unknown and irrelevant, so this measures grid-ness without needing to know
 * where the transport started. */
function gridLock(times) {
  if (times.length < 8) return { r: 0, onGrid: 0, n: times.length };
  let sx = 0;
  let sy = 0;
  for (const t of times) {
    const a = (2 * Math.PI * (t % STEP)) / STEP;
    sx += Math.cos(a);
    sy += Math.sin(a);
  }
  const r = Math.hypot(sx, sy) / times.length;
  const mean = Math.atan2(sy, sx);
  const centre = ((mean / (2 * Math.PI)) * STEP + STEP) % STEP;
  let onGrid = 0;
  for (const t of times) {
    let d = Math.abs((t % STEP) - centre);
    d = Math.min(d, STEP - d);
    if (d <= 0.02) onGrid++;
  }
  return { r, onGrid: onGrid / times.length, n: times.length };
}

const instrument = () => {
  window.__audio = { starts: [], created: 0 };
  const AC = window.AudioContext ?? window.webkitAudioContext;
  for (const method of ['createOscillator', 'createBufferSource']) {
    const orig = AC.prototype[method];
    AC.prototype[method] = function (...args) {
      const node = orig.apply(this, args);
      window.__audio.created++;
      const start = node.start.bind(node);
      node.start = (when, ...rest) => {
        window.__audio.starts.push(when ?? this.currentTime);
        return start(when, ...rest);
      };
      return node;
    };
  }
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 852 }, hasTouch: true });
const page = await ctx.newPage();
const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(m.text());
});
await page.addInitScript(instrument);

const sample = async (ms) => {
  await page.evaluate(() => {
    window.__audio.starts = [];
    window.__audio.created = 0;
  });
  await page.waitForTimeout(ms);
  return page.evaluate(() => ({ ...window.__audio }));
};

const isDev = /localhost:(4310|5173)/.test(BASE);
const query = isDev ? '?p1ticks=70&p2ticks=60' : '';
await page.goto(`${BASE}/${query}`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1700);
if (await page.locator('.ignite-overlay').count()) {
  await page.mouse.click(196, 426);
  await page.waitForTimeout(1200);
}
const skip = page.locator('.skip-btn');
if (await skip.count()) await skip.click({ force: true });
await page.waitForSelector('.menu', { timeout: 15000 });

console.log('\nMENU');
// The menu bed runs at intensity 0.3 and is deliberately sparse, so give it a
// long enough window to prove it is scheduling at all.
const menu = await sample(8000);
summary.menuSources = menu.created;
check(menu.created > 8, `menu music scheduling (${menu.created} sources in 8s)`);

console.log('\nBATTLE — Phase I, Basalt Fields');
await page.click('text=Battle', { force: true });
await page.waitForSelector('.faction-select', { timeout: 5000 });
await page.click('text=March to the Basalt Fields', { force: true });
await page.waitForSelector('.matchmaking', { timeout: 5000 });
await page.click('text=Play offline now', { force: true });
await page.waitForSelector('.game-screen', { timeout: 10000 });
await page.waitForTimeout(2500);

const basalt = await sample(6000);
summary.basaltSources = basalt.created;
check(basalt.created > 60, `battle score scheduling (${basalt.created} sources in 6s)`);
const bg = gridLock(basalt.starts);
summary.basaltGridR = +bg.r.toFixed(3);
console.log(`        grid lock r=${bg.r.toFixed(3)}  on-grid ${(bg.onGrid * 100).toFixed(0)}%  (n=${bg.n})`);
check(bg.r > 0.8, `score locked to the 16th grid (r=${bg.r.toFixed(3)}, want > 0.8)`);
check(bg.onGrid > 0.85, `${(bg.onGrid * 100).toFixed(0)}% of onsets within 20ms of a grid line`);

// Combat SFX ride the same grid: deploy a unit and confirm the extra sources
// that fighting produces do not knock the score off its transport.
const board = await page.locator('.game-canvas-wrap').boundingBox();
for (let wave = 0; wave < 4; wave++) {
  await page.waitForTimeout(3800);
  const affordable = page.locator('.hand .card:not(.unaffordable):not(.spell-card)');
  if (!(await affordable.count())) continue;
  await affordable.first().click({ force: true });
  const gx = board.x + board.width * (wave % 2 ? 0.68 : 0.32);
  const gy = board.y + board.height * 0.9;
  await page.mouse.move(gx, gy);
  await page.mouse.down();
  await page.mouse.move(gx, gy - 6, { steps: 3 });
  await page.mouse.up();
}
await page.waitForTimeout(3000);
const fight = await sample(6000);
summary.combatSources = fight.created;
check(fight.created > 60, `combat audio active (${fight.created} sources in 6s)`);
const fg = gridLock(fight.starts);
summary.combatGridR = +fg.r.toFixed(3);
console.log(`        grid lock r=${fg.r.toFixed(3)}  on-grid ${(fg.onGrid * 100).toFixed(0)}%  (n=${fg.n})`);
check(fg.r > 0.7, `score holds the grid under combat load (r=${fg.r.toFixed(3)}, want > 0.7)`);

// Runaway scheduling was the old crackle symptom: sources per second should
// stay in a sane band rather than climbing without bound.
const perSec = fight.created / 6;
check(perSec < 120, `no runaway scheduling (${perSec.toFixed(0)} sources/s)`);

if (isDev) {
  console.log('\nBATTLE — Phase II, The Oasis');
  await page.waitForSelector('.phase-pill.oasis', { timeout: 60000 });
  await page.waitForTimeout(2500);
  const oasis = await sample(6000);
  check(oasis.created > 40, `oasis score scheduling (${oasis.created} sources in 6s)`);
  const og = gridLock(oasis.starts);
  console.log(`        grid lock r=${og.r.toFixed(3)}  on-grid ${(og.onGrid * 100).toFixed(0)}%  (n=${og.n})`);
  check(og.r > 0.7, `oasis score locked to the grid (r=${og.r.toFixed(3)})`);
  await page.waitForSelector('.results', { timeout: 60000 });
  console.log('        phase transition reached results');
}

console.log('\nDUELS');
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1700);
if (await page.locator('.ignite-overlay').count()) {
  await page.mouse.click(196, 426);
  await page.waitForTimeout(1200);
}
const skip2 = page.locator('.skip-btn');
if (await skip2.count()) await skip2.click({ force: true });
await page.waitForSelector('.menu', { timeout: 15000 });
await page.click('text=Duels', { force: true });
await page.waitForSelector('.duel-setup', { timeout: 5000 });
await page.waitForTimeout(900);
const roster = page.locator('.duel-roster .duel-card');
const rn = await roster.count();
for (let i = 0; i < rn; i++) await roster.nth(i).click({ force: true });
await page.click('text=Enter the Arena', { force: true });
await page.waitForSelector('.duel-screen', { timeout: 5000 });
await page.waitForTimeout(2500);
const duelIdle = await sample(4000);
summary.duelSources = duelIdle.created;
check(duelIdle.created > 10, `duel arena audio (${duelIdle.created} sources in 4s)`);
const strike = page.locator('.duel-controls button', { hasText: 'Strike' }).first();
if (await strike.count()) {
  await strike.click({ force: true });
  const clash = await sample(4500);
  check(clash.created > 10, `duel clash audio (${clash.created} sources on Strike)`);
}

console.log('\nCLASSROOM');
await page.goto(`${BASE}/`, { waitUntil: 'networkidle' });
await page.waitForTimeout(1700);
if (await page.locator('.ignite-overlay').count()) {
  await page.mouse.click(196, 426);
  await page.waitForTimeout(1200);
}
const skip3 = page.locator('.skip-btn');
if (await skip3.count()) await skip3.click({ force: true });
await page.waitForSelector('.menu', { timeout: 15000 });
await page.click('.btn-teach', { force: true });
await page.waitForSelector('.education', { timeout: 5000 });
await page.waitForTimeout(900);

const quiet = await sample(1500);
check(quiet.created <= 4, `menu music yields to the classroom (${quiet.created} sources idle)`);

const chapters = await page.locator('.edu-toc-card').count();
check(chapters === 6, `six chapters listed (${chapters})`);
for (let i = 0; i < chapters; i++) {
  await page.locator('.edu-toc-card').nth(i).click({ force: true });
  await page.waitForSelector('.edu-topic-head h2', { timeout: 5000 });
  const title = await page.locator('.edu-topic-head h2').textContent();
  const demo = page.locator('.demo-btn').first();
  await demo.scrollIntoViewIfNeeded();
  await page.evaluate(() => {
    window.__audio.starts = [];
    window.__audio.created = 0;
  });
  await demo.click({ force: true });
  await page.waitForTimeout(2200);
  const played = await page.evaluate(() => ({ ...window.__audio }));
  const g = gridLock(played.starts);
  (summary.chapters ??= []).push({ n: i + 1, sources: played.created, r: +g.r.toFixed(2) });
  check(
    played.created >= 3,
    `chapter ${i + 1} "${title}": demo played (${played.created} sources, grid r=${g.r.toFixed(2)})`,
  );
  await page.click('.edu-back', { force: true });
  await page.waitForSelector('.edu-hero h1', { timeout: 5000 });
}

const resumeBefore = await page.evaluate(() => window.__audio.created);
await page.click('.edu-back', { force: true });
await page.waitForSelector('.menu-actions', { timeout: 5000 });
await page.waitForTimeout(1800);
const resumeAfter = await page.evaluate(() => window.__audio.created);
summary.menuResume = resumeAfter - resumeBefore;
check(resumeAfter - resumeBefore > 6, `menu music resumes on exit (+${resumeAfter - resumeBefore} sources)`);

console.log('');
check(pageErrors.length === 0, `no page or console errors${pageErrors.length ? `:\n    ${pageErrors.join('\n    ')}` : ''}`);

console.log(`\nSUMMARY ${JSON.stringify(summary)}`);

await browser.close();
if (failures.length) {
  console.error(`\nAUDIO VERIFY FAILED (${failures.length})`);
  process.exit(1);
}
console.log('\nAUDIO VERIFY PASSED');
