/* ============================================================================
 * Battle balance harness — bot vs bot, many seeds.
 * Reports Phase 1 / Phase 2 length, marble crumble time, spell use, win rates.
 *
 *   npx tsx scripts/balance-battle.ts
 * ========================================================================== */

import { BotBrain, advanceTick, createGame, phase1Winner, resetIds } from '../src/engine';
import type { FactionId, GameState, PlayerInput } from '../src/types';
import { PHASE1_TICKS, PHASE2_TICKS, TICK_MS, TRANSITION_TICKS } from '../src/types';

const MAX_TICKS = PHASE1_TICKS + TRANSITION_TICKS + PHASE2_TICKS + 8;
const MATCHES = Number(process.env.BALANCE_N ?? 48);

interface Row {
  seed: number;
  factions: [FactionId, FactionId];
  winner: string;
  winnerFaction: string;
  p1Ticks: number;
  p2Ticks: number;
  crumple: boolean;
  timeout: boolean;
  ward: string;
  wardWon: boolean | null;
  sulfur: number;
  thicket: number;
  lava: number;
  shrineShots: number;
  marbleDmg: [number, number];
  towerDmg: [number, number];
  razed: [number, number];
}

function run(seed: number, factions: [FactionId, FactionId]): Row {
  resetIds();
  const st: GameState = createGame(seed, factions);
  const bots = [new BotBrain(0, seed + 1, 'strong'), new BotBrain(1, seed + 2, 'strong')];
  let seq = 0;
  let p1Ticks = 0;
  let p2Ticks = 0;
  let sulfur = 0;
  let thicket = 0;
  let lava = 0;
  let shrineShots = 0;
  let crumple = false;
  let chapter: ReturnType<typeof phase1Winner> = null;
  let oasisStart = 0;

  for (let i = 0; i < MAX_TICKS && st.phase !== 'ended'; i++) {
    const inputs: PlayerInput[] = [];
    for (const p of [0, 1] as const) {
      const action = bots[p].think(st);
      if (action) inputs.push({ seq: ++seq, player: p, tick: st.tick + 1, action });
    }
    const { events } = advanceTick(st, inputs);
    if (st.phase === 'basalt') p1Ticks = st.tick;
    if (st.phase === 'transition' && chapter === null) {
      if (p1Ticks === 0) p1Ticks = st.tick;
      chapter = phase1Winner(st);
    }
    if (st.phase === 'oasis' && oasisStart === 0) oasisStart = st.tick;
    if (oasisStart > 0) p2Ticks = st.tick - oasisStart;
    for (const e of events) {
      if (e.type === 'spellCast') {
        if (e.spell === 'sulfur') sulfur++;
        else if (e.spell === 'thicket') thicket++;
        else if (e.spell === 'lavarain') lava++;
      }
      if (e.type === 'shrineShot') shrineShots++;
      if (e.type === 'marbleDown') crumple = true;
    }
  }

  const timeout = st.phase === 'ended' && !crumple;
  const razed0 = [0, 1].map((seat) =>
    // counted from leftover? P1 wings are cleared in oasis. Use dominance + damage.
    0,
  ) as [number, number];
  void razed0;
  const winner = String(st.winner);
  const winnerFaction = winner === 'tie' || winner === 'null'
    ? 'tie'
    : factions[Number(winner) as 0 | 1];
  const ward = chapter === null ? 'none' : String(chapter);
  const wardWon = chapter === null || st.winner === 'tie' || st.winner === null
    ? null
    : st.winner === chapter;

  return {
    seed,
    factions,
    winner,
    winnerFaction,
    p1Ticks,
    p2Ticks: Math.max(0, p2Ticks),
    crumple,
    timeout,
    ward,
    wardWon,
    sulfur,
    thicket,
    lava,
    shrineShots,
    marbleDmg: [...st.marbleDamage] as [number, number],
    towerDmg: [st.players[0].damageDealt, st.players[1].damageDealt],
    razed: [0, 0],
  };
}

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pct(n: number, d: number): string {
  return d <= 0 ? '—' : `${((n / d) * 100).toFixed(1)}%`;
}

console.log(`— Vaalbara battle balance  (${MATCHES} matches, strong vs strong) —\n`);

const rows: Row[] = [];
let crashes = 0;
for (let i = 1; i <= MATCHES; i++) {
  const factions: [FactionId, FactionId] = i % 2 === 0 ? ['oasis', 'magma'] : ['magma', 'oasis'];
  try {
    rows.push(run(i * 104729, factions));
  } catch (err) {
    crashes++;
    console.error(`seed ${i * 104729} CRASHED:`, err);
  }
}

const wins = { '0': 0, '1': 0, tie: 0 };
const faction = { magma: 0, oasis: 0, tie: 0 };
let wardGames = 0;
let wardConverted = 0;
let crumples = 0;
let timeouts = 0;
for (const r of rows) {
  wins[r.winner === '0' || r.winner === '1' ? r.winner : 'tie']++;
  faction[r.winnerFaction === 'magma' || r.winnerFaction === 'oasis' ? r.winnerFaction : 'tie']++;
  if (r.crumple) crumples++;
  if (r.timeout) timeouts++;
  if (r.wardWon !== null) {
    wardGames++;
    if (r.wardWon) wardConverted++;
  }
}

const p1s = rows.map((r) => (r.p1Ticks * TICK_MS) / 1000);
const p2s = rows.filter((r) => r.p2Ticks > 0).map((r) => (r.p2Ticks * TICK_MS) / 1000);
const crumpleS = rows.filter((r) => r.crumple).map((r) => (r.p2Ticks * TICK_MS) / 1000);

console.log(`finished ${rows.length}  crashed ${crashes}`);
console.log(`win split   seat0=${wins['0']}  seat1=${wins['1']}  tie=${wins.tie}`);
console.log(`faction     magma=${faction.magma}  oasis=${faction.oasis}  tie=${faction.tie}`);
console.log(`P2 end      crumble=${crumples} (${pct(crumples, rows.length)})  timeout=${timeouts} (${pct(timeouts, rows.length)})`);
console.log(`P1 length   mean=${mean(p1s).toFixed(1)}s  min=${Math.min(...p1s).toFixed(0)}  max=${Math.max(...p1s).toFixed(0)}`);
console.log(`P2 length   mean=${mean(p2s).toFixed(1)}s  min=${p2s.length ? Math.min(...p2s).toFixed(0) : 0}  max=${p2s.length ? Math.max(...p2s).toFixed(0) : 0}`);
console.log(`crumple t   mean=${crumpleS.length ? mean(crumpleS).toFixed(1) : '—'}s  (target ~120s, cap 150s)`);
console.log(`Temple Ward converted ${wardConverted}/${wardGames} (${pct(wardConverted, wardGames)}) — prize is a veil, not a snowball`);
console.log(`spells/game sulfur=${mean(rows.map((r) => r.sulfur)).toFixed(1)}  thicket=${mean(rows.map((r) => r.thicket)).toFixed(1)}  lava=${mean(rows.map((r) => r.lava)).toFixed(1)}`);
console.log(`shrine shots/game ${mean(rows.map((r) => r.shrineShots)).toFixed(0)}`);

const suspect = rows.filter((r) =>
  r.winner === 'null' ||
  r.p1Ticks < 80 ||
  (r.p2Ticks > 0 && r.sulfur + r.thicket + r.lava === 0),
);
if (suspect.length) {
  console.log(`\n${suspect.length} suspect rows`);
  for (const r of suspect.slice(0, 8)) {
    console.log(`  seed ${r.seed} winner=${r.winner} p1=${r.p1Ticks} p2=${r.p2Ticks} spells=${r.sulfur}/${r.thicket}/${r.lava}`);
  }
}

for (const r of rows.slice(0, 8)) {
  console.log(
    `seed ${r.seed} [${r.factions[0]} vs ${r.factions[1]}] w=${r.winner.padEnd(4)} ` +
    `p1=${((r.p1Ticks * TICK_MS) / 1000).toFixed(0)}s p2=${((r.p2Ticks * TICK_MS) / 1000).toFixed(0)}s ` +
    `${r.crumple ? 'CRUMBLE' : r.timeout ? 'CLOCK' : r.winner} ` +
    `ward=${r.ward} lava=${r.lava} sulfur=${r.sulfur} thicket=${r.thicket}`,
  );
}

// Soft gates — a creative fight, not a script. Fail only on crashes / no-finish.
if (crashes > 0 || rows.some((r) => r.winner === 'null')) {
  console.error('\nBalance harness failed (crash or unfinished match).');
  process.exit(1);
}

const crumpleMean = crumpleS.length ? mean(crumpleS) : 0;
console.log('\n— tuner notes —');
console.log(`crumple mean ${crumpleMean.toFixed(1)}s  (aim 100–130; raise MARBLE_HP if <<100, lower if many timeouts)`);
console.log(`timeout share ${pct(timeouts, rows.length)}  (aim <35%)`);
console.log(`lava/game ${mean(rows.map((r) => r.lava)).toFixed(1)}  (aim ≥0.8 — the sky must get spent)`);
console.log(`faction gap ${Math.abs(faction.magma - faction.oasis)}  (aim < ~20% of matches)`);
console.log('\nBalance harness complete.');
