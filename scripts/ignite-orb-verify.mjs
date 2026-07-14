// Verifies the boot → Tap-to-Begin handoff: the ignite orb must be ONE
// persistent DOM node with an identical bounding box and an unbroken
// breathing animation across the screen swap.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5198 } });
await server.listen();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:5198/');
await page.waitForSelector('.ignite-orb');

const boot = await page.evaluate(() => {
  const orb = document.querySelector('.ignite-orb');
  window.__bootOrb = orb;
  const rect = orb.getBoundingClientRect();
  const anim = orb.getAnimations()[0];
  window.__bootAnimStart = anim ? anim.startTime : null;
  return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
});

// Boot lasts >=0.9s and hands off once sprites settle (<=3.5s).
await page.waitForSelector('.tap-to-begin', { timeout: 8000 });
await page.waitForTimeout(600); // let label crossfade begin

const cine = await page.evaluate(() => {
  const orb = document.querySelector('.ignite-orb');
  const rect = orb.getBoundingClientRect();
  const anim = orb.getAnimations()[0];
  return {
    x: rect.x, y: rect.y, w: rect.width, h: rect.height,
    sameNode: orb === window.__bootOrb,
    sameAnimation: anim ? anim.startTime === window.__bootAnimStart : false,
    orbCount: document.querySelectorAll('.ignite-orb').length,
    tapLabelVisible: parseFloat(getComputedStyle(document.querySelector('.tap-label')).opacity) > 0,
    bootLabelFading: parseFloat(getComputedStyle(document.querySelector('.boot-label')).opacity) < 1,
  };
});

console.log('boot rect:', boot);
console.log('cinematic rect:', { x: cine.x, y: cine.y, w: cine.w, h: cine.h });
console.log('same DOM node:', cine.sameNode);
console.log('same animation (phase unbroken):', cine.sameAnimation);
console.log('orb count:', cine.orbCount);
console.log('tap label visible:', cine.tapLabelVisible, '| boot label fading:', cine.bootLabelFading);
console.log('page errors:', errors.length ? errors : 'none');

// Tap to begin must still work and dismiss the orb.
await page.click('.tap-to-begin');
await page.waitForTimeout(300);
const afterTap = await page.evaluate(() => ({
  orbGone: !document.querySelector('.ignite-orb'),
  skipShown: !!document.querySelector('.skip-btn'),
}));
console.log('after tap — orb gone:', afterTap.orbGone, '| cinematic running:', afterTap.skipShown);

await browser.close();
await server.close();

// The breathing keyframe scales the orb, so allow sub-pixel wobble from
// sampling mid-pulse; the LAYOUT box must not move.
const drift = Math.max(
  Math.abs(boot.x + boot.w / 2 - (cine.x + cine.w / 2)),
  Math.abs(boot.y + boot.h / 2 - (cine.y + cine.h / 2)),
);
const ok =
  errors.length === 0 &&
  cine.sameNode &&
  cine.sameAnimation &&
  cine.orbCount === 1 &&
  cine.tapLabelVisible &&
  drift < 0.5 &&
  afterTap.orbGone &&
  afterTap.skipShown;
console.log('center drift px:', drift.toFixed(3));
console.log(ok ? 'OK' : 'FAILED');
process.exit(ok ? 0 : 1);
