/**
 * End-to-end verification of the Intro to Music Theory classroom.
 * Boots the app, skips the intro, enters via "Teach me", opens every chapter,
 * plays demos (asserting oscillators actually start), checks caption and
 * notation sync, exercises the quiz, and verifies back/next navigation and
 * the menu-music pause/resume contract.
 */

import { createServer } from 'vite';
import { chromium } from 'playwright';

const server = await createServer({ server: { port: 5199 }, logLevel: 'silent' });
await server.listen();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(`console: ${msg.text()}`);
});

const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  process.exitCode = 1;
};

await page.goto('http://localhost:5199/');

// Instrument oscillator/noise creation so we can prove demos make sound.
await page.addInitScript(() => {});
await page.evaluate(() => {
  window.__oscCount = 0;
  const proto = (window.AudioContext ?? window.webkitAudioContext).prototype;
  for (const method of ['createOscillator', 'createBufferSource']) {
    const orig = proto[method];
    proto[method] = function (...args) {
      window.__oscCount++;
      return orig.apply(this, args);
    };
  }
});

// Boot → cinematic → skip → menu.
await page.waitForSelector('.tap-to-begin', { timeout: 15000 });
await page.click('.tap-to-begin');
await page.waitForSelector('.skip-btn', { timeout: 8000 });
await page.click('.skip-btn');
await page.waitForSelector('.menu-actions', { timeout: 8000 });

// The Teach me button exists on the home screen.
const teachBtn = page.locator('.btn-teach');
if ((await teachBtn.count()) !== 1) fail('Teach me button not found on menu');
console.log('menu: Teach me button present');

await teachBtn.click();
await page.waitForSelector('.edu-hero h1', { timeout: 5000 });
const title = await page.textContent('.edu-hero h1');
if (title.trim() !== 'Intro to Music Theory') fail(`hub title: ${title}`);
const tocCount = await page.locator('.edu-toc-card').count();
if (tocCount !== 6) fail(`expected 6 chapters, found ${tocCount}`);
console.log(`hub: "${title.trim()}" with ${tocCount} chapters`);

// Menu music must be stopped inside the classroom.
await page.waitForTimeout(700);
const before = await page.evaluate(() => window.__oscCount);
await page.waitForTimeout(1200);
const after = await page.evaluate(() => window.__oscCount);
if (after - before > 4) fail(`music still scheduling in classroom (+${after - before} nodes)`);
console.log('classroom: menu music silent');

const chapterChecks = [
  { title: 'Key Signature', demo: 'The D natural minor scale', staff: true },
  { title: 'Chord Progression', demo: 'The full loop, from the score', staff: false },
  { title: 'Melody', demo: 'Theme A — the Vaalbara motif', staff: true },
  { title: 'Harmony', demo: null, staff: false },
  { title: 'Time Signature & Rhythm', demo: 'Measures and downbeats', staff: true },
  { title: 'Percussion', demo: 'The suckout & slam', staff: false },
];

for (let i = 0; i < 6; i++) {
  await page.locator('.edu-toc-card').nth(i).click();
  await page.waitForSelector('.edu-topic-head h2', { timeout: 5000 });
  const h2 = (await page.textContent('.edu-topic-head h2')).trim();
  if (h2 !== chapterChecks[i].title) fail(`chapter ${i + 1} title: ${h2}`);

  // Quiz present with 5 questions.
  const questions = await page.locator('.quiz-q').count();
  if (questions !== 5) fail(`${h2}: expected 5 quiz questions, found ${questions}`);

  // Play the chapter's flagship demo and confirm audio nodes spin up.
  const demoCount = await page.locator('.demo-btn').count();
  if (demoCount < 4) fail(`${h2}: too few demo buttons (${demoCount})`);
  const start = await page.evaluate(() => window.__oscCount);
  const target = chapterChecks[i].demo
    ? page.locator('.demo-btn', { hasText: chapterChecks[i].demo }).first()
    : page.locator('.warrior-tap').first();
  await target.click();
  await page.waitForTimeout(1400);
  const played = (await page.evaluate(() => window.__oscCount)) - start;
  if (played < 3) fail(`${h2}: demo produced only ${played} audio nodes`);

  // Staff highlight sync where notation is attached to the played demo.
  if (chapterChecks[i].staff) {
    const activeNotes = await page.locator('.staff-note.active').count();
    if (i === 4) {
      const activeBeat = await page.locator('.meter-beat.active').count();
      if (activeBeat !== 1) fail(`${h2}: meter strip not highlighting`);
    } else if (activeNotes < 1) {
      fail(`${h2}: staff not highlighting during playback`);
    }
  }

  // Warrior card captions narrate while playing (Harmony chapter).
  if (i === 3) {
    const caption = await page.locator('.warrior-caption.live').first().textContent();
    if (!caption || caption.length < 20) fail('Harmony: card caption not narrating');
    else console.log(`  card caption live: "${caption.slice(0, 52)}…"`);
  }

  // Stop by tapping again.
  await target.click();
  await page.waitForTimeout(250);

  // Quiz interaction: answer question 1 and expect feedback + explanation.
  const firstOption = page.locator('.quiz-q').first().locator('.quiz-option').first();
  await firstOption.scrollIntoViewIfNeeded();
  await firstOption.click();
  const explained = await page.locator('.quiz-q').first().locator('.quiz-explain').count();
  const marked = await page.locator('.quiz-option.correct').count();
  if (explained !== 1 || marked < 1) fail(`${h2}: quiz feedback missing`);

  console.log(`chapter ${i + 1} "${h2}": demos + staff + quiz OK (${played} nodes)`);

  // Next-topic link from chapters 1–5; back to hub via the Back button too.
  if (i < 5) {
    const next = await page.locator('.edu-next .next-title').textContent();
    if (!next.includes(chapterChecks[i + 1].title)) fail(`${h2}: next link says ${next}`);
  }
  await page.click('.edu-back');
  await page.waitForSelector('.edu-toc-card', { timeout: 5000 });
}

// Sequential navigation via "Next chapter".
await page.locator('.edu-toc-card').nth(0).click();
await page.waitForSelector('.edu-topic-head h2');
await page.locator('.edu-next').click();
const secondTitle = (await page.textContent('.edu-topic-head h2')).trim();
if (secondTitle !== 'Chord Progression') fail(`next-chapter nav landed on ${secondTitle}`);
console.log('navigation: Next chapter advances correctly');

// Back from chapter → hub, back from hub → home, and menu music resumes.
await page.click('.edu-back');
await page.waitForSelector('.edu-hero h1');
const beforeExit = await page.evaluate(() => window.__oscCount);
await page.click('.edu-back');
await page.waitForSelector('.menu-actions', { timeout: 5000 });
await page.waitForTimeout(1500);
const afterExit = await page.evaluate(() => window.__oscCount);
if (afterExit - beforeExit < 6) fail(`menu music did not resume (+${afterExit - beforeExit} nodes)`);
console.log(`navigation: back to home, menu music resumed (+${afterExit - beforeExit} nodes)`);

if (errors.length) {
  fail(`page errors:\n${errors.join('\n')}`);
} else {
  console.log('no page errors');
}

await browser.close();
await server.close();
console.log(process.exitCode ? 'VERIFICATION FAILED' : 'ALL CHECKS PASSED');
