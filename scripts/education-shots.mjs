import { createServer } from 'vite';
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const server = await createServer({ server: { port: 5199 }, logLevel: 'silent' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
mkdirSync('/tmp/edu-shots', { recursive: true });

await page.goto('http://localhost:5199/');
await page.waitForSelector('.tap-to-begin', { timeout: 15000 });
await page.click('.tap-to-begin');
await page.waitForSelector('.skip-btn');
await page.click('.skip-btn');
await page.waitForSelector('.menu-actions');
await page.screenshot({ path: '/tmp/edu-shots/1-menu.png' });

await page.click('.btn-teach', { force: true });
await page.waitForSelector('.edu-hero h1');
await page.screenshot({ path: '/tmp/edu-shots/2-hub.png' });

await page.locator('.edu-toc-card').nth(0).click();
await page.waitForSelector('.staff-svg');
await page.screenshot({ path: '/tmp/edu-shots/3-key-top.png' });

await page.click('.edu-back');
await page.locator('.edu-toc-card').nth(1).click();
await page.waitForSelector('.chord-strip');
await page.screenshot({ path: '/tmp/edu-shots/4-chords.png' });

await page.click('.edu-back');
await page.locator('.edu-toc-card').nth(2).click();
await page.waitForSelector('.staff-svg');
await page.locator('.demo-btn').first().click();
await page.waitForTimeout(2100);
await page.screenshot({ path: '/tmp/edu-shots/5-melody-staff-playing.png' });
await page.locator('.demo-btn').first().click();

await page.click('.edu-back');
await page.locator('.edu-toc-card').nth(3).click();
await page.waitForSelector('.warrior-card');
await page.locator('.warrior-tap').first().scrollIntoViewIfNeeded();
await page.locator('.warrior-tap').first().click();
await page.waitForTimeout(1800);
await page.screenshot({ path: '/tmp/edu-shots/6-harmony-eagle.png' });
await page.locator('.warrior-tap').first().click();

await page.click('.edu-back');
await page.locator('.edu-toc-card').nth(4).click();
await page.waitForSelector('.meter-strip');
await page.locator('svg.pyramid').scrollIntoViewIfNeeded();
await page.screenshot({ path: '/tmp/edu-shots/7-rhythm-pyramid.png' });

await page.click('.edu-back');
await page.locator('.edu-toc-card').nth(5).click();
await page.waitForSelector('.iso-mix');
await page.locator('.quiz').scrollIntoViewIfNeeded();
await page.locator('.quiz-q').first().locator('.quiz-option').nth(1).click();
await page.waitForTimeout(250);
await page.screenshot({ path: '/tmp/edu-shots/8-percussion-quiz.png' });

await browser.close();
await server.close();
console.log('shots saved');
