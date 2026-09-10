/* Pull the lightning dome (and any ruin pass) out of the full-board
 * forcefield / crumble paintings so we can pulse or swap just that layer
 * on top of Oasis.png. The uploads are opaque and slightly different sizes.
 *
 *   node scripts/extract-oasis-overlays.mjs
 */
import sharp from 'sharp';
import fs from 'node:fs';

const BASE = 'art-src/oasis.png';
const TARGET_W = 1206;

const JOBS = [
  {
    out: 'public/art/forcefield-bottom.webp',
    which: 'bottom',
    srcs: [
      'art-src/forcefield-bottom.png',
      'Forcefield bottom.png',
    ],
  },
  {
    out: 'public/art/forcefield-top.webp',
    which: 'top',
    srcs: [
      'art-src/forcefield-top.png',
      'Forcefield top.png',
    ],
  },
  {
    out: 'public/art/crumble-bottom.webp',
    which: 'bottom',
    srcs: [
      'art-src/crumble-bottom.png',
      'art-src/Crumble bottom.png',
      'Crumble bottom.png',
      'art-src/ruin-bottom.png',
      'Ruin bottom.png',
    ],
  },
  {
    out: 'public/art/crumble-top.webp',
    which: 'top',
    srcs: [
      'art-src/crumble-top.png',
      'art-src/Crumble top.png',
      'Crumble top.png',
      'art-src/ruin-top.png',
      'Ruin top.png',
    ],
  },
];

function inDome(wx, wy, which) {
  if (which === 'bottom') {
    const dx = (wx - 4.5) / 2.15;
    const dy = (wy - 11.62) / 2.05;
    return dx * dx + dy * dy <= 1;
  }
  const dx = (wx - 4.5) / 2.15;
  const dy = (wy - 2.42) / 2.25;
  return dx * dx + dy * dy <= 1;
}

function resolveSrc(srcs) {
  for (const s of srcs) {
    if (fs.existsSync(s)) return s;
  }
  return null;
}

async function extract(overlayPath, outPath, W, H, which) {
  const base = await sharp(BASE).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const ov = await sharp(overlayPath).resize(W, H, { fit: 'fill' }).removeAlpha().raw().toBuffer();
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const x = i % W;
    const y = (i / W) | 0;
    const wx = (x + 0.5) / W * 9;
    const wy = (y + 0.5) / H * 15;
    const r = ov[i * 3];
    const g = ov[i * 3 + 1];
    const b = ov[i * 3 + 2];
    const dr = r - base[i * 3];
    const dg = g - base[i * 3 + 1];
    const db = b - base[i * 3 + 2];
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);
    const elec = b > 165 && g > 110 && b > r + 12 && r < 190;
    let a = 0;
    if (elec) a = 235;
    else if (dist > 28) a = Math.min(255, Math.round((dist - 28) * 3.4));
    if (a > 0 && !inDome(wx, wy, which)) a = 0;
    rgba[i * 4] = r;
    rgba[i * 4 + 1] = g;
    rgba[i * 4 + 2] = b;
    rgba[i * 4 + 3] = a;
  }
  // Dilate alpha one pixel so lightning veins do not hole.
  const dil = Buffer.from(rgba);
  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      if (rgba[i + 3] > 40) continue;
      let best = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const j = ((y + dy) * W + (x + dx)) * 4;
        if (rgba[j + 3] > best) best = rgba[j + 3];
      }
      if (best > 80) {
        dil[i] = rgba[i];
        dil[i + 1] = rgba[i + 1];
        dil[i + 2] = rgba[i + 2];
        dil[i + 3] = Math.min(200, best);
      }
    }
  }
  await sharp(dil, { raw: { width: W, height: H, channels: 4 } })
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(outPath);
  const kb = Math.round(fs.statSync(outPath).size / 1024);
  console.log(`${outPath}  ${W}x${H}  ${kb} KB`);
}

const meta = await sharp(BASE).metadata();
const srcW = meta.width ?? 711;
const srcH = meta.height ?? 1554;
const W = TARGET_W;
const H = Math.round(srcH * (W / srcW));
fs.mkdirSync('public/art', { recursive: true });

for (const job of JOBS) {
  const src = resolveSrc(job.srcs);
  if (!src) {
    console.log(`skip ${job.out} (not added yet)`);
    continue;
  }
  await extract(src, job.out, W, H, job.which);
}
