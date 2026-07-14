// Verifies the restored pulsed Bee bed: oscillators retrigger every 8th,
// harmony joins with a second swarm, and no page errors occur.
import { chromium } from 'playwright';
import { createServer } from 'vite';

const server = await createServer({ server: { port: 5199 } });
await server.listen();

const browser = await chromium.launch({
  args: ['--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (err) => errors.push(String(err)));

await page.goto('http://localhost:5199/');
await page.waitForTimeout(1500);

const result = await page.evaluate(async () => {
  const proto = OscillatorNode.prototype ?? null;
  let oscCount = 0;
  const origStart = proto.start;
  proto.start = function (...args) {
    oscCount += 1;
    return origStart.apply(this, args);
  };

  const mod = await import('/src/audio.ts');
  const { unlockAudio, music } = mod;
  unlockAudio();
  music.start();
  music.setMode('basalt');

  // One swarm for 4s, then a second joins for 4s.
  const pulse = (bees) =>
    music.setBattlePulse({
      phase: 'basalt',
      basaltElapsedSec: 60,
      unitCount: bees * 5,
      speciesCounts: { bees },
    });

  pulse(1);
  const t0 = oscCount;
  await new Promise((r) => setTimeout(r, 4000));
  const oneSwarm = oscCount - t0;

  pulse(2);
  const t1 = oscCount;
  await new Promise((r) => setTimeout(r, 4000));
  const twoSwarms = oscCount - t1;

  music.stop();
  return { oneSwarm, twoSwarms };
});

console.log('oscillators started (4s, one swarm):', result.oneSwarm);
console.log('oscillators started (4s, two swarms):', result.twoSwarms);
console.log('page errors:', errors.length ? errors : 'none');

await browser.close();
await server.close();

if (errors.length) process.exit(1);
// With bees pulsing on 8ths (~5 pulses/sec at 150bpm 8ths) we expect a
// meaningful oscillator flow, and two swarms should exceed one swarm.
if (result.oneSwarm < 20 || result.twoSwarms <= result.oneSwarm) {
  console.error('unexpected pulse counts');
  process.exit(1);
}
console.log('OK');
