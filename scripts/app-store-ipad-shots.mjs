/* App Store Connect — 13" iPad screenshots (portrait).
 *
 * Required size: 2064 × 2752 px. Captures the six beats documented in
 * docs/APP-STORE-LISTING.md, writes PNGs into app-store-screenshots/ipad-13/.
 *
 * Assumes `vite preview --port 4310` (or pass a base URL).
 *
 *   node scripts/app-store-ipad-shots.mjs [baseUrl]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const BASE = process.argv[2] ?? 'http://localhost:4310';
const OUT = path.resolve('app-store-screenshots/ipad-13');
fs.mkdirSync(OUT, { recursive: true });

/** Logical viewport that lands exactly on Apple's 13" iPad slot at 2×. */
const W = 1032;
const H = 1376;
const DPR = 2; // → 2064 × 2752

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  deviceScaleFactor: DPR,
  hasTouch: true,
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR:', e.message));

const toMenu = async () => {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1600);
  if (await page.locator('.ignite-overlay').count()) {
    await page.mouse.click(W / 2, H / 2);
    await page.waitForTimeout(1100);
  }
  const skip = page.locator('.skip-btn');
  if (await skip.count()) await skip.click({ force: true });
  await page.waitForSelector('.menu', { timeout: 20000 });
  await page.waitForTimeout(500);
};

const save = async (file, label) => {
  const raw = `${OUT}/_${file}`;
  await page.screenshot({ path: raw, type: 'png' });
  const meta = await sharp(raw).metadata();
  if (meta.width !== 2064 || meta.height !== 2752) {
    // Exact App Store slot — pad or crop-centre if the device chrome drifted.
    await sharp(raw)
      .resize(2064, 2752, { fit: 'cover', position: 'centre' })
      .png({ compressionLevel: 9, palette: false })
      .toFile(`${OUT}/${file}`);
  } else {
    await sharp(raw)
      .png({ compressionLevel: 9, palette: false })
      .toFile(`${OUT}/${file}`);
  }
  fs.unlinkSync(raw);
  const kb = Math.round(fs.statSync(`${OUT}/${file}`).size / 1024);
  console.log(`  ${file}  ${kb} KB  — ${label}`);
};

console.log(`Capturing 13" iPad App Store set → ${OUT}`);

// 6 · Home Screen (listed last in the store, shot first while the menu is clean)
await toMenu();
await save('06-home.png', 'Home — Teach me / Battle / Duels');

// 1 · Conservatory hub
await page.click('.btn-teach', { force: true });
await page.waitForSelector('.education', { timeout: 8000 });
await page.waitForTimeout(900);
await save('01-conservatory.png', 'Conservatory hub');

// 2 · Melody chapter
await page.click('.edu-toc-card:has-text("Melody")', { force: true });
await page.waitForSelector('.edu-topic-head', { timeout: 5000 });
await page.waitForTimeout(1200);
// Nudge the staff into view if the chapter opens mid-scroll.
const staff = page.locator('.staff, .notation, canvas').first();
if (await staff.count()) {
  await staff.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(600);
}
await save('02-melody.png', 'Melody — Theme A on staff');

// 3 · Harmony chapter
await page.click('.edu-back', { force: true });
await page.waitForSelector('.edu-toc', { timeout: 5000 });
await page.click('.edu-toc-card:has-text("Harmony")', { force: true });
await page.waitForSelector('.edu-topic-head', { timeout: 5000 });
await page.waitForTimeout(1200);
const warrior = page.locator('.edu-body button, .edu-demo, .card').first();
if (await warrior.count()) {
  await warrior.scrollIntoViewIfNeeded().catch(() => {});
  await page.waitForTimeout(400);
}
await save('03-harmony.png', 'Harmony — warrior / chord demo');

// 4 · Battle — Basalt Fields mid-fight
await toMenu();
await page.click('text=Battle', { force: true });
await page.waitForSelector('.faction-select', { timeout: 6000 });
await page.click('text=March to the Basalt Fields', { force: true });
await page.waitForSelector('.matchmaking', { timeout: 6000 });
await page.click('text=Play offline now', { force: true });
await page.waitForSelector('.game-screen', { timeout: 12000 });
await page.waitForTimeout(2800);

const board = await page.locator('.game-canvas-wrap').boundingBox();
const gates = board
  ? [
      { x: board.x + board.width * 0.32, y: board.y + board.height * 0.9 },
      { x: board.x + board.width * 0.68, y: board.y + board.height * 0.9 },
    ]
  : [];
for (let wave = 0; wave < 7; wave++) {
  await page.waitForTimeout(3800);
  const affordable = page.locator('.hand .card:not(.unaffordable)');
  if (!(await affordable.count()) || !gates.length) continue;
  await affordable.first().click({ force: true });
  await page.waitForTimeout(200);
  const g = gates[wave % 2];
  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x, g.y - 6, { steps: 4 });
  await page.mouse.up();
}
await page.waitForTimeout(2200);
await save('04-battle.png', 'Battle — Basalt Fields mid-fight');

// 5 · Later battle / pressure beat (keep fighting a bit longer)
for (let wave = 0; wave < 4; wave++) {
  await page.waitForTimeout(4000);
  const affordable = page.locator('.hand .card:not(.unaffordable)');
  if (!(await affordable.count()) || !gates.length) continue;
  await affordable.first().click({ force: true });
  await page.waitForTimeout(200);
  const g = gates[wave % 2];
  await page.mouse.move(g.x, g.y);
  await page.mouse.down();
  await page.mouse.move(g.x, g.y - 6, { steps: 4 });
  await page.mouse.up();
}
await page.waitForTimeout(1800);
await save('05-battle-late.png', 'Battle — later pressure');

await browser.close();

const readme = `# 13" iPad App Store screenshots

Size: **2064 × 2752** (portrait) — App Store Connect 13" iPad slot.

| File | Beat | Suggested overlay |
| --- | --- | --- |
| \`01-conservatory.png\` | Conservatory hub | Learn music theory inside the game |
| \`02-melody.png\` | Melody chapter | Notes light up with the real score |
| \`03-harmony.png\` | Harmony chapter | Tap warriors. Hear real harmony. |
| \`04-battle.png\` | Basalt Fields mid-fight | Warriors join the orchestra |
| \`05-battle-late.png\` | Later battle pressure | Feel the minute-4 drummer |
| \`06-home.png\` | Home Screen | Battle. Duels. Then Teach me. |

Upload these six in this order under the **13" iPad Display** screenshot set.
Regenerate with:

\`\`\`bash
npx vite preview --port 4310 &
node scripts/app-store-ipad-shots.mjs
\`\`\`
`;
fs.writeFileSync(`${OUT}/README.md`, readme);
console.log('\nDone.');
