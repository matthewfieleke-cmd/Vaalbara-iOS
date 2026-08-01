/* Builds art-src/anim/scorpion-duel-attack.png from the eight authored strike
 * poses in art-src/anim/scorpion-strike-src/.
 *
 * The poses are drawn one per canvas, so each sits at its own size and its own
 * spot — up to 1.4x apart. Splitting them straight into a film strip would make
 * the scorpion swim, because sprites.ts crops every panel to its own content
 * box and plants that box on the ground: any difference in where the animal was
 * drawn turns into a jump between frames.
 *
 * So we register them first. Only the tail moves in this sequence — body, legs
 * and pincers are the same drawing throughout — which gives us something solid
 * to align on. Each frame is searched over scale and offset for the fit that
 * best overlaps the reference's lower body, so what comes out the far end is
 * one motionless animal with a moving tail, which is what the animation is
 * supposed to be. --overlay writes a colour-coded stack of the registered
 * silhouettes so the fit can be checked by eye.
 *
 *   node scripts/build-scorpion-strike.mjs [--overlay]
 */
import sharp from 'sharp';
import fs from 'node:fs';

const SRC = 'art-src/anim/scorpion-strike-src';
const OUT = 'art-src/anim/scorpion-duel-attack.png';
const OVERLAY = 'art-src/anim/scorpion-strike-src/_registration.png';
const N = 8;
const REF = 2; // median-sized pose, so nothing is scaled far from as-drawn
const DS = 8; // search runs on 1/8 masks; full res is far more than it needs
/** Rows above the feet that hold legs and lower body — the part of the drawing
 *  that is identical in every pose, and therefore what we align on. */
const BODY_BAND = 240;
const MARGIN = 24;
/** Long edge of the finished sheet. Sized so the tallest pose still has ~560px
 *  of content, which lands near 1:1 on an iPhone and ~1.3x on a 13" iPad. */
const SHEET_MAX_W = 8192;

const isPaper = (r, g, b) => Math.min(r, g, b) > 225 && Math.max(r, g, b) - Math.min(r, g, b) < 30;

/** Background reachable from the border, so bright highlights enclosed by the
 *  carapace stay part of the animal. */
function contentMask(data, w, h) {
  const paper = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const o = i * 3;
    paper[i] = isPaper(data[o], data[o + 1], data[o + 2]) ? 1 : 0;
  }
  const seen = new Uint8Array(w * h);
  const stack = [];
  const push = (i) => {
    if (!seen[i] && paper[i]) {
      seen[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + w - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }
  const m = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) m[i] = seen[i] ? 0 : 1;
  return m;
}

function boxOf(m, w, h) {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!m[y * w + x]) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  return { minX, minY, maxX, maxY };
}

function downsample(m, w, h, f) {
  const dw = Math.floor(w / f);
  const dh = Math.floor(h / f);
  const o = new Uint8Array(dw * dh);
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      let n = 0;
      for (let j = 0; j < f; j++) for (let i = 0; i < f; i++) if (m[(y * f + j) * w + x * f + i]) n++;
      o[y * dw + x] = n > (f * f) / 3 ? 1 : 0;
    }
  }
  return { dm: o, dw, dh };
}

const frames = [];
for (let i = 0; i < N; i++) {
  const file = `${SRC}/frame-${i}.png`;
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const m = contentMask(data, info.width, info.height);
  const box = boxOf(m, info.width, info.height);
  frames.push({ file, w: info.width, h: info.height, mask: m, box, ...downsample(m, info.width, info.height, DS) });
}

// Reference body region: the band of rows just above the reference's feet.
const ref = frames[REF];
const refFeet = Math.floor(ref.box.maxY / DS);
const bandTop = Math.max(0, refFeet - Math.round(BODY_BAND / DS));
const roi = [];
for (let y = bandTop; y <= refFeet; y++) for (let x = 0; x < ref.dw; x++) roi.push(y * ref.dw + x);

function score(f, s, dx, dy) {
  let inter = 0;
  let union = 0;
  for (const i of roi) {
    const rx = i % ref.dw;
    const ry = (i / ref.dw) | 0;
    const a = ref.dm[i];
    const sx = Math.round((rx - dx) / s);
    const sy = Math.round((ry - dy) / s);
    const b = sx >= 0 && sx < f.dw && sy >= 0 && sy < f.dh ? f.dm[sy * f.dw + sx] : 0;
    if (a || b) union++;
    if (a && b) inter++;
  }
  return union ? inter / union : 0;
}

console.log(`registering against frame ${REF}`);
for (let i = 0; i < N; i++) {
  const f = frames[i];
  if (i === REF) {
    f.scale = 1;
    f.dx = 0;
    f.dy = 0;
    f.fit = 1;
    console.log(`  frame ${i}: reference`);
    continue;
  }
  // Seed the offset from the feet so the search only has to polish.
  const seedDy = refFeet - Math.floor(f.box.maxY / DS);
  let best = { fit: -1 };
  for (let s = 0.7; s <= 1.5001; s += 0.01) {
    for (let dx = -34; dx <= 34; dx++) {
      for (let dy = seedDy - 6; dy <= seedDy + 6; dy++) {
        const fit = score(f, s, dx, dy);
        if (fit > best.fit) best = { fit, s, dx, dy };
      }
    }
  }
  f.scale = best.s;
  f.dx = best.dx * DS;
  f.dy = best.dy * DS;
  f.fit = best.fit;
  console.log(`  frame ${i}: scale ${best.s.toFixed(3)} offset ${f.dx},${f.dy} overlap ${(best.fit * 100).toFixed(1)}%`);
}

/* The overlap search settles scale and horizontal placement, but it is a
 * whole-silhouette fit and can still leave the feet a few dozen pixels apart.
 * The feet are the one landmark with a physical meaning here — they are where
 * the animal meets the ground, and the tail never dips below them in this
 * sequence — so snap them to a common row afterwards. A flat ground line is
 * what stops the scorpion bobbing as the strike plays. */
const groundRow = Math.max(...frames.map((f) => f.box.maxY * f.scale + f.dy));
for (const f of frames) f.dy = groundRow - f.box.maxY * f.scale;
console.log(`ground row snapped to ${groundRow.toFixed(0)} for all frames`);

/** Where a frame's own pixel lands in reference space. */
const mapX = (f, x) => x * f.scale + f.dx;
const mapY = (f, y) => y * f.scale + f.dy;

if (process.argv.includes('--overlay')) {
  const ow = ref.w;
  const oh = ref.h;
  const buf = Buffer.alloc(ow * oh * 3, 255);
  const hues = [[220, 40, 40], [230, 140, 30], [200, 200, 40], [60, 190, 60], [40, 190, 200], [60, 90, 230], [160, 70, 220], [230, 70, 170]];
  for (let i = 0; i < N; i++) {
    const f = frames[i];
    const [r, g, b] = hues[i];
    for (let y = f.box.minY; y <= f.box.maxY; y += 2) {
      for (let x = f.box.minX; x <= f.box.maxX; x += 2) {
        if (!f.mask[y * f.w + x]) continue;
        const px = Math.round(mapX(f, x));
        const py = Math.round(mapY(f, y));
        if (px < 0 || px >= ow || py < 0 || py >= oh) continue;
        const d = (py * ow + px) * 3;
        buf[d] = Math.round(buf[d] * 0.75 + r * 0.25);
        buf[d + 1] = Math.round(buf[d + 1] * 0.75 + g * 0.25);
        buf[d + 2] = Math.round(buf[d + 2] * 0.75 + b * 0.25);
      }
    }
  }
  await sharp(buf, { raw: { width: ow, height: oh, channels: 3 } }).png().toFile(OVERLAY);
  console.log(`\nwrote ${OVERLAY}`);
}

// Panel geometry in reference space: fit every registered pose with margin so
// no tail is clipped and no pose bleeds into its neighbour.
let left = Infinity;
let right = -Infinity;
let top = Infinity;
let bottom = -Infinity;
for (const f of frames) {
  left = Math.min(left, mapX(f, f.box.minX));
  right = Math.max(right, mapX(f, f.box.maxX));
  top = Math.min(top, mapY(f, f.box.minY));
  bottom = Math.max(bottom, mapY(f, f.box.maxY));
}
let panelW = Math.ceil(right - left) + MARGIN * 2;
let panelH = Math.ceil(bottom - top) + MARGIN * 2;
// Keep the finished strip inside a sane texture budget.
const fit = Math.min(1, SHEET_MAX_W / (panelW * N));
panelW = Math.round(panelW * fit);
panelH = Math.round(panelH * fit);
console.log(`\npanel ${panelW}x${panelH}${fit < 1 ? ` (strip fit ${fit.toFixed(3)})` : ''}`);

const sheetW = panelW * N;
const sheet = Buffer.alloc(sheetW * panelH * 3, 255);
for (let i = 0; i < N; i++) {
  const f = frames[i];
  const s = f.scale * fit;
  const sw = Math.max(1, Math.round(f.w * s));
  const sh = Math.max(1, Math.round(f.h * s));
  const scaled = await sharp(f.file).removeAlpha().resize(sw, sh, { kernel: 'lanczos3' }).raw().toBuffer();
  const offX = Math.round((f.dx - left) * fit) + MARGIN;
  const offY = Math.round((f.dy - top) * fit) + MARGIN;
  for (let y = 0; y < sh; y++) {
    const py = y + offY;
    if (py < 0 || py >= panelH) continue;
    for (let x = 0; x < sw; x++) {
      const px = x + offX;
      if (px < 0 || px >= panelW) continue;
      const src = (y * sw + x) * 3;
      const dst = (py * sheetW + i * panelW + px) * 3;
      sheet[dst] = scaled[src];
      sheet[dst + 1] = scaled[src + 1];
      sheet[dst + 2] = scaled[src + 2];
    }
  }
}

await sharp(sheet, { raw: { width: sheetW, height: panelH, channels: 3 } })
  .png({ compressionLevel: 9 })
  .toFile(OUT);
console.log(`wrote ${OUT} ${sheetW}x${panelH} (${(fs.statSync(OUT).size / 1024 / 1024).toFixed(2)} MB)`);
