/* Draws the duel-stage flow regions over the source paintings, and reports how
 * much of each box the chroma key actually catches. Run this after repainting
 * a backdrop to re-walk the coordinates in src/duel-flow-regions.ts.
 *
 *   npx tsx scripts/flow-regions.mjs         -> /tmp/flow-regions-*.png
 */
import sharp from 'sharp';
import { FLOW_REGIONS } from '../src/duel-flow-regions.ts';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

const key = (world, r, g, b) => {
  if (world === 'basalt') {
    return clamp01((r - b - 40) / 80) * clamp01((r - 150) / 70);
  }
  const mn = Math.min(r, g, b);
  const lum = (r + g + b) / 3;
  return Math.max(
    clamp01((lum - 100) / 70) * clamp01((b - r + 30) / 50),
    Math.max(
      clamp01((mn - 120) / 60) * clamp01((b - 135) / 55),
      clamp01((Math.min(g, b) - 100) / 70) * clamp01((g * 0.9 - r) / 45),
    ),
  );
};

for (const world of Object.keys(FLOW_REGIONS)) {
  const src = `art-src/duel-${world}.png`;
  const { data, info } = await sharp(src)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: W, height: H, channels } = info;

  console.log(`\n${world}  (${W}x${H})`);
  const rects = [];
  for (const def of FLOW_REGIONS[world]) {
    const x0 = Math.round(def.x * W);
    const y0 = Math.round(def.y * H);
    const x1 = Math.min(W, Math.round((def.x + def.w) * W));
    const y1 = Math.min(H, Math.round((def.y + def.h) * H));
    let keyed = 0;
    let total = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * W + x) * channels;
        total++;
        if (key(world, data[i], data[i + 1], data[i + 2]) > 0.15) keyed++;
      }
    }
    const pct = total ? (keyed / total) * 100 : 0;
    const flag = pct < 6 ? '  << thin: the fluid may barely move' : '';
    console.log(
      `  ${def.kind.padEnd(6)} x${def.x.toFixed(3)} y${def.y.toFixed(3)} ` +
        `${String(x1 - x0).padStart(4)}x${String(y1 - y0).padEnd(4)} ` +
        `keyed ${pct.toFixed(1).padStart(5)}%${flag}`,
    );
    rects.push({ def, x0, y0, x1, y1 });
  }

  const outW = 640;
  const k = outW / W;
  const outH = Math.round(H * k);
  const shapes = rects
    .map(({ def, x0, y0, x1, y1 }) => {
      const stroke = def.kind === 'fall' ? '#00ffff' : '#ffff00';
      return (
        `<rect x="${(x0 * k).toFixed(1)}" y="${(y0 * k).toFixed(1)}" ` +
        `width="${((x1 - x0) * k).toFixed(1)}" height="${((y1 - y0) * k).toFixed(1)}" ` +
        `fill="none" stroke="${stroke}" stroke-width="2"/>`
      );
    })
    .join('');
  const overlay = Buffer.from(
    `<svg width="${outW}" height="${outH}" xmlns="http://www.w3.org/2000/svg">${shapes}</svg>`,
  );
  const out = `/tmp/flow-regions-${world}.png`;
  await sharp(src)
    .resize({ width: outW })
    .composite([{ input: overlay }])
    .png()
    .toFile(out);
  console.log(`  -> ${out}`);
}
