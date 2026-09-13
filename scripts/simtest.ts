/* ============================================================================
 * Headless simulation harness — proves the engine is deterministic, stable
 * and reasonably balanced without ever opening a browser.
 *
 *   npm run sim            # quick suite: 12 seeded matches + determinism
 * ========================================================================== */

import { BotBrain, advanceTick, createGame, oasisWinner, resetIds, shrineGuarded } from '../src/engine';
import type { CannonState, GameState, MarbleState, PlayerId, PlayerInput, UnitState } from '../src/types';
import {
  CANNON, CANNON_HP, CANNON_R, FORT_LANES, FORT_PAD_Y, FORT_SPAWN_Y, FORT_WALL_FRONT,
  HORN_BLAST, HORN_CHARGE_TICKS, HORN_POS, LAVA_RAIN_CARD, MARBLE_HP, MARBLE_POS, MARBLE_R,
  PHASE1_TICKS, PHASE2_TICKS, SHRINE, TRANSITION_TICKS,
} from '../src/types';
import { LAVA_RAIN } from '../src/data';

const MAX_TICKS = PHASE1_TICKS + TRANSITION_TICKS + PHASE2_TICKS + 5;

interface MatchStats {
  winner: string;
  ticks: number;
  unitsSpawnedP0: number;
  unitsSpawnedP1: number;
  dmgP0: number;
  dmgP1: number;
  dominanceP0: number;
  marbleDmg0: number;
  marbleDmg1: number;
  maxUnitsAlive: number;
  eventsTotal: number;
  sulfur: number;
  thicket: number;
  lava: number;
  crumple: boolean;
}

function runMatch(seed: number, factions: ['magma', 'oasis'] | ['oasis', 'magma']): MatchStats {
  resetIds();
  const st: GameState = createGame(seed, factions);
  const bots = [new BotBrain(0, seed + 1), new BotBrain(1, seed + 2)];
  let seq = 0;
  let spawned0 = 0;
  let spawned1 = 0;
  let maxAlive = 0;
  let eventsTotal = 0;
  let sulfur = 0;
  let thicket = 0;
  let lava = 0;
  let crumple = false;

  for (let i = 0; i < MAX_TICKS && st.phase !== 'ended'; i++) {
    const inputs: PlayerInput[] = [];
    for (const p of [0, 1] as const) {
      const action = bots[p].think(st);
      if (action) inputs.push({ seq: ++seq, player: p, tick: st.tick + 1, action });
    }
    const { events } = advanceTick(st, inputs);
    eventsTotal += events.length;
    for (const e of events) {
      if (e.type === 'spawn') {
        if (e.owner === 0) spawned0++;
        else spawned1++;
      }
      if (e.type === 'spellCast') {
        if (e.spell === 'sulfur') sulfur++;
        else if (e.spell === 'thicket') thicket++;
        else if (e.spell === 'lavarain') lava++;
      }
      if (e.type === 'marbleDown') crumple = true;
    }
    maxAlive = Math.max(maxAlive, st.units.length);
  }

  return {
    winner: String(st.winner),
    ticks: st.tick,
    unitsSpawnedP0: spawned0,
    unitsSpawnedP1: spawned1,
    dmgP0: Math.round(st.players[0].damageDealt),
    dmgP1: Math.round(st.players[1].damageDealt),
    dominanceP0: Math.round(st.dominanceP0 * 100) / 100,
    marbleDmg0: st.marbleDamage[0],
    marbleDmg1: st.marbleDamage[1],
    maxUnitsAlive: maxAlive,
    eventsTotal,
    sulfur,
    thicket,
    lava,
    crumple,
  };
}

/** Deterministic replay check: same seed & inputs => identical final state. */
function determinismCheck(seed: number): boolean {
  const play = (): string => {
    resetIds();
    const st = createGame(seed, ['magma', 'oasis']);
    const bots = [new BotBrain(0, seed + 1), new BotBrain(1, seed + 2)];
    let seq = 0;
    for (let i = 0; i < MAX_TICKS && st.phase !== 'ended'; i++) {
      const inputs: PlayerInput[] = [];
      for (const p of [0, 1] as const) {
        const action = bots[p].think(st);
        if (action) inputs.push({ seq: ++seq, player: p, tick: st.tick + 1, action });
      }
      advanceTick(st, inputs);
    }
    return JSON.stringify(st);
  };
  return play() === play();
}

console.log('— Vaalbara headless simulation suite —\n');

let failures = 0;

function assert(cond: boolean, msg: string): void {
  if (!cond) {
    failures++;
    console.error(`FAIL ${msg}`);
  } else {
    console.log(`OK   ${msg}`);
  }
}

function dummyUnit(partial: Pick<UnitState, 'owner' | 'x' | 'y'> & Partial<UnitState>): UnitState {
  return {
    id: partial.id ?? 9001,
    owner: partial.owner,
    species: partial.species ?? 'wolves',
    x: partial.x, y: partial.y, px: partial.x, py: partial.y,
    hp: partial.hp ?? 152, maxHp: partial.maxHp ?? 152,
    facing: 1, atkTimer: 3, traveled: 0, stompBank: 0,
    struckTargets: [], waypoint: null, stall: 0, stallRef: Infinity, unstick: 0,
    buffs: { stun: 0, slowTicks: 0, slowMult: 1, burnStacks: 0, burnTicks: 0, rangeCapTicks: 0, blessed: false, berserk: false },
    stealthed: false, action: 'idle', targetId: null, homeWing: 0,
    bridgeWarned: false,
    touchedMid: false,
    ...partial,
  };
}

console.log('scripted agency checks');
{
  resetIds();
  const st = createGame(1, ['magma', 'oasis']);
  st.players[0].aqua = 10;
  st.players[0].hand[0] = 'lion';
  const gx = FORT_LANES[0][0];
  const gy = FORT_PAD_Y[0];
  const { events: gateEv } = advanceTick(st, [{ seq: 1, player: 0, tick: 1, action: { type: 'deploy', card: 'lion', x: gx, y: gy, dirX: 0, dirY: -1 } }]);
  const spawn = gateEv.find((e) => e.type === 'spawn');
  const lion = st.units.find((u) => u.species === 'lion');
  assert(!!spawn && Math.abs(spawn.y - FORT_SPAWN_Y[0]) < 0.08, 'gate march spawns on the rear apron');
  assert(!!lion?.waypoint && Math.abs(lion.waypoint.x - gx) < 0.05, 'gate march waypoint holds the lane x');
}

{
  resetIds();
  const st = createGame(2, ['magma', 'oasis']);
  st.players[0].aqua = 10;
  st.players[0].hand[0] = 'lion';
  const x = FORT_LANES[0][0];
  const y = 11.05;
  advanceTick(st, [{ seq: 1, player: 0, tick: 1, action: { type: 'deploy', card: 'lion', x, y, dirX: 0, dirY: -1 } }]);
  const drop = st.units.find((u) => u.species === 'lion');
  assert(!!drop && drop.y < FORT_WALL_FRONT[0] + 0.25 && drop.y > 9.8, 'field drop appears on dirt, not in the tunnel');
  assert(!!drop && Math.abs(drop.y - FORT_SPAWN_Y[0]) > 2, 'field drop is not a gate spawn');
}

{
  resetIds();
  const st = createGame(3, ['magma', 'oasis']);
  st.players[0].aqua = 10;
  st.players[0].hand[0] = 'lion';
  advanceTick(st, [{ seq: 1, player: 0, tick: 1, action: { type: 'deploy', card: 'lion', x: 4.5, y: 3.0, dirX: 0, dirY: -1 } }]);
  assert(st.units.filter((u) => u.species === 'lion').length === 0, 'enemy-half drop is rejected');
}

{
  resetIds();
  const st = createGame(5, ['magma', 'oasis']);
  for (const o of st.obelisks) {
    if (o.owner === 0 && o.wing === 0) o.atkTimer = 0;
  }
  st.units.push(dummyUnit({
    owner: 1, x: 1.75, y: 9.5, hp: 400, maxHp: 400,
    buffs: { stun: 99, slowTicks: 0, slowMult: 1, burnStacks: 0, burnTicks: 0, rangeCapTicks: 0, blessed: false, berserk: false },
  }));
  const volley = advanceTick(st, []);
  const chip = st.projectiles.some((p) => p.kind === 'gate');
  assert(volley.events.some((e) => e.type === 'gateShot') && chip, 'living gate fires a chip');
  assert(volley.events.some((e) => e.type === 'bridgeThreat' && e.owner === 0), 'enemy on your bridge raises an alarm');
}

function livingMarble(owner: PlayerId, extra: Partial<MarbleState> = {}): MarbleState {
  return {
    owner,
    hp: MARBLE_HP, maxHp: MARBLE_HP,
    shield: 0, shieldMax: 0,
    x: MARBLE_POS[owner].x, y: MARBLE_POS[owner].y, r: MARBLE_R,
    atkTimer: 99,
    ...extra,
  };
}

function livingCannon(owner: PlayerId, extra: Partial<CannonState> = {}): CannonState {
  const g = CANNON[owner];
  return {
    owner,
    hp: CANNON_HP, maxHp: CANNON_HP,
    x: g.x, y: g.y, r: CANNON_R,
    atkTimer: 99,
    ...extra,
  };
}

function enterOasis(st: GameState): void {
  st.phase = 'oasis';
  st.phaseTicksLeft = 200;
  st.obelisks = [];
  st.marbles = [livingMarble(0), livingMarble(1)];
  st.cannons = [livingCannon(0), livingCannon(1)];
  st.marbleDamage = [0, 0];
  st.cannonDamage = [0, 0];
  st.cannonFellTick = [null, null];
}

{
  resetIds();
  const st = createGame(4, ['magma', 'oasis']);
  enterOasis(st);
  st.cannons[0].atkTimer = 0;
  st.units.push(dummyUnit({
    owner: 1, x: CANNON[0].x, y: CANNON[0].padY, hp: 400, maxHp: 400,
    buffs: { stun: 99, slowTicks: 0, slowMult: 1, burnStacks: 0, burnTicks: 0, rangeCapTicks: 0, blessed: false, berserk: false },
  }));
  const zonesAtLaunch = st.zones.length;
  const fired = advanceTick(st, []);
  const shot = fired.events.find((e) => e.type === 'shrineShot');
  const bolt = st.projectiles.find((p) => p.kind === 'cannon');
  assert(!!shot && !!bolt, 'living gun fires a cannon bolt');
  assert(!!shot && Math.abs(shot.x - CANNON[0].shotX) < 0.02 && Math.abs(shot.y - CANNON[0].shotY) < 0.02, 'bolt leaves the painted muzzle');
  assert(st.zones.length === zonesAtLaunch, 'cannon launch does not spawn an acid pool');
  let impact = false;
  let pooled = false;
  let landed = 0;
  for (let i = 0; i < 8; i++) {
    const { events } = advanceTick(st, []);
    if (events.some((e) => e.type === 'shrineImpact')) impact = true;
    if (st.zones.some((z) => z.kind === 'acidpool')) pooled = true;
    for (const e of events) {
      if (e.type === 'hit' && e.unitId === 9001 && e.kind === 'cannon') landed += e.amount;
    }
  }
  const victim = st.units.find((u) => u.id === 9001);
  assert(impact, 'cannon landing emits shrineImpact');
  assert(landed === 200 && !!victim && victim.hp === 200, 'cannon hits for 200 on landing');
  assert(!pooled, 'cannon landing does not leave an acid pool');
}

{
  resetIds();
  const st = createGame(6, ['magma', 'oasis']);
  enterOasis(st);
  st.players[1].aqua = 10;
  st.players[1].hand[0] = LAVA_RAIN_CARD;
  const keepHp = st.marbles[0].hp;
  // East of the keep, outside the gun's rain rim, still on the shrine mass.
  advanceTick(st, [{
    seq: 1, player: 1, tick: 1,
    action: { type: 'spell', card: LAVA_RAIN_CARD, x: 5.7, y: 12.55 },
  }]);
  for (let i = 0; i < 6; i++) advanceTick(st, []);
  assert(st.marbles[0].hp === keepHp, 'Lava Rain on the keep deals 0 while the gun lives');
  assert(shrineGuarded(st, 0), 'south shrine stays guarded');
}

{
  resetIds();
  const st = createGame(7, ['magma', 'oasis']);
  enterOasis(st);
  st.players[1].aqua = 10;
  st.players[1].hand[0] = LAVA_RAIN_CARD;
  const keepHp = st.marbles[0].hp;
  advanceTick(st, [{
    seq: 1, player: 1, tick: 1,
    action: { type: 'spell', card: LAVA_RAIN_CARD, x: CANNON[0].x, y: CANNON[0].y },
  }]);
  for (let i = 0; i < 6; i++) advanceTick(st, []);
  const expected = Math.round(LAVA_RAIN.centerDmg * LAVA_RAIN.buildingPct);
  assert(st.cannons[0].hp === CANNON_HP - expected, 'Lava Rain chips the gun at building pct');
  assert(st.marbles[0].hp === keepHp, 'rain on the gun does not scratch the guarded shrine');
}

{
  resetIds();
  const st = createGame(8, ['magma', 'oasis']);
  enterOasis(st);
  const keepHp = st.marbles[0].hp;
  st.units.push(dummyUnit({
    owner: 1, species: 'lion', x: SHRINE[0].doorX, y: SHRINE[0].doorY, hp: 400, maxHp: 400,
  }));
  for (let i = 0; i < 6; i++) advanceTick(st, []);
  assert(st.marbles[0].hp === keepHp, 'melee on the door deals 0 while the gun lives');
  assert(st.cannons[0].hp < CANNON_HP || st.units.some((u) => u.owner === 1 && u.waypoint), 'siege walks the gun, not the stone');
}

{
  resetIds();
  const st = createGame(9, ['magma', 'oasis']);
  enterOasis(st);
  st.cannons[0].hp = 0;
  st.cannonFellTick[0] = 1;
  assert(!shrineGuarded(st, 0), 'toppled gun exposes the shrine');
  st.units.push(dummyUnit({
    id: 9101, owner: 1, species: 'lion', x: SHRINE[0].doorX, y: SHRINE[0].doorY, hp: 400, maxHp: 400, atkTimer: 0,
  }));
  let hit = false;
  for (let i = 0; i < 8; i++) {
    const { events } = advanceTick(st, []);
    if (events.some((e) => e.type === 'marbleHit' && e.owner === 0)) hit = true;
  }
  assert(hit && st.marbles[0].hp < MARBLE_HP, 'after the gun falls the shrine takes siege hits');
}

{
  resetIds();
  const st = createGame(10, ['magma', 'oasis']);
  enterOasis(st);
  st.units.push(dummyUnit({
    owner: 0, species: 'lion', x: 6.55, y: 6.15, hp: 240, maxHp: 240,
  }));
  for (let i = 0; i < 12; i++) advanceTick(st, []);
  const walker = st.units.find((u) => u.owner === 0);
  const pad = CANNON[1];
  const door = SHRINE[1];
  assert(!!walker, 'oasis walker is alive');
  if (walker) {
    const dPad = Math.hypot(walker.x - pad.padX, walker.y - pad.padY);
    const dDoor = Math.hypot(walker.x - door.doorX, walker.y - door.doorY);
    assert(dPad + 0.35 < dDoor, 'units hard-walk the enemy cannon pad, not the shrine door');
    assert(walker.x > 6.2, 'the march stays on the temple-right gun, not the temple door');
  }
}

{
  resetIds();
  const st = createGame(11, ['magma', 'oasis']);
  enterOasis(st);
  st.cannons[1].hp = 1;
  const pad = CANNON[1];
  st.units.push(dummyUnit({
    id: 9201, owner: 0, species: 'lion', x: pad.padX, y: pad.padY, hp: 240, maxHp: 240, atkTimer: 0,
  }));
  let toppled = false;
  for (let i = 0; i < 4; i++) {
    const { events } = advanceTick(st, []);
    if (events.some((e) => e.type === 'cannonDown' && e.owner === 1)) toppled = true;
  }
  assert(toppled && st.cannons[1].hp <= 0, 'pad siege topples the gun');
  st.units.push(dummyUnit({
    id: 9202, owner: 1, species: 'lion', x: pad.x - 0.4, y: pad.y, hp: 240, maxHp: 240,
  }));
  for (let i = 0; i < 5; i++) advanceTick(st, []);
  const attacker = st.units.find((u) => u.id === 9201);
  const defender = st.units.find((u) => u.id === 9202);
  assert(!!attacker && !!defender, 'both pad fighters still live');
  const dDoor = attacker ? Math.hypot(attacker.x - SHRINE[1].doorX, attacker.y - SHRINE[1].doorY) : 99;
  const dFoe = attacker && defender ? Math.hypot(attacker.x - defender.x, attacker.y - defender.y) : 99;
  assert(dFoe < dDoor, 'after topple they finish the pad brawl instead of peeling to the door');
}

{
  resetIds();
  const st = createGame(14, ['magma', 'oasis']);
  enterOasis(st);
  st.cannons[1].hp = 0;
  st.cannonFellTick[1] = 1;
  const pad = CANNON[1];
  const door = SHRINE[1];
  st.units.push(dummyUnit({
    owner: 0, species: 'eagle', x: 6.55, y: 6.80, hp: 108, maxHp: 108,
    waypoint: { x: pad.padX, y: pad.padY },
  }));
  for (let i = 0; i < 16; i++) advanceTick(st, []);
  const walker = st.units.find((u) => u.owner === 0);
  assert(!!walker, 'door march walker is alive');
  if (walker) {
    const dPad = Math.hypot(walker.x - pad.padX, walker.y - pad.padY);
    const dDoor = Math.hypot(walker.x - door.doorX, walker.y - door.doorY);
    assert(walker.x < 6.2, 'turns west toward the temple, not east to the empty gun');
    assert(dDoor + 0.25 < dPad, 'after topple with no pad fight, a leftover pad waypoint walks the shrine door');
  }
}

{
  resetIds();
  const st = createGame(12, ['magma', 'oasis']);
  enterOasis(st);
  st.marbleDamage = [0, 0];
  st.cannonDamage = [180, 40];
  st.cannonFellTick = [null, 40];
  assert(oasisWinner(st) === 0, 'untouched stone: more cannon damage wins the clock');
  st.cannonDamage = [100, 100];
  st.cannonFellTick = [80, 40];
  assert(oasisWinner(st) === 0, 'equal cannon damage: who toppled first wins');
  st.marbles[1].hp = MARBLE_HP - 50;
  st.marbleDamage = [50, 0];
  st.cannonDamage = [0, 500];
  assert(oasisWinner(st) === 0, 'shrine damage still beats cannon damage');
}

{
  resetIds();
  const st = createGame(13, ['magma', 'oasis']);
  enterOasis(st);
  st.cannons[0].hp = 20;
  st.units.push(dummyUnit({
    owner: 1, species: 'lion', x: CANNON[0].padX, y: CANNON[0].padY, hp: 400, maxHp: 400, atkTimer: 0,
  }));
  let down = false;
  for (let i = 0; i < 6; i++) {
    const { events } = advanceTick(st, []);
    if (events.some((e) => e.type === 'cannonDown' && e.owner === 0)) down = true;
  }
  assert(down && st.cannons[0].hp <= 0, 'cannonDown fires when the gun topples');
  assert(st.winner == null && st.phase === 'oasis', 'toppling a gun does not end the match');
  assert(st.cannonDamage[1] >= 35, 'melee on the gun deals raw unit damage');
}

{
  resetIds();
  const st = createGame(21, ['magma', 'oasis']);
  st.units.push(dummyUnit({
    owner: 0, species: 'lion', x: HORN_POS.x, y: HORN_POS.y, hp: 400, maxHp: 400,
    waypoint: { x: HORN_POS.x, y: HORN_POS.y },
  }));
  const startHp = st.obelisks.filter((o) => o.owner === 1).reduce((s, o) => s + o.hp, 0);
  let shouts = 0;
  for (let i = 0; i < HORN_CHARGE_TICKS + 3; i++) {
    const { events } = advanceTick(st, []);
    shouts += events.filter((e) => e.type === 'hornShout' && e.owner === 0).length;
  }
  const endHp = st.obelisks.filter((o) => o.owner === 1).reduce((s, o) => s + o.hp, 0);
  assert(shouts === 1, 'exclusive Horn hold fires one shout');
  assert(st.hornShots[0] === 1, 'shout consumes one of two charges');
  assert(startHp - endHp === HORN_BLAST, 'shout deals HORN_BLAST to the weaker wing');
}

{
  resetIds();
  const st = createGame(22, ['magma', 'oasis']);
  const frozen = {
    stun: 40, slowTicks: 0, slowMult: 1, burnStacks: 0, burnTicks: 0,
    rangeCapTicks: 0, blessed: false, berserk: false,
  };
  st.units.push(dummyUnit({
    id: 9001, owner: 0, species: 'lion', x: 4.3, y: 7.5, hp: 400, maxHp: 400, buffs: { ...frozen },
  }));
  st.units.push(dummyUnit({
    id: 9002, owner: 1, species: 'bear', x: 4.7, y: 7.5, hp: 400, maxHp: 400, buffs: { ...frozen },
  }));
  let shouts = 0;
  for (let i = 0; i < 20; i++) {
    const { events } = advanceTick(st, []);
    shouts += events.filter((e) => e.type === 'hornShout').length;
  }
  assert(shouts === 0 && st.hornCharge[0] === 0 && st.hornCharge[1] === 0, 'tied Horn ring makes no progress');
}

{
  resetIds();
  const st = createGame(23, ['magma', 'oasis']);
  const lane = st.obelisks.find((o) => o.owner === 1 && o.wing === 0)!;
  lane.hp = 0;
  st.hornShots[0] = 2;
  const u = dummyUnit({
    owner: 0, species: 'lion',
    x: lane.x, y: FORT_WALL_FRONT[1] + 0.55,
    hp: 400, maxHp: 400, touchedMid: false,
  });
  st.units.push(u);
  const startY = u.y;
  for (let i = 0; i < 10; i++) advanceTick(st, []);
  assert(u.y > startY + 0.35, 'leftover walks the mid plateau toward The Horn');
  assert(u.y < FORT_WALL_FRONT[0] - 1, 'leftover does not skip mid for the far gate');
}

console.log('');
const wins: Record<string, number> = { '0': 0, '1': 0, tie: 0 };
const factionWins: Record<string, number> = { magma: 0, oasis: 0, tie: 0 };

for (let s = 1; s <= 24; s++) {
  const factions = s % 2 === 0 ? (['oasis', 'magma'] as const) : (['magma', 'oasis'] as const);
  try {
    const r = runMatch(s * 7919, [...factions] as ['magma', 'oasis'] | ['oasis', 'magma']);
    wins[r.winner] = (wins[r.winner] ?? 0) + 1;
    factionWins[r.winner === 'tie' ? 'tie' : factions[Number(r.winner) as 0 | 1]]++;
    // Matches can now end early (obelisk break, decisive pond claim), so the
    // floor is "a real fight happened", not "full timer elapsed".
    const ok =
      r.ticks >= 120 &&
      r.unitsSpawnedP0 > 5 &&
      r.unitsSpawnedP1 > 5 &&
      r.dmgP0 > 100 &&
      r.dmgP1 > 100 &&
      r.winner !== 'null';
    if (!ok) failures++;
    console.log(
      `seed ${String(s * 7919).padStart(6)} [${factions[0]} vs ${factions[1]}]  winner=${r.winner.padEnd(4)} ` +
      `ticks=${r.ticks} spawns=${r.unitsSpawnedP0}/${r.unitsSpawnedP1} dmg=${r.dmgP0}/${r.dmgP1} ` +
      `dom0=${r.dominanceP0} marble=${r.marbleDmg0}/${r.marbleDmg1} ` +
      `spells=${r.sulfur}/${r.thicket}/${r.lava}${r.crumple ? ' CRUMBLE' : ''} ` +
      `maxAlive=${r.maxUnitsAlive} ${ok ? 'OK' : '** SUSPECT **'}`,
    );
  } catch (err) {
    failures++;
    console.error(`seed ${s * 7919} CRASHED:`, err);
  }
}

console.log(`\nwin split  seat0=${wins['0']}  seat1=${wins['1']}  tie=${wins['tie']}`);
console.log(`faction split  magma=${factionWins.magma}  oasis=${factionWins.oasis}  tie=${factionWins.tie}`);

const det = determinismCheck(424242);
console.log(`determinism check: ${det ? 'PASS' : 'FAIL'}`);
if (!det) failures++;

// Perf: a full match should simulate far faster than real time.
const t0 = performance.now();
runMatch(31337, ['magma', 'oasis']);
const ms = performance.now() - t0;
console.log(`full-match sim time: ${ms.toFixed(1)} ms ${ms < 2000 ? '(PASS)' : '(SLOW)'}`);
if (ms >= 2000) failures++;

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll checks passed.');
