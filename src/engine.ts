/* ============================================================================
 * VAALBARA: THE LAST OASIS — engine.ts
 * Headless, deterministic simulation over a CONTINUOUS world.
 *
 *  - Positions are floats in the 9 x 15 world. Terrain collision comes from
 *    navmask.ts (baked from the arena paintings): ground units steer along
 *    the dark basalt paths and can never cross painted lava; flyers ignore
 *    all of it.
 *  - Movement = corridor routing (coarse BFS over the navmask) + straight
 *    steering + wall sliding + soft unit-vs-unit separation, evaluated in
 *    deterministic id order. No wall-clock time, no Math.random.
 *  - Inputs are queued asynchronously and execute on a future tick; the
 *    TickDriver below owns real-time pacing and rewind/replay reconciliation.
 * ========================================================================== */

import {
  ACID_DMG, AGGRO_RANGE, AQUA_MAX, AQUA_START, AQUA_PER_TICK_P1, AQUA_PER_TICK_P1_LATE, AQUA_PER_TICK_P2,
  AQUA_P1_LATE_TICKS, BLESSING_MULT, GATE_SHOT_DMG, GATE_SHOT_INTERVAL, GATE_SHOT_RANGE, GATE_SHOT_SPEED,
  GATE_SHOT_SPLASH,
  BRIDGE_HALF_W, FORT_ARCH_HALF_W, FORT_LANES, FORT_SPAWN_Y,
  FORT_WALL_FRONT, FORT_WING_R, FORT_WING_Y,
  HAND_SIZE, LANE_SOFT_CAP, LOTUS_HEAL_PCT, OBELISK_HP,
  CANNON, CANNON_HP, CANNON_R,
  MARBLE_HP, MARBLE_POS, MARBLE_R, MARBLE_SHIELD_PCT, MARBLE_SHOT_DMG,
  MARBLE_CANNON_SPEED, MARBLE_CANNON_SPLASH,
  MARBLE_SHOT_INTERVAL, MARBLE_SHOT_RANGE, PHASE1_TICKS, PHASE2_TICKS,
  SHRINE,
  RUBBLE_VISIBLE_DEPTH, RIVER_BANDS, TICK_MS, TRANSITION_TICKS, VENT_DMG,
  WORLD_H, WORLD_W, armyCap, fortPads, inOwnHalf, inWorld,
  inBasaltDefendZone, isGateMarchTap, basaltDefendAnchor,
} from './types';
import type {
  BotStrength, CannonState, CardId, FactionId, GameEvent, GameState, MarbleState, ObeliskState, PhaseConfig, PlayerId,
  PlayerInput, PropState, TickResult, UnitState, UnitStats, Vec2,
} from './types';
import { LAVA_RAIN, MECHANICS, SPELL_BALANCE, buildDeck, cardDef, speciesDef } from './data';
import { LAVA_RAIN_CARD, PHASE_SPELL_CARD } from './types';
import { CELL, cellAt, isWater, nextCorridor, walkableAt } from './navmask';
import type { WorldId } from './navmask';

/* ------------------------------------------------------------------------ */
/* Deterministic PRNG                                                         */
/* ------------------------------------------------------------------------ */

function makeRng(seed: number) {
  let s = seed >>> 0 || 0x9e3779b9;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 0xffffffff;
  };
}

const dist2 = (ax: number, ay: number, bx: number, by: number) => {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
};
const dist = (ax: number, ay: number, bx: number, by: number) => Math.sqrt(dist2(ax, ay, bx, by));

export function worldOf(st: GameState): WorldId {
  return st.phase === 'oasis' || st.phase === 'ended' ? 'oasis' : 'basalt';
}

/* ------------------------------------------------------------------------ */
/* Authored props — placed to match the arena paintings                       */
/* ------------------------------------------------------------------------ */

function basaltProps(): PropState[] {
  // Sulfur vents sit by the painting's smoking fissures near the flanks.
  return [
    { kind: 'vent', x: 0.9, y: 4.4, r: 0.6, destroyed: false },
    { kind: 'vent', x: 8.1, y: 4.6, r: 0.6, destroyed: false },
    { kind: 'vent', x: 0.9, y: 10.6, r: 0.6, destroyed: false },
    { kind: 'vent', x: 8.1, y: 10.4, r: 0.6, destroyed: false },
  ];
}

/** The Phase-1 objectives: each seat's fortress fields TWO gatehouse wings,
 *  one per lane. A wing crumbles at zero; the Basalt Fields end only when a
 *  fortress has lost both. */
function makeObelisks(): ObeliskState[] {
  const wings: ObeliskState[] = [];
  for (const owner of [0, 1] as const) {
    FORT_LANES[owner].forEach((x, wing) => {
      wings.push({
        owner, wing: wing as 0 | 1,
        hp: OBELISK_HP, maxHp: OBELISK_HP,
        x, y: FORT_WING_Y[owner], r: FORT_WING_R,
        atkTimer: 2,
      });
    });
  }
  return wings;
}

function makeMarbles(winner: PlayerId | null): MarbleState[] {
  return ([0, 1] as const).map((owner) => {
    const pos = MARBLE_POS[owner];
    const ward = winner === owner;
    const shield = ward ? Math.round(MARBLE_HP * MARBLE_SHIELD_PCT) : 0;
    return {
      owner,
      hp: MARBLE_HP,
      maxHp: MARBLE_HP,
      shield,
      shieldMax: shield,
      x: pos.x,
      y: pos.y,
      r: MARBLE_R,
      atkTimer: 1,
    };
  });
}

/** Phase 1 chapter score: more crumbled enemy wings, else more tower damage. */
export function phase1Winner(st: GameState): PlayerId | null {
  const razed = (attacker: PlayerId) =>
    st.obelisks.filter((o) => o.owner !== attacker && o.hp <= 0).length;
  const a = razed(0);
  const b = razed(1);
  if (a > b) return 0;
  if (b > a) return 1;
  const dmgOn = (owner: PlayerId) =>
    st.obelisks.filter((o) => o.owner === owner)
      .reduce((s, o) => s + (o.maxHp - Math.max(0, o.hp)), 0);
  const d0 = dmgOn(1);
  const d1 = dmgOn(0);
  if (d0 > d1) return 0;
  if (d1 > d0) return 1;
  return null;
}

/** The new Oasis painting already has reeds and lotuses in the oil.
 *  Extra authored props would sit on top of that art. */
function oasisProps(): PropState[] {
  return [];
}

/** Pond-facing door of a shrine — where a siege stands, not inside the stone. */
function shrineDoor(owner: PlayerId): Vec2 {
  return { x: SHRINE[owner].doorX, y: SHRINE[owner].doorY };
}

/** Pond-facing lip of a gun pad — walk here, not through the carriage. */
function cannonPad(owner: PlayerId): Vec2 {
  return { x: CANNON[owner].padX, y: CANNON[owner].padY };
}

function cannonOf(st: GameState, owner: PlayerId): CannonState | undefined {
  return st.cannons.find((c) => c.owner === owner);
}

/** The shrine cannot take a scratch while its gun still lives. */
export function shrineGuarded(st: GameState, owner: PlayerId): boolean {
  const c = cannonOf(st, owner);
  return !!c && c.hp > 0;
}

function makeCannons(): CannonState[] {
  return ([0, 1] as const).map((owner) => {
    const pos = CANNON[owner];
    return {
      owner,
      hp: CANNON_HP,
      maxHp: CANNON_HP,
      x: pos.x,
      y: pos.y,
      r: CANNON_R,
      atkTimer: 1,
    };
  });
}

/** Survivors re-enter on the camera-side grass, flanking their own shrine
 *  so they never spawn inside the keep / temple mass. */
function oasisReentry(owner: PlayerId, lane: number): Vec2 {
  const left = lane % 2 === 0;
  const slot = Math.floor(lane / 2) % 3;
  const x = left ? 1.22 + slot * 0.82 : 7.78 - slot * 0.82;
  const y = owner === 0
    ? 13.52 - Math.floor(lane / 6) * 0.32
    : 1.48 + Math.floor(lane / 6) * 0.32;
  return { x, y };
}

/* ------------------------------------------------------------------------ */
/* Initial state                                                              */
/* ------------------------------------------------------------------------ */

export function createGame(
  seed: number,
  factions: [FactionId, FactionId],
  cfg: PhaseConfig = { phase1Ticks: PHASE1_TICKS, phase2Ticks: PHASE2_TICKS },
): GameState {
  const rng = makeRng(seed);
  const makePlayer = (faction: FactionId) => {
    const deck = buildDeck(faction);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return {
      faction,
      aqua: AQUA_START,
      hand: deck.slice(0, HAND_SIZE),
      queue: deck.slice(HAND_SIZE),
      damageDealt: 0,
      territoryScore: 0,
      blessed: false,
    };
  };
  return {
    seed,
    cfg,
    tick: 0,
    phase: 'basalt',
    phaseTicksLeft: cfg.phase1Ticks,
    units: [],
    projectiles: [],
    zones: [],
    props: basaltProps(),
    obelisks: makeObelisks(),
    marbles: [],
    cannons: [],
    pendingLava: [],
    players: [makePlayer(factions[0]), makePlayer(factions[1])],
    captureMeter: 0,
    marbleDamage: [0, 0],
    cannonDamage: [0, 0],
    cannonFellTick: [null, null],
    winner: null,
    dominanceP0: 0.5,
  };
}

/* ------------------------------------------------------------------------ */
/* Small helpers                                                              */
/* ------------------------------------------------------------------------ */

let nextUnitId = 1;
let nextZoneId = 1;
let nextProjId = 1;
export function resetIds(): void {
  nextUnitId = 1;
  nextZoneId = 1;
  nextProjId = 1;
}

interface RuntimeUnit extends UnitState {
  stats: UnitStats;
}

function rt(u: UnitState): RuntimeUnit {
  return Object.assign(u, { stats: speciesDef(u.species).stats! });
}

export function armySize(st: GameState, owner: PlayerId): number {
  return st.units.reduce((n, u) => n + (u.hp > 0 && u.owner === owner ? 1 : 0), 0);
}

/** Current deploy ceiling for this match state (staged 6→7→8 in Basalt). */
export function currentArmyCap(st: GameState): number {
  const elapsed = st.phase === 'basalt'
    ? Math.max(0, (st.cfg.phase1Ticks - st.phaseTicksLeft) * (TICK_MS / 1000))
    : 0;
  return armyCap(st.phase, elapsed);
}

/** Which gate lane (0/1) a world x is closer to for this owner. */
function laneWingOf(owner: PlayerId, x: number): 0 | 1 {
  const lanes = FORT_LANES[owner];
  return Math.abs(x - lanes[0]) < Math.abs(x - lanes[1]) ? 0 : 1;
}

/** Living ground units this owner has committed to a gate lane. */
export function laneGroundCount(st: GameState, owner: PlayerId, wing: 0 | 1): number {
  return st.units.reduce((n, u) => {
    if (u.hp <= 0 || u.owner !== owner) return n;
    if (speciesDef(u.species).stats!.flying) return n;
    return n + (u.homeWing === wing ? 1 : 0);
  }, 0);
}

/**
 * Pick a deploy gate: honour the player's tap when the lane has room for
 * `need` ground bodies; otherwise snap to the emptier corridor. Returns null
 * when neither lane can fit the card without breaking the soft cap.
 * Flyers ignore the soft cap (they don't clog the bridge deck).
 */
export function preferDeployLane(
  st: GameState, owner: PlayerId, preferredWing: 0 | 1, flying: boolean, need = 1,
): 0 | 1 | null {
  if (flying) return preferredWing;
  const other = (1 - preferredWing) as 0 | 1;
  const room = (wing: 0 | 1) => laneGroundCount(st, owner, wing) + need <= LANE_SOFT_CAP;
  if (room(preferredWing)) return preferredWing;
  if (room(other)) return other;
  return null;
}

/** Enemy on our home bridge / bank — the bot should field-drop, not tunnel. */
function homeBridgeThreat(st: GameState, seat: PlayerId): 0 | 1 | null {
  const river = RIVER_BANDS[seat];
  const lanes = FORT_LANES[seat];
  let bestWing: 0 | 1 | null = null;
  let bestScore = 0;
  for (const u of st.units) {
    if (u.hp <= 0 || u.owner === seat) continue;
    if (!inBasaltDefendZone(seat, u.y) && !(
      u.y >= river.y0 - 0.35 && u.y <= river.y1 + 0.55
    )) continue;
    const wing: 0 | 1 = Math.abs(u.x - lanes[0]) < Math.abs(u.x - lanes[1]) ? 0 : 1;
    const nearLane = Math.abs(u.x - lanes[wing]) <= 1.5;
    const onBridge = u.y >= river.y0 - 0.4 && u.y <= river.y1 + 0.65;
    if (!nearLane && !onBridge) continue;
    const onHomeApproach = seat === 0 ? u.y >= river.y0 - 1.15 : u.y <= river.y1 + 1.15;
    if (!onHomeApproach) continue;
    const score = (onBridge ? 2.2 : 1) + (speciesDef(u.species).stats!.heavy ? 0.6 : 0);
    if (score > bestScore) {
      bestScore = score;
      bestWing = wing;
    }
  }
  return bestWing;
}

function groundOpen(st: GameState, x: number, y: number): boolean {
  return inWorld(x, y) && walkableAt(worldOf(st), x, y);
}

/** Snap a Phase-1 field drop onto walkable dirt in the defend zone. */
export function snapBasaltFieldDrop(
  st: GameState, player: PlayerId, x: number, y: number, flying: boolean,
): { x: number; y: number } | null {
  const ok = (sx: number, sy: number) =>
    inWorld(sx, sy) && inBasaltDefendZone(player, sy) && (flying || groundOpen(st, sx, sy));
  if (ok(x, y)) return { x, y };
  for (let r = 0.25; r <= 1.6; r += 0.25) {
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]] as const) {
      if (ok(x + dx, y + dy)) return { x: x + dx, y: y + dy };
    }
  }
  return null;
}

/** Short step from a field drop toward the nearest threat (or your bridge). */
function fieldDropWaypoint(st: GameState, player: PlayerId, sx: number, sy: number): Vec2 {
  let threat: UnitState | null = null;
  let best = Infinity;
  for (const u of st.units) {
    if (u.hp <= 0 || u.owner === player) continue;
    const d = dist2(u.x, u.y, sx, sy);
    if (d < best) {
      best = d;
      threat = u;
    }
  }
  const dirY = player === 0 ? -1 : 1;
  if (threat) {
    const d = Math.max(0.001, dist(sx, sy, threat.x, threat.y));
    const step = Math.min(2.15, d * 0.55);
    return {
      x: Math.max(0.4, Math.min(WORLD_W - 0.4, sx + ((threat.x - sx) / d) * step)),
      y: Math.max(0.4, Math.min(WORLD_H - 0.4, sy + ((threat.y - sy) / d) * step)),
    };
  }
  const lanes = FORT_LANES[player];
  const lx = Math.abs(sx - lanes[0]) < Math.abs(sx - lanes[1]) ? lanes[0] : lanes[1];
  return { x: lx, y: sy + dirY * 1.55 };
}

/** Global march pace. The plodding gait animation reads the ACTUAL speed,
 *  so a small lift here quickens the stride without breaking foot contact. */
/** Basalt stride. A mid unit should reach the far river in ~10–12 s so
 *  the walk is a fuse, not a commute. Oasis keeps the older gait. */
const BASALT_MARCH = 1.50;
const OASIS_MARCH = 1.20;

/** Is this ground position on a collapsed gatehouse's rubble mound? Razed
 *  lanes stay open, but crossing the debris is a scramble, not a march. */
export function onRubble(st: GameState, x: number, y: number): boolean {
  if (st.obelisks.length === 0) return false;
  const owner = y > FORT_WALL_FRONT[0] ? 0 : y < FORT_WALL_FRONT[1] ? 1 : null;
  if (owner === null) return false;
  const lanes = FORT_LANES[owner];
  const wing = Math.abs(x - lanes[0]) < Math.abs(x - lanes[1]) ? 0 : 1;
  const gate = st.obelisks.find((o) => o.owner === owner && o.wing === wing);
  if (!gate || gate.hp > 0) return false;
  const depth = owner === 0
    ? (y - FORT_WALL_FRONT[0]) / (FORT_SPAWN_Y[0] - FORT_WALL_FRONT[0])
    : (FORT_WALL_FRONT[1] - y) / (FORT_WALL_FRONT[1] - FORT_SPAWN_Y[1]);
  // Rear apron is open walking ground. The rubble starts after a couple of
  // steps and continues to the field-side wall lip.
  return depth >= 0 && depth <= 0.72;
}

function effSpeed(st: GameState, u: RuntimeUnit): number {
  let s = u.stats.speed * (st.phase === 'basalt' ? BASALT_MARCH : OASIS_MARCH);
  if (u.buffs.blessed) s *= BLESSING_MULT;
  if (u.buffs.slowTicks > 0 && !u.buffs.berserk) s *= u.buffs.slowMult;
  // Pond drag: enough to feel the water, not enough to die on the wade.
  // 0.6 * shrine 28 left a T-Rex dead 5 units short of the stone.
  if (!u.stats.flying && u.stats.heavy && isWater(worldOf(st), u.x, u.y)) s *= 0.9;
  // Clambering over a razed gate's debris: slow, deliberate scramble.
  if (!u.stats.flying && onRubble(st, u.x, u.y)) s *= 0.55;
  return s;
}

function effDmg(u: RuntimeUnit, st: GameState): number {
  let d = u.stats.dmg;
  if (u.buffs.blessed) d *= BLESSING_MULT;
  if (u.species === 'wolves') {
    const buddy = st.units.some((o) =>
      o.hp > 0 && o.id !== u.id && o.owner === u.owner && o.species === 'wolves' &&
      dist2(o.x, o.y, u.x, u.y) <= MECHANICS.wolvesAdjacencyRadius ** 2);
    if (buddy) d *= 1 + MECHANICS.wolvesAdjacencyBonus;
  }
  return Math.round(d);
}

function inStealthCover(st: GameState, u: UnitState): boolean {
  if (speciesDef(u.species).stats!.flying) return false;
  const reeds = st.props.some((p) => p.kind === 'reeds' && dist2(p.x, p.y, u.x, u.y) <= p.r * p.r);
  const thicket = st.zones.some((z) =>
    z.kind === 'thicket' && z.owner === u.owner && dist2(z.x, z.y, u.x, u.y) <= z.r * z.r);
  return reeds || thicket;
}

/* ------------------------------------------------------------------------ */
/* Damage pipeline                                                            */
/* ------------------------------------------------------------------------ */

function dealDamage(
  st: GameState, ev: GameEvent[],
  attacker: RuntimeUnit | null, victim: UnitState, amount: number,
  kind: 'melee' | 'ranged' | 'burn' | 'vent' | 'lava' | 'reflect' | 'stomp' | 'cannon',
): void {
  // HP is discrete — round at the boundary so multipliers (charge, bless,
  // splash) never leak fractional chips into state or floating combat text.
  amount = Math.round(amount);
  if (victim.hp <= 0 || amount <= 0) return;
  const vStats = speciesDef(victim.species).stats!;
  victim.hp -= amount;
  if (attacker) st.players[attacker.owner].damageDealt += amount;
  ev.push({ type: 'hit', unitId: victim.id, x: victim.x, y: victim.y, amount, kind });

  if (kind === 'melee' && attacker && vStats.reflectPct > 0 && attacker.hp > 0) {
    const back = Math.round(amount * vStats.reflectPct);
    if (back > 0) {
      attacker.hp -= back;
      ev.push({ type: 'hit', unitId: attacker.id, x: attacker.x, y: attacker.y, amount: back, kind: 'reflect' });
      if (attacker.hp <= 0) {
        ev.push({ type: 'death', unitId: attacker.id, species: attacker.species, owner: attacker.owner, x: attacker.x, y: attacker.y });
      }
    }
  }
  if (attacker && (kind === 'melee' || kind === 'ranged')) attacker.stealthed = false;
  victim.stealthed = false;

  if (victim.hp <= 0) {
    ev.push({ type: 'death', unitId: victim.id, species: victim.species, owner: victim.owner, x: victim.x, y: victim.y });
  }
}

/* ------------------------------------------------------------------------ */
/* Spawning                                                                   */
/* ------------------------------------------------------------------------ */

function freshBuffs() {
  return { stun: 0, slowTicks: 0, slowMult: 1, burnStacks: 0, burnTicks: 0, rangeCapTicks: 0, blessed: false, berserk: false };
}

function spawnUnit(
  st: GameState, ev: GameEvent[], owner: PlayerId, species: UnitState['species'],
  x: number, y: number, waypoint: Vec2 | null, homeWing: 0 | 1,
): UnitState | null {
  if (!inWorld(x, y)) return null;
  if (armySize(st, owner) >= currentArmyCap(st)) return null;
  const stats = speciesDef(species).stats!;
  if (!stats.flying && !groundOpen(st, x, y)) return null;
  const u: UnitState = {
    id: nextUnitId++,
    owner, species,
    x, y, px: x, py: y,
    hp: stats.hp, maxHp: stats.hp,
    facing: owner === 0 ? -1 : 1,
    atkTimer: 3,
    traveled: 0,
    stompBank: 0,
    struckTargets: [],
    waypoint,
    stall: 0,
    stallRef: Infinity,
    unstick: 0,
    buffs: freshBuffs(),
    stealthed: false,
    action: 'spawn',
    targetId: null,
    homeWing,
    bridgeWarned: false,
  };
  // Temple Ward is a marble veil, not a unit buff. Do not snowball combat.
  st.units.push(u);
  ev.push({ type: 'spawn', unitId: u.id, species, owner, x, y });
  return u;
}

/** Lion roar: freeze nearby enemies on deployment. */
function lionRoar(st: GameState, ev: GameEvent[], lion: UnitState): void {
  ev.push({ type: 'roar', species: 'lion', x: lion.x, y: lion.y });
  for (const o of st.units) {
    if (o.hp <= 0 || o.owner === lion.owner) continue;
    if (dist2(o.x, o.y, lion.x, lion.y) <= MECHANICS.lionRoarRadius ** 2) {
      const os = speciesDef(o.species).stats!;
      const berserk = o.species === 'honeybadger' && o.hp / os.hp < MECHANICS.badgerThreshold;
      if (!berserk) o.buffs.stun = Math.max(o.buffs.stun, MECHANICS.lionFreezeTicks);
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Input application (start of tick)                                          */
/* ------------------------------------------------------------------------ */

function applyInput(st: GameState, ev: GameEvent[], input: PlayerInput): void {
  const p = st.players[input.player];
  const a = input.action;

  if (a.type === 'spell') {
    const handIdx = p.hand.indexOf(a.card);
    if (handIdx === -1) return;
    const def = cardDef(a.card, st.phase);
    if (p.aqua < def.cost) return;
    if (!inWorld(a.x, a.y)) return;

    if (a.card === LAVA_RAIN_CARD) {
      p.aqua -= def.cost;
      cycleCard(p, handIdx);
      st.pendingLava.push({
        owner: input.player, x: a.x, y: a.y,
        resolveTick: st.tick + LAVA_RAIN.telegraphTicks,
      });
      ev.push({ type: 'lavaTelegraph', x: a.x, y: a.y });
      ev.push({ type: 'spellCast', spell: 'lavarain', owner: input.player, x: a.x, y: a.y });
      return;
    }

    if (def.kind !== 'spell') return;
    const spell = def.name === 'Thicket' ? 'thicket' : 'sulfur';
    if (spell === 'thicket' && st.phase === 'oasis' && !inOwnHalf(input.player, a.y)) return;
    p.aqua -= def.cost;
    cycleCard(p, handIdx);
    const bal = SPELL_BALANCE[spell];
    st.zones.push({
      id: nextZoneId++, kind: spell, owner: input.player,
      x: a.x, y: a.y, r: bal.radius, ticksLeft: bal.duration,
    });
    ev.push({ type: 'spellCast', spell, owner: input.player, x: a.x, y: a.y });
    return;
  }

  const handIdx = p.hand.indexOf(a.card);
  if (handIdx === -1) return;
  const def = cardDef(a.card, st.phase);
  if (p.aqua < def.cost) return;

  if (a.type === 'deploy' && def.kind === 'unit' && def.species) {
    if (!inWorld(a.x, a.y)) return;
    if (armySize(st, input.player) >= currentArmyCap(st)) return;
    const stats = def.stats!;

    let sx = a.x;
    let sy = a.y;
    let wp: Vec2;
    let homeWing: 0 | 1 = laneWingOf(input.player, a.x);
    let gateMarch = false;

    if (st.phase === 'basalt') {
      if (isGateMarchTap(input.player, a.x, a.y)) {
        // Tap a gate: materialise on the rear apron and walk the whole
        // tunnel (or scramble the rubble) before emerging onto that lane.
        const pads = fortPads(input.player);
        const tapped = pads.reduce((best, cur) =>
          Math.abs(cur.x - a.x) < Math.abs(best.x - a.x) ? cur : best);
        const lanes = FORT_LANES[input.player];
        const tappedWing: 0 | 1 = Math.abs(tapped.x - lanes[0]) < Math.abs(tapped.x - lanes[1]) ? 0 : 1;
        const wing = preferDeployLane(st, input.player, tappedWing, !!stats.flying, stats.count);
        if (wing === null) return; // both ground lanes soft-full
        homeWing = wing;
        const pad = pads[wing];
        sx = pad.x;
        sy = FORT_SPAWN_Y[input.player];
        wp = {
          x: pad.x,
          y: input.player === 0 ? FORT_WALL_FRONT[0] - 0.8 : FORT_WALL_FRONT[1] + 0.8,
        };
        gateMarch = true;
      } else if (inBasaltDefendZone(input.player, a.y)) {
        // Drop on your dirt: appear on the bank / path / plateau and take
        // a short step toward the threat. No tunnel.
        const snap = snapBasaltFieldDrop(st, input.player, a.x, a.y, !!stats.flying);
        if (!snap) return;
        sx = snap.x;
        sy = snap.y;
        homeWing = laneWingOf(input.player, sx);
        wp = fieldDropWaypoint(st, input.player, sx, sy);
        if (!stats.flying) {
          for (let k = 0; k < 6 && !groundOpen(st, wp.x, wp.y); k++) {
            wp = { x: (wp.x + sx) * 0.5, y: (wp.y + sy) * 0.5 };
          }
        }
      } else {
        return;
      }
    } else {
      // Oasis: your half — sand and water. Drag is the first charge.
      if (!inOwnHalf(input.player, a.y)) return;
      // Nudge the spawn point onto open ground if the touch grazed water.
      if (!stats.flying && !groundOpen(st, sx, sy)) {
        let fixed = false;
        for (let r = 0.25; r <= 1.5 && !fixed; r += 0.25) {
          for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, r], [r, -r], [-r, -r]] as const) {
            if (inWorld(sx + dx, sy + dy) && inOwnHalf(input.player, sy + dy) && groundOpen(st, sx + dx, sy + dy)) {
              sx += dx;
              sy += dy;
              fixed = true;
              break;
            }
          }
        }
        if (!fixed) return;
      }
      homeWing = laneWingOf(input.player, sx);
      const len = Math.hypot(a.dirX, a.dirY) || 1;
      const nx = a.dirX / len;
      const ny = a.dirY / len;
      wp = {
        x: Math.max(0.4, Math.min(WORLD_W - 0.4, sx + nx * 3.5)),
        y: Math.max(0.4, Math.min(WORLD_H - 0.4, sy + ny * 3.5)),
      };
      // Pull the waypoint back along the fling until it lands on open ground.
      if (!stats.flying) {
        for (let k = 0; k < 6 && !groundOpen(st, wp.x, wp.y); k++) {
          wp = { x: wp.x - nx * 0.5, y: wp.y - ny * 0.5 };
        }
      }
    }
    p.aqua -= def.cost;
    cycleCard(p, handIdx);

    // Gate marches file through the painted arch. Field drops stay in a
    // short column toward the fight so ants don't fan into lava. Oasis
    // still fans side by side on the baseline.
    const columnFile = gateMarch;
    const fieldFile = st.phase === 'basalt' && !gateMarch;
    const stepY = input.player === 0 ? -0.55 : 0.55;
    const at = (i: number, n: number, spread: number): { x: number; y: number } =>
      columnFile
        ? { x: sx, y: sy + i * stepY }
        : fieldFile
          ? { x: sx, y: sy + i * stepY * 0.5 }
          : { x: sx + (i - (n - 1) / 2) * spread, y: sy };
    const spawned: UnitState[] = [];
    if (stats.formation === 'line' && stats.count > 1) {
      for (let i = 0; i < stats.count; i++) {
        const p2 = at(i, stats.count, 0.7);
        const u = spawnUnit(st, ev, input.player, def.species, p2.x, p2.y, wp, homeWing);
        if (u) spawned.push(u);
      }
    } else if (stats.formation === 'pair' && stats.count === 2) {
      const a1 = at(0, 2, 0.8);
      const a2 = at(1, 2, 0.8);
      const u1 = spawnUnit(st, ev, input.player, def.species, a1.x, a1.y, wp, homeWing);
      const u2 = spawnUnit(st, ev, input.player, def.species, a2.x, a2.y, wp, homeWing);
      if (u1) spawned.push(u1);
      if (u2) spawned.push(u2);
    } else {
      const u = spawnUnit(st, ev, input.player, def.species, sx, sy, wp, homeWing);
      if (u) spawned.push(u);
    }
    for (const u of spawned) if (u.species === 'lion') lionRoar(st, ev, u);
  }
}

function cycleCard(p: GameState['players'][0], handIdx: number): void {
  const played = p.hand[handIdx];
  const next = p.queue.shift();
  if (next !== undefined) {
    p.hand[handIdx] = next;
    p.queue.push(played);
  }
}

/* ------------------------------------------------------------------------ */
/* Combat visibility — no invisible warriors attack or are attacked           */
/* ------------------------------------------------------------------------ */

/** True when a warrior is visible enough to fight: on the open field, or
 *  climbing a razed gate's rubble pile / causeway in the breach lane. */
export function isCombatVisible(st: GameState, u: UnitState): boolean {
  if (st.phase !== 'basalt') return true;

  // Central battlefield between both fortress wall fronts.
  if (u.y <= FORT_WALL_FRONT[0] + 0.05 && u.y >= FORT_WALL_FRONT[1] - 0.05) return true;

  const owner: PlayerId | null =
    u.y > FORT_WALL_FRONT[0] + 0.05 ? 0 : u.y < FORT_WALL_FRONT[1] - 0.05 ? 1 : null;
  if (owner === null) return false;

  const lanes = FORT_LANES[owner];
  const wing = Math.abs(u.x - lanes[0]) < Math.abs(u.x - lanes[1]) ? 0 : 1;
  const gate = st.obelisks.find((o) => o.owner === owner && o.wing === wing);
  if (Math.abs(u.x - lanes[wing]) > FORT_ARCH_HALF_W + 0.55) return false;
  const depth = owner === 0
    ? (u.y - FORT_WALL_FRONT[0]) / (FORT_SPAWN_Y[0] - FORT_WALL_FRONT[0])
    : (FORT_WALL_FRONT[1] - u.y) / (FORT_WALL_FRONT[1] - FORT_SPAWN_Y[1]);
  if (!gate) return false;
  // A warrior at a standing arch's field mouth is already visible to nearby
  // defenders. Deep tunnel occupants remain concealed by the gatehouse —
  // but only in their OWN tunnel: an intruder inside an enemy arch can only
  // be there to batter that gate, and it is plainly visible doing so, so it
  // stays targetable at any depth. Without this, a freshly deployed defender
  // marches straight past an arch-tucked attacker chewing on its gatehouse.
  if (gate.hp > 0) return owner !== u.owner || depth <= 0.18;
  // depth=1 is the rear spawn apron; depth=0 is the field-side lip. A unit
  // becomes fightable only after it has crossed the mound and reached the
  // battlefield edge.
  return depth <= RUBBLE_VISIBLE_DEPTH;
}

/* ------------------------------------------------------------------------ */
/* Targeting                                                                  */
/* ------------------------------------------------------------------------ */

function visibleEnemies(st: GameState, u: RuntimeUnit): UnitState[] {
  return st.units.filter((o) => {
    if (o.hp <= 0 || o.owner === u.owner) return false;
    if (o.stealthed && dist2(o.x, o.y, u.x, u.y) > 1.3 * 1.3) return false;
    return true;
  });
}

/** Nearest enemy actively pressuring this owner's fortress. This is used by
 *  fresh defenders before generic lane-push goals, so a known home threat can
 *  never be ignored in favour of marching toward the central battlefield. */
function nearestHomeThreat(
  st: GameState,
  owner: PlayerId,
  canTarget?: (enemy: UnitState) => boolean,
): { enemy: UnitState; gate: ObeliskState; d2: number } | null {
  let best: { enemy: UnitState; gate: ObeliskState; d2: number } | null = null;
  const gates = st.obelisks.filter((o) => o.owner === owner);
  for (const enemy of st.units) {
    if (enemy.hp <= 0 || enemy.owner === owner) continue;
    if (canTarget && !canTarget(enemy)) continue;
    for (const gate of gates) {
      const d2 = dist2(enemy.x, enemy.y, gate.x, gate.y);
      if (d2 > 2.8 * 2.8 || (best && d2 >= best.d2)) continue;
      best = { enemy, gate, d2 };
    }
  }
  return best;
}

function onHomeSide(u: UnitState): boolean {
  return u.owner === 0 ? u.y >= RIVER_BANDS[0].y0 : u.y <= RIVER_BANDS[1].y1;
}

function pickTarget(st: GameState, u: RuntimeUnit): UnitState | null {
  const enemies = visibleEnemies(st, u).filter((e) => isCombatVisible(st, e));
  if (enemies.length === 0) return null;
  // Engagement stickiness: locked duels stay locked while in reach.
  if (u.targetId !== null) {
    const cur = enemies.find((e) => e.id === u.targetId);
    if (cur && dist(u.x, u.y, cur.x, cur.y) <= Math.max(2.2, u.stats.range + 1.2)) {
      const cs = speciesDef(cur.species).stats!;
      if (!(cs.flying && !u.stats.canHitAir && !u.stats.flying)) return cur;
    }
  }
  // Home-side defenders deal with warriors at either friendly gate before
  // resuming their central push. Threats the unit cannot actually FIGHT are
  // skipped — a ground warrior handed flying bees as its "home threat" would
  // walk to the gate and stand under them forever, attacking nothing.
  if (st.phase === 'basalt' && onHomeSide(u)) {
    const threat = nearestHomeThreat(st, u.owner, (e) => {
      const es = speciesDef(e.species).stats!;
      return !(es.flying && !u.stats.canHitAir && !u.stats.flying);
    });
    if (threat && enemies.some((e) => e.id === threat.enemy.id)) return threat.enemy;
  }
  // Eagle hunts the weakest visible heart. Everyone else hunts the NEAREST
  // visible enemy anywhere on the field — except in the Oasis, where a won
  // mid-fight must walk to the marble instead of turning around for a
  // fresh spawn on the far shore.
  if (u.species === 'eagle') {
    if (st.phase === 'oasis') {
      const reach = (AGGRO_RANGE * 1.35) ** 2;
      const near = enemies.filter((e) => {
        if (dist2(u.x, u.y, e.x, e.y) > reach) return false;
        const behind = u.owner === 0 ? e.y > u.y + 0.55 : e.y < u.y - 0.55;
        return !behind;
      });
      if (near.length === 0) return null;
      return near.reduce((a, b) => (b.hp < a.hp ? b : a));
    }
    return enemies.reduce((a, b) => (b.hp < a.hp ? b : a));
  }
  let best: UnitState | null = null;
  let bestD = Infinity;
  const aggroBase2 = AGGRO_RANGE * AGGRO_RANGE;
  // Ground anti-air artillery (bombardier beetles) may acquire flyers anywhere
  // inside their full weapon range — not capped at the melee aggro bubble.
  const flyerCap2 = u.stats.canHitAir && u.stats.ranged
    ? (attackReach(u) + 1.4) ** 2
    : aggroBase2;
  for (const e of enemies) {
    const eFly = speciesDef(e.species).stats!.flying;
    if (eFly && !u.stats.canHitAir && !u.stats.flying) continue;
    const d = dist2(u.x, u.y, e.x, e.y) + (e.id % 7) * 1e-4;
    if (eFly && !u.stats.flying && d > flyerCap2) continue;
    if (st.phase === 'oasis' && d > aggroBase2) continue;
    // Do not turn around for a spawn behind you — the marble is ahead.
    if (st.phase === 'oasis') {
      const behind = u.owner === 0 ? e.y > u.y + 0.55 : e.y < u.y - 0.55;
      const melee = (u.stats.radius + speciesDef(e.species).stats!.radius + 0.4) ** 2;
      if (behind && dist2(u.x, u.y, e.x, e.y) > melee) continue;
    }
    if (d < bestD) {
      bestD = d;
      best = e;
    }
  }
  return best;
}

/** The enemy gatehouse wing this unit should be pressuring (phase 1 only).
 *  Units batter the wing of the lane they marched down — the wall around
 *  their own arch — and only swing to the far gatehouse once their lane's
 *  wing has already crumbled. */
function enemyMarble(st: GameState, u: UnitState): MarbleState | null {
  if (st.phase !== 'oasis' && st.phase !== 'ended') return null;
  return st.marbles.find((m) => m.owner !== u.owner && m.hp > 0) ?? null;
}

function enemyCannon(st: GameState, u: UnitState): CannonState | null {
  if (st.phase !== 'oasis' && st.phase !== 'ended') return null;
  return st.cannons.find((c) => c.owner !== u.owner && c.hp > 0) ?? null;
}

/** After a gun falls, stay in the pad fight if this unit and its target
 *  are still on that shore. Do not peel mid-swing for the shrine door. */
function finishingPadBrawl(st: GameState, u: UnitState, target: UnitState | null): boolean {
  if (!target || target.hp <= 0) return false;
  const foe = (1 - u.owner) as PlayerId;
  if (shrineGuarded(st, foe)) return false;
  const pad = CANNON[foe];
  const nearPad = dist(u.x, u.y, pad.x, pad.y) <= 2.6;
  const targetNear = dist(target.x, target.y, pad.x, pad.y) <= 2.8;
  return nearPad && targetNear;
}

function enemyObelisk(st: GameState, u: UnitState): ObeliskState | null {
  if (st.phase !== 'basalt') return null;
  const wings = st.obelisks.filter((o) => o.owner !== u.owner);
  if (wings.length === 0) return null;
  const laneWing = wings.reduce((best, cur) =>
    Math.abs(cur.x - u.x) < Math.abs(best.x - u.x) ? cur : best);
  if (laneWing.hp > 0) return laneWing;
  const other = wings.find((o) => o !== laneWing && o.hp > 0);
  return other ?? null;
}

/** Where a ground unit stands to besiege a wing: on the field, just off the
 *  fortress wall — the wing body itself is inside blocked wall cells. */
function siegeGoal(ob: ObeliskState): Vec2 {
  const front = FORT_WALL_FRONT[ob.owner];
  return { x: ob.x, y: ob.owner === 1 ? front + 0.45 : front - 0.45 };
}

function attackReach(u: RuntimeUnit): number {
  let range = u.stats.range;
  if (u.buffs.rangeCapTicks > 0) range = Math.min(range, MECHANICS.beesRangeCap);
  return range;
}

function canAttack(st: GameState, u: RuntimeUnit, target: UnitState): boolean {
  if (!isCombatVisible(st, u) || !isCombatVisible(st, target)) return false;
  const tStats = speciesDef(target.species).stats!;
  if (tStats.flying && !u.stats.canHitAir && !u.stats.flying) return false;
  const reach = attackReach(u) + u.stats.radius + tStats.radius;
  return dist2(u.x, u.y, target.x, target.y) <= reach * reach;
}

/* ------------------------------------------------------------------------ */
/* Combat resolution                                                          */
/* ------------------------------------------------------------------------ */

function performAttack(st: GameState, ev: GameEvent[], u: RuntimeUnit, target: UnitState): void {
  const tStats = speciesDef(target.species).stats!;

  // Bombardier beetle: launch a visible acid jet instead of instant damage.
  if (u.stats.ranged) {
    const d = Math.max(0.001, dist(u.x, u.y, target.x, target.y));
    const speed = MECHANICS.acidJetSpeed;
    st.projectiles.push({
      id: nextProjId++,
      owner: u.owner,
      kind: 'acid',
      x: u.x, y: u.y, px: u.x, py: u.y,
      vx: ((target.x - u.x) / d) * speed,
      vy: ((target.y - u.y) / d) * speed,
      dmg: effDmg(u, st),
      ticksLeft: Math.max(1, Math.ceil(d / speed)),
      targetId: target.id,
    });
    u.traveled = 0;
    u.targetId = target.id;
    u.action = 'attack';
    u.facing = target.x >= u.x ? 1 : -1;
    u.atkTimer = u.stats.atkCd;
    ev.push({ type: 'shoot', unitId: u.id, x: u.x, y: u.y, tx: target.x, ty: target.y });
    ev.push({ type: 'attack', unitId: u.id, species: u.species, owner: u.owner, x: u.x, y: u.y, tx: target.x, ty: target.y, crit: false, air: tStats.flying });
    return;
  }

  let dmg = effDmg(u, st);
  let crit = false;

  // Bighorn charge: heavy mult + knockback after a long unbroken gallop.
  if (u.species === 'bighorn' && u.traveled >= MECHANICS.bighornChargeDist && !u.struckTargets.includes(target.id)) {
    dmg = Math.round(dmg * MECHANICS.bighornChargeMult);
    crit = true;
    ev.push({ type: 'charge', unitId: u.id, x: u.x, y: u.y });
    if (!tStats.colossal) {
      const d = Math.max(0.001, dist(u.x, u.y, target.x, target.y));
      const kx = ((target.x - u.x) / d) * MECHANICS.bighornKnockback;
      const ky = ((target.y - u.y) / d) * MECHANICS.bighornKnockback;
      const nx = target.x + kx;
      const ny = target.y + ky;
      if (inWorld(nx, ny) && (tStats.flying || groundOpen(st, nx, ny))) {
        target.px = target.x;
        target.py = target.y;
        target.x = nx;
        target.y = ny;
      }
    }
  }

  // Scorpion: first sting on each victim stuns.
  if (u.species === 'scorpion' && !u.struckTargets.includes(target.id)) {
    const berserk = target.species === 'honeybadger' && target.hp / target.maxHp < MECHANICS.badgerThreshold;
    if (!berserk) target.buffs.stun = Math.max(target.buffs.stun, MECHANICS.scorpionStunTicks);
  }

  if (!u.struckTargets.includes(target.id)) {
    u.struckTargets.push(target.id);
    if (u.struckTargets.length > 12) u.struckTargets.shift();
  }
  u.traveled = 0;
  u.targetId = target.id;
  u.action = 'attack';
  u.facing = target.x >= u.x ? 1 : -1;

  ev.push({ type: 'attack', unitId: u.id, species: u.species, owner: u.owner, x: u.x, y: u.y, tx: target.x, ty: target.y, crit, air: tStats.flying });

  // Bear sweep: the swipe rakes every enemy near the primary target.
  if (u.species === 'bear') {
    for (const o of st.units) {
      if (o.hp <= 0 || o.owner === u.owner || o.id === target.id) continue;
      if (dist2(o.x, o.y, target.x, target.y) <= MECHANICS.bearSweepRadius ** 2) {
        dealDamage(st, ev, u, o, Math.round(dmg * 0.6), 'melee');
      }
    }
  }

  dealDamage(st, ev, u, target, dmg, 'melee');

  if (u.species === 'fireants' && target.hp > 0) {
    target.buffs.burnStacks = Math.min(MECHANICS.acidMaxStacks, target.buffs.burnStacks + 1);
    target.buffs.burnTicks = MECHANICS.acidBurnTicks;
  }
  if (u.species === 'bees' && target.hp > 0) {
    target.buffs.rangeCapTicks = MECHANICS.beesRangeCapTicks;
  }

  let cd = u.stats.atkCd;
  if (u.buffs.berserk) cd = Math.max(1, Math.round(cd / 2));
  u.atkTimer = cd;
}

/* ------------------------------------------------------------------------ */
/* Obelisk siege                                                              */
/* ------------------------------------------------------------------------ */

function dealObeliskDamage(st: GameState, ev: GameEvent[], attacker: PlayerId, ob: ObeliskState, amount: number): void {
  amount = Math.round(amount);
  if (ob.hp <= 0 || amount <= 0) return;
  // Mild last-stand DR while the sister wing is already down. The big
  // fortification is the HP surge applied when the first wing falls (below).
  const sister = st.obelisks.find((o) => o.owner === ob.owner && o.wing !== ob.wing);
  const fortified = !!sister && sister.hp <= 0;
  const dealt = fortified ? Math.max(1, Math.round(amount * 0.82)) : amount;
  ob.hp -= dealt;
  st.players[attacker].damageDealt += dealt;
  ev.push({ type: 'obeliskHit', owner: ob.owner, amount: dealt, x: ob.x, y: ob.y });
  if (ob.hp <= 0) {
    ob.hp = 0;
    ev.push({ type: 'obeliskDown', owner: ob.owner, x: ob.x, y: ob.y });
    // Remaining wing surges: buys time for a counter-siege to land the
    // reciprocal first gate (1–1 trades) and keeps clean sweeps rare —
    // sized for staged late armies that would otherwise steamroll the sister.
    if (sister && sister.hp > 0) {
      const bonus = Math.round(sister.maxHp * 1.15);
      sister.maxHp += bonus;
      sister.hp = Math.min(sister.maxHp, sister.hp + bonus);
    }
  }
}

function attackObelisk(st: GameState, ev: GameEvent[], u: RuntimeUnit, ob: ObeliskState): void {
  u.traveled = 0;
  u.action = 'attack';
  u.facing = ob.x >= u.x ? 1 : -1;
  let cd = u.stats.atkCd;
  if (u.buffs.berserk) cd = Math.max(1, Math.round(cd / 2));
  u.atkTimer = cd;
  ev.push({ type: 'attack', unitId: u.id, species: u.species, owner: u.owner, x: u.x, y: u.y, tx: ob.x, ty: ob.y, crit: false, air: false });

  if (u.stats.ranged) {
    const d = Math.max(0.001, dist(u.x, u.y, ob.x, ob.y));
    const speed = MECHANICS.acidJetSpeed;
    st.projectiles.push({
      id: nextProjId++,
      owner: u.owner,
      kind: 'acid',
      x: u.x, y: u.y, px: u.x, py: u.y,
      vx: ((ob.x - u.x) / d) * speed,
      vy: ((ob.y - u.y) / d) * speed,
      dmg: effDmg(u, st),
      ticksLeft: Math.max(1, Math.ceil(d / speed)),
    });
    ev.push({ type: 'shoot', unitId: u.id, x: u.x, y: u.y, tx: ob.x, ty: ob.y });
    return;
  }
  dealObeliskDamage(st, ev, u.owner, ob, effDmg(u, st));
}

/** T-Rex stomp: chips all enemy ground units nearby, once per stride. */
function trexStomp(st: GameState, ev: GameEvent[], u: RuntimeUnit): void {
  ev.push({ type: 'stomp', x: u.x, y: u.y });
  for (const o of st.units) {
    if (o.hp <= 0 || o.owner === u.owner) continue;
    if (speciesDef(o.species).stats!.flying) continue;
    if (dist2(o.x, o.y, u.x, u.y) <= MECHANICS.trexStompRadius ** 2) {
      dealDamage(st, ev, u, o, MECHANICS.trexStompDmg, 'stomp');
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Projectiles                                                                */
/* ------------------------------------------------------------------------ */

function tickProjectiles(st: GameState, ev: GameEvent[]): void {
  for (const pr of st.projectiles) {
    if (pr.kind === 'acid' && pr.targetId != null) {
      const tgt = st.units.find((u) => u.id === pr.targetId && u.hp > 0);
      if (tgt) {
        const dx = tgt.x - pr.x;
        const dy = tgt.y - pr.y;
        const d = Math.max(0.001, Math.hypot(dx, dy));
        const speed = Math.hypot(pr.vx, pr.vy) || MECHANICS.acidJetSpeed;
        const steer = 0.88;
        const nx = dx / d;
        const ny = dy / d;
        pr.vx = pr.vx * (1 - steer) + nx * speed * steer;
        pr.vy = pr.vy * (1 - steer) + ny * speed * steer;
        pr.ticksLeft = Math.max(pr.ticksLeft, Math.ceil(d / speed) + 1);
        if (d < 0.35) {
          dealDamage(st, ev, null, tgt, pr.dmg, 'ranged');
          st.players[pr.owner].damageDealt += pr.dmg;
          pr.ticksLeft = 0;
        }
      }
    }
    pr.px = pr.x;
    pr.py = pr.y;
    pr.x += pr.vx;
    pr.y += pr.vy;
    pr.ticksLeft--;
    if (pr.ticksLeft > 0) continue;

    if (pr.kind === 'cannon' || pr.kind === 'gate') {
      if (pr.kind === 'cannon') {
        ev.push({
          type: 'shrineImpact',
          owner: pr.owner,
          x: pr.x, y: pr.y,
          kind: pr.style === 'water' ? 'water' : 'ember',
        });
      }
      const splash = pr.kind === 'gate' ? GATE_SHOT_SPLASH : MARBLE_CANNON_SPLASH;
      const r2 = splash * splash;
      const hitKind = pr.kind === 'cannon' ? 'cannon' : 'ranged';
      for (const o of st.units) {
        if (o.hp <= 0 || o.owner === pr.owner) continue;
        if (dist2(o.x, o.y, pr.x, pr.y) <= r2) {
          dealDamage(st, ev, null, o, pr.dmg, hitKind);
          st.players[pr.owner].damageDealt += pr.dmg;
        }
      }
      continue;
    }

    ev.push({ type: 'splash', x: pr.x, y: pr.y });
    for (const o of st.units) {
      if (o.hp <= 0 || o.owner === pr.owner) continue;
      if (dist2(o.x, o.y, pr.x, pr.y) <= MECHANICS.acidSplashRadius ** 2) {
        dealDamage(st, ev, null, o, pr.dmg, 'ranged');
        st.players[pr.owner].damageDealt += pr.dmg;
      }
    }
    for (const ob of st.obelisks) {
      if (ob.owner === pr.owner || ob.hp <= 0) continue;
      if (dist2(ob.x, ob.y, pr.x, pr.y) <= (MECHANICS.acidSplashRadius + ob.r) ** 2) {
        dealObeliskDamage(st, ev, pr.owner, ob, pr.dmg);
      }
    }
    for (const c of st.cannons) {
      if (c.owner === pr.owner || c.hp <= 0) continue;
      if (dist2(c.x, c.y, pr.x, pr.y) <= (MECHANICS.acidSplashRadius + c.r) ** 2) {
        dealCannonDamage(st, ev, pr.owner, c, Math.round(pr.dmg * LAVA_RAIN.buildingPct));
      }
    }
    for (const m of st.marbles) {
      if (m.owner === pr.owner || m.hp <= 0) continue;
      if (shrineGuarded(st, m.owner)) continue;
      if (dist2(m.x, m.y, pr.x, pr.y) <= (MECHANICS.acidSplashRadius + m.r) ** 2) {
        dealMarbleDamage(st, ev, pr.owner, m, Math.round(pr.dmg * LAVA_RAIN.buildingPct));
      }
    }
    st.zones.push({
      id: nextZoneId++, kind: 'acidpool', owner: pr.owner,
      x: pr.x, y: pr.y, r: SPELL_BALANCE.acidpool.radius,
      ticksLeft: SPELL_BALANCE.acidpool.duration,
    });
  }
  st.projectiles = st.projectiles.filter((p) => p.ticksLeft > 0);
}

/* ------------------------------------------------------------------------ */
/* Terrain, props & zone effects                                              */
/* ------------------------------------------------------------------------ */

function applyFieldEffects(st: GameState, ev: GameEvent[], u: RuntimeUnit): void {
  const world = worldOf(st);
  if (!u.stats.flying) {
    // Sulfur vents punish campers (only units that are not moving).
    if (u.action !== 'move' && (cellAt(world, u.x, u.y) === CELL.VENT ||
      st.props.some((p) => p.kind === 'vent' && dist2(p.x, p.y, u.x, u.y) <= p.r * p.r))) {
      dealDamage(st, ev, null, u, VENT_DMG, 'vent');
    }
    // Lotus blooms pop when trampled: AOE healing mist.
    for (const p of st.props) {
      if (p.kind !== 'lotus' || p.destroyed) continue;
      if (dist2(p.x, p.y, u.x, u.y) <= (p.r + u.stats.radius) ** 2) {
        p.destroyed = true;
        ev.push({ type: 'lotusBurst', x: p.x, y: p.y });
        st.zones.push({
          id: nextZoneId++, kind: 'healmist', owner: u.owner,
          x: p.x, y: p.y, r: SPELL_BALANCE.healmist.radius, ticksLeft: SPELL_BALANCE.healmist.duration,
        });
      }
    }
  }
  const wasStealthed = u.stealthed;
  u.stealthed = inStealthCover(st, u);
  if (!wasStealthed && u.stealthed) {
    ev.push({ type: 'thicketRustle', owner: u.owner, x: u.x, y: u.y });
  }
}

function applyZoneEffects(st: GameState, ev: GameEvent[]): void {
  for (const z of st.zones) {
    for (const u of st.units) {
      if (u.hp <= 0) continue;
      if (dist2(u.x, u.y, z.x, z.y) > z.r * z.r) continue;
      switch (z.kind) {
        case 'sulfur':
          if (u.owner !== z.owner) {
            u.buffs.slowTicks = Math.max(u.buffs.slowTicks, 1);
            u.buffs.slowMult = SPELL_BALANCE.sulfur.slowMult;
            dealDamage(st, ev, null, u, SPELL_BALANCE.sulfur.chip, 'burn');
          }
          break;
        case 'thicket':
          if (u.owner !== z.owner) {
            u.buffs.slowTicks = Math.max(u.buffs.slowTicks, 1);
            u.buffs.slowMult = SPELL_BALANCE.thicket.slowMult;
          }
          break;
        case 'acidpool':
          if (u.owner !== z.owner && !speciesDef(u.species).stats!.flying) {
            u.buffs.slowTicks = Math.max(u.buffs.slowTicks, 1);
            u.buffs.slowMult = SPELL_BALANCE.acidpool.slowMult;
          }
          break;
        case 'healmist': {
          const heal = Math.round(u.maxHp * LOTUS_HEAL_PCT);
          if (u.hp < u.maxHp) {
            u.hp = Math.min(u.maxHp, u.hp + heal);
            ev.push({ type: 'heal', x: u.x, y: u.y, amount: heal });
          }
          break;
        }
      }
    }
    if (z.kind === 'sulfur') {
      const chip = Math.max(2, Math.round(SPELL_BALANCE.sulfur.chip * 0.55));
      for (const ob of st.obelisks) {
        if (ob.owner === z.owner || ob.hp <= 0) continue;
        if (dist2(ob.x, ob.y, z.x, z.y) <= (z.r + ob.r) ** 2) {
          dealObeliskDamage(st, ev, z.owner, ob, chip);
        }
      }
      for (const c of st.cannons) {
        if (c.owner === z.owner || c.hp <= 0) continue;
        if (dist2(c.x, c.y, z.x, z.y) <= (z.r + c.r) ** 2) {
          dealCannonDamage(st, ev, z.owner, c, chip);
        }
      }
      for (const m of st.marbles) {
        if (m.owner === z.owner || m.hp <= 0) continue;
        if (shrineGuarded(st, m.owner)) continue;
        if (dist2(m.x, m.y, z.x, z.y) <= (z.r + m.r) ** 2) {
          dealMarbleDamage(st, ev, z.owner, m, chip);
        }
      }
    }
    z.ticksLeft--;
  }
  st.zones = st.zones.filter((z) => z.ticksLeft > 0);
}

function resolveLavaRain(st: GameState, ev: GameEvent[]): void {
  const due = st.pendingLava.filter((l) => l.resolveTick <= st.tick);
  st.pendingLava = st.pendingLava.filter((l) => l.resolveTick > st.tick);
  for (const strike of due) {
    ev.push({ type: 'lavaStrike', x: strike.x, y: strike.y });
    for (const u of st.units) {
      if (u.hp <= 0 || u.owner === strike.owner) continue;
      const d = dist(u.x, u.y, strike.x, strike.y);
      const flying = speciesDef(u.species).stats!.flying;
      let dmg = 0;
      if (d <= LAVA_RAIN.centerR) dmg = flying ? Math.round(LAVA_RAIN.centerDmg * LAVA_RAIN.flyerCenterMult) : LAVA_RAIN.centerDmg;
      else if (d <= LAVA_RAIN.midR) dmg = LAVA_RAIN.midDmg;
      else if (d <= LAVA_RAIN.rimR) dmg = LAVA_RAIN.rimDmg;
      if (dmg > 0) dealDamage(st, ev, null, u, dmg, 'lava');
    }
    // Same ring bites a gatehouse — otherwise the 5-cost sky is only a
    // unit wipe and sits dead in hand when the lane is empty.
    for (const ob of st.obelisks) {
      if (ob.hp <= 0 || ob.owner === strike.owner) continue;
      const d = dist(ob.x, ob.y, strike.x, strike.y);
      let dmg = 0;
      if (d <= LAVA_RAIN.centerR + ob.r) dmg = LAVA_RAIN.centerDmg;
      else if (d <= LAVA_RAIN.midR + ob.r) dmg = LAVA_RAIN.midDmg;
      else if (d <= LAVA_RAIN.rimR + ob.r) dmg = LAVA_RAIN.rimDmg;
      if (dmg > 0) dealObeliskDamage(st, ev, strike.owner, ob, Math.round(dmg * LAVA_RAIN.buildingPct));
    }
    for (const c of st.cannons) {
      if (c.hp <= 0 || c.owner === strike.owner) continue;
      const d = dist(c.x, c.y, strike.x, strike.y);
      let dmg = 0;
      if (d <= LAVA_RAIN.centerR + c.r) dmg = LAVA_RAIN.centerDmg;
      else if (d <= LAVA_RAIN.midR + c.r) dmg = LAVA_RAIN.midDmg;
      else if (d <= LAVA_RAIN.rimR + c.r) dmg = LAVA_RAIN.rimDmg;
      if (dmg > 0) dealCannonDamage(st, ev, strike.owner, c, Math.round(dmg * LAVA_RAIN.buildingPct));
    }
    for (const m of st.marbles) {
      if (m.hp <= 0 || m.owner === strike.owner) continue;
      if (shrineGuarded(st, m.owner)) continue;
      const d = dist(m.x, m.y, strike.x, strike.y);
      let dmg = 0;
      if (d <= LAVA_RAIN.centerR + m.r) dmg = LAVA_RAIN.centerDmg;
      else if (d <= LAVA_RAIN.midR + m.r) dmg = LAVA_RAIN.midDmg;
      else if (d <= LAVA_RAIN.rimR + m.r) dmg = LAVA_RAIN.rimDmg;
      if (dmg > 0) dealMarbleDamage(st, ev, strike.owner, m, Math.round(dmg * LAVA_RAIN.buildingPct));
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Movement — corridor routing + steering + wall slide                        */
/* ------------------------------------------------------------------------ */

/** True when any sample along the segment crosses non-walkable ground.
 *  Marching the WHOLE line (0.2-unit steps) matters: a thin lava river is
 *  invisible to a single end-point probe, which used to leave units grinding
 *  against chokepoint walls instead of routing around them. */
function groundLineBlocked(st: GameState, x0: number, y0: number, x1: number, y1: number): boolean {
  const d = dist(x0, y0, x1, y1);
  const steps = Math.max(1, Math.ceil(d / 0.2));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    if (!groundOpen(st, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t)) return true;
  }
  return false;
}

function steerStep(
  st: GameState, u: RuntimeUnit, goalX: number, goalY: number, stepLen: number, depth = 0,
): boolean {
  const world = worldOf(st);
  // Route via corridors when the straight line to the goal is blocked ahead.
  let aimX = goalX;
  let aimY = goalY;
  const flyTunnel = u.stats.flying ? flyerTunnelLane(u.x, u.y) : null;
  if (flyTunnel) {
    // Flyers leave and enter a fortress along the arch centreline. Their
    // target may be far off-axis, but lateral steering begins only after the
    // whole body has cleared the tunnel mouth.
    aimX = flyTunnel.laneX;
    // Unless the goal itself sits inside THIS tunnel lane, keep flying
    // toward the field-side exit. An off-lane goal at tunnel height would
    // otherwise cancel against the centreline clamp and freeze the flyer.
    const goalInLane = Math.abs(goalX - flyTunnel.laneX) <= FORT_ARCH_HALF_W + 0.9;
    const goalInZone = flyTunnel.owner === 0
      ? goalY > FORT_WALL_FRONT[0] - 0.55
      : goalY < FORT_WALL_FRONT[1] + 0.55;
    if (!(goalInLane && goalInZone)) {
      aimY = flyTunnel.owner === 0 ? FORT_WALL_FRONT[0] - 1.0 : FORT_WALL_FRONT[1] + 1.0;
    }
  } else if (!u.stats.flying) {
    const d = Math.max(0.001, dist(u.x, u.y, goalX, goalY));
    const probe = Math.min(d, 1.4);
    const lx = u.x + ((goalX - u.x) / d) * probe;
    const ly = u.y + ((goalY - u.y) / d) * probe;
    if (groundLineBlocked(st, u.x, u.y, lx, ly)) {
      const wp = nextCorridor(world, u.x, u.y, goalX, goalY);
      if (wp) {
        aimX = wp.x;
        aimY = wp.y;
      }
    }
  }

  const d = Math.max(0.001, dist(u.x, u.y, aimX, aimY));
  const step = Math.min(stepLen, dist(u.x, u.y, goalX, goalY));
  let sx = ((aimX - u.x) / d) * step;
  let sy = ((aimY - u.y) / d) * step;

  const tryMove = (mx: number, my: number): boolean => {
    const nx = u.x + mx;
    const ny = u.y + my;
    if (!inWorld(nx, ny)) return false;
    if (!u.stats.flying && !groundOpen(st, nx, ny)) return false;
    u.x = nx;
    u.y = ny;
    return true;
  };

  // Full step, then wall-slide on each axis, then a widening deflection fan
  // (45°, 90°, 120°, 150°, 180° either way — deterministic order biased by
  // unit id). The retreat angles matter: a unit shoved into a terrain pocket
  // whose only open ground is BEHIND it could otherwise never move again.
  if (tryMove(sx, sy)) return true;
  if (tryMove(sx, 0)) return true;
  if (tryMove(0, sy)) return true;
  const rot = (vx: number, vy: number, ang: number) => ({
    x: vx * Math.cos(ang) - vy * Math.sin(ang),
    y: vx * Math.sin(ang) + vy * Math.cos(ang),
  });
  const sign = u.id % 2 === 0 ? 1 : -1;
  for (const base of [0.7853981633974483, 1.5707963267948966, 2.0943951023931953, 2.617993877991494, Math.PI]) {
    for (const ang of [base * sign, -base * sign]) {
      const v = rot(sx, sy, ang);
      if (tryMove(v.x, v.y)) return true;
    }
  }
  // Completely wedged: fall back to marching straight at the next corridor
  // waypoint (once), which aims around the obstacle rather than through it.
  if (depth === 0 && !u.stats.flying) {
    const wp = nextCorridor(world, u.x, u.y, goalX, goalY);
    if (wp && dist2(wp.x, wp.y, goalX, goalY) > 0.01) {
      return steerStep(st, u, wp.x, wp.y, stepLen, 1);
    }
  }
  return false;
}

/** Extended tunnel zone for flyers. The 0.55-unit field-side clearance keeps
 *  the full swarm sprite inside the opening until its rear edge clears stone. */
function flyerTunnelLane(x: number, y: number): { owner: PlayerId; laneX: number } | null {
  let owner: PlayerId | null = null;
  if (y > FORT_WALL_FRONT[0] - 0.55) owner = 0;
  else if (y < FORT_WALL_FRONT[1] + 0.55) owner = 1;
  if (owner === null) return null;
  const lanes = FORT_LANES[owner];
  const laneX = Math.abs(x - lanes[0]) < Math.abs(x - lanes[1]) ? lanes[0] : lanes[1];
  if (Math.abs(x - laneX) > FORT_ARCH_HALF_W + 0.9) return null;
  return { owner, laneX };
}

/** Lane discipline: while a ground unit is inside a lava-river band or a
 *  fortress arch corridor, clamp its sideways position to the corridor's
 *  centre ± (corridor half-width − the unit's OWN radius). A T-Rex is nearly
 *  as wide as a bridge deck, so it threads dead-centre; small units keep a
 *  little natural wiggle but their bodies always stay on the stone. */
function laneDiscipline(st: GameState): void {
  if (worldOf(st) !== 'basalt') return;
  for (const raw of st.units) {
    if (raw.hp <= 0) continue;
    const stats = speciesDef(raw.species).stats!;
    if (stats.flying) {
      const tunnel = flyerTunnelLane(raw.x, raw.y);
      if (tunnel) raw.x = tunnel.laneX;
      continue;
    }
    let lanes: readonly [number, number] | null = null;
    let halfW = 0;
    if (raw.y > FORT_WALL_FRONT[0]) {
      lanes = FORT_LANES[0];
      halfW = FORT_ARCH_HALF_W;
    } else if (raw.y < FORT_WALL_FRONT[1]) {
      lanes = FORT_LANES[1];
      halfW = FORT_ARCH_HALF_W;
    } else {
      for (const owner of [0, 1] as const) {
        const band = RIVER_BANDS[owner];
        if (raw.y >= band.y0 && raw.y <= band.y1) {
          lanes = FORT_LANES[owner];
          halfW = BRIDGE_HALF_W;
        }
      }
    }
    if (!lanes) continue;
    const laneX = Math.abs(raw.x - lanes[0]) < Math.abs(raw.x - lanes[1]) ? lanes[0] : lanes[1];
    const play = Math.max(0.05, halfW - stats.radius);
    raw.x = Math.min(laneX + play, Math.max(laneX - play, raw.x));
  }
}

/** Soft separation: overlapping same-layer units push each other apart.
 *  Same-owner pairs bias the shove along the lane (Y) so bridges don't
 *  spray warriors sideways into lava / neighboring corridors. */
function separateUnits(st: GameState): void {
  const units = st.units.filter((u) => u.hp > 0);
  for (let i = 0; i < units.length; i++) {
    for (let j = i + 1; j < units.length; j++) {
      const a = units[i];
      const b = units[j];
      const aFly = speciesDef(a.species).stats!.flying;
      const bFly = speciesDef(b.species).stats!.flying;
      if (aFly !== bFly) continue;
      const ra = speciesDef(a.species).stats!.radius;
      const rb = speciesDef(b.species).stats!.radius;
      const minD = ra + rb;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minD * minD || d2 === 0) continue;
      const d = Math.sqrt(d2);
      const push = (minD - d) / 2;
      let ux = dx / d;
      let uy = dy / d;
      // Same army: prefer column depth over lateral shove (anti-chaos).
      if (a.owner === b.owner && !aFly) {
        ux *= 0.35;
        uy = uy >= 0 ? Math.max(0.55, Math.abs(uy)) : -Math.max(0.55, Math.abs(uy));
        const len = Math.hypot(ux, uy) || 1;
        ux /= len;
        uy /= len;
      }
      const world = worldOf(st);
      const move = (u: UnitState, mx: number, my: number, fly: boolean) => {
        const nx = Math.max(0.2, Math.min(WORLD_W - 0.2, u.x + mx));
        const ny = Math.max(0.2, Math.min(WORLD_H - 0.2, u.y + my));
        if (fly || walkableAt(world, nx, ny)) {
          u.x = nx;
          u.y = ny;
        }
      };
      move(a, -ux * push, -uy * push, aFly);
      move(b, ux * push, uy * push, bFly);
    }
  }
}

/* ------------------------------------------------------------------------ */
/* Per-unit AI tick                                                           */
/* ------------------------------------------------------------------------ */

function tickUnit(st: GameState, ev: GameEvent[], raw: UnitState): void {
  const u = rt(raw);
  u.px = u.x;
  u.py = u.y;
  u.action = 'idle';

  const berserk = u.species === 'honeybadger' && u.hp / u.maxHp < MECHANICS.badgerThreshold;
  u.buffs.berserk = berserk;
  if (berserk) u.buffs.stun = 0;
  if (u.buffs.stun > 0) {
    u.buffs.stun--;
    return;
  }
  if (u.buffs.burnTicks > 0) {
    dealDamage(st, ev, null, u, ACID_DMG * u.buffs.burnStacks, 'burn');
    u.buffs.burnTicks--;
    if (u.buffs.burnTicks === 0) u.buffs.burnStacks = 0;
    if (u.hp <= 0) return;
  }
  if (u.buffs.rangeCapTicks > 0) u.buffs.rangeCapTicks--;
  if (u.buffs.slowTicks > 0) u.buffs.slowTicks--;
  else u.buffs.slowMult = 1;
  if (u.atkTimer > 0) u.atkTimer--;
  if (u.unstick > 0) u.unstick--;

  // 1. Attack when a target is in reach — unless we are already on an enemy
  // gatehouse. Siege takes priority over chasing a distant skirmish so a
  // counter-push can chip a tower while the main fight rages elsewhere.
  // (Previously any aggro'd enemy cancelled siege entirely, which made
  // mutual gate trades impossible: the field winner deleted the loser,
  // then walked both towers unopposed.)
  const target = pickTarget(st, u);
  u.targetId = target?.id ?? null;
  const ob = enemyObelisk(st, u);
  const cannon = enemyCannon(st, u);
  const marble = enemyMarble(st, u);
  const siegeReach = ob ? attackReach(u) + u.stats.radius + ob.r : 0;
  const canSiege = !!ob && dist2(u.x, u.y, ob.x, ob.y) <= siegeReach * siegeReach;
  const cannonReach = cannon ? attackReach(u) + u.stats.radius + cannon.r : 0;
  const canSiegeCannon = !!cannon && dist2(u.x, u.y, cannon.x, cannon.y) <= cannonReach * cannonReach;
  const marbleExposed = !!marble && !shrineGuarded(st, marble.owner);
  const marbleReach = marbleExposed ? attackReach(u) + u.stats.radius + marble!.r : 0;
  const canSiegeMarble = marbleExposed && dist2(u.x, u.y, marble!.x, marble!.y) <= marbleReach * marbleReach;
  const threatClose = target
    && dist2(u.x, u.y, target.x, target.y) <= (Math.max(1.05, u.stats.radius + speciesDef(target.species).stats!.radius + 0.35) ** 2);
  const padBrawl = finishingPadBrawl(st, u, target);

  if (canSiege && !threatClose) {
    if (u.atkTimer <= 0) attackObelisk(st, ev, u, ob!);
    else u.facing = ob!.x >= u.x ? 1 : -1;
    u.stall = 0;
    u.stallRef = Infinity;
    return;
  }

  if (canSiegeCannon && !threatClose) {
    if (u.atkTimer <= 0) attackCannon(st, ev, u, cannon!);
    else u.facing = cannon!.x >= u.x ? 1 : -1;
    u.stall = 0;
    u.stallRef = Infinity;
    return;
  }

  if (canSiegeMarble && !threatClose && !padBrawl) {
    if (u.atkTimer <= 0) attackMarble(st, ev, u, marble!);
    else u.facing = marble!.x >= u.x ? 1 : -1;
    u.stall = 0;
    u.stallRef = Infinity;
    return;
  }

  if (target && canAttack(st, u, target)) {
    if (u.atkTimer <= 0) performAttack(st, ev, u, target);
    else u.facing = target.x >= u.x ? 1 : -1;
    u.stall = 0;
    u.stallRef = Infinity;
    return;
  }

  // 1b. Walk onto the gate if we're close but not yet in reach and nothing
  // is in attack range.
  if (ob && !target) {
    const reach = attackReach(u) + u.stats.radius + ob.r;
    if (dist2(u.x, u.y, ob.x, ob.y) <= reach * reach) {
      if (u.atkTimer <= 0) attackObelisk(st, ev, u, ob);
      else u.facing = ob.x >= u.x ? 1 : -1;
      u.stall = 0;
      u.stallRef = Infinity;
      return;
    }
  }

  if (cannon && !target) {
    const reach = attackReach(u) + u.stats.radius + cannon.r;
    if (dist2(u.x, u.y, cannon.x, cannon.y) <= reach * reach) {
      if (u.atkTimer <= 0) attackCannon(st, ev, u, cannon);
      else u.facing = cannon.x >= u.x ? 1 : -1;
      u.stall = 0;
      u.stallRef = Infinity;
      return;
    }
  }

  if (marbleExposed && !target) {
    const reach = attackReach(u) + u.stats.radius + marble!.r;
    if (dist2(u.x, u.y, marble!.x, marble!.y) <= reach * reach) {
      if (u.atkTimer <= 0) attackMarble(st, ev, u, marble!);
      else u.facing = marble!.x >= u.x ? 1 : -1;
      u.stall = 0;
      u.stallRef = Infinity;
      return;
    }
  }

  // 2. Otherwise move.
  const speed = effSpeed(st, u);
  if (speed <= 0) return;

  // Oasis: hard-walk the enemy gun until it falls, then the shrine door.
  // A pad brawl after a topple finishes first — no peel mid-swing.
  // Survivors still carry a pad waypoint from beginOasis; drop it once
  // the gun is gone so they do not walk an empty shore.
  if (st.phase === 'oasis' && !cannon && !padBrawl && u.waypoint) {
    const foePad = CANNON[(1 - u.owner) as PlayerId];
    if (dist2(u.waypoint.x, u.waypoint.y, foePad.padX, foePad.padY) <= 0.25) {
      u.waypoint = marbleExposed ? shrineDoor(marble!.owner) : null;
    }
  }

  let goal: Vec2;
  if (target && u.unstick === 0) {
    // Lane discipline: a warrior still behind its own wall FINISHES ITS OWN
    // LANE first — through the tunnel or up over the rubble mound — and only
    // then crosses toward enemies in other lanes from the battlefield side.
    const behindOwnWall = u.owner === 0
      ? u.y > FORT_WALL_FRONT[0] + 0.05
      : u.y < FORT_WALL_FRONT[1] - 0.05;
    if (behindOwnWall) {
      const lanes = FORT_LANES[u.owner];
      const ownLane = Math.abs(u.x - lanes[0]) < Math.abs(u.x - lanes[1])
        ? lanes[0]
        : lanes[1];
      goal = {
        x: ownLane,
        y: u.owner === 0 ? FORT_WALL_FRONT[0] - 0.5 : FORT_WALL_FRONT[1] + 0.5,
      };
    } else if (
      st.phase === 'basalt' && ob && !threatClose &&
      (u.owner === 0 ? u.y < WORLD_H * 0.48 : u.y > WORLD_H * 0.52)
    ) {
      goal = siegeGoal(ob);
    } else if (padBrawl) {
      goal = { x: target.x, y: target.y };
    } else if (
      st.phase === 'oasis' && cannon && !threatClose &&
      (u.owner === 0 ? u.y < WORLD_H * 0.52 : u.y > WORLD_H * 0.48)
    ) {
      goal = cannonPad(cannon.owner);
    } else if (
      st.phase === 'oasis' && marbleExposed && !threatClose &&
      (u.owner === 0 ? u.y < WORLD_H * 0.52 : u.y > WORLD_H * 0.48)
    ) {
      goal = shrineDoor(marble!.owner);
    } else {
      goal = { x: target.x, y: target.y };
    }
  } else if (u.waypoint && dist2(u.x, u.y, u.waypoint.x, u.waypoint.y) > 0.16) {
    goal = u.waypoint;
  } else {
    u.waypoint = null;
    goal = st.phase === 'oasis' && cannon
      ? cannonPad(cannon.owner)
      : st.phase === 'oasis' && marbleExposed
        ? shrineDoor(marble!.owner)
        : ob
          ? siegeGoal(ob)
          : st.phase === 'oasis'
            ? { x: WORLD_W / 2, y: WORLD_H / 2 }
            : { x: u.x, y: u.owner === 0 ? FORT_WALL_FRONT[1] + 0.6 : FORT_WALL_FRONT[0] - 0.6 };
  }

  const before = { x: u.x, y: u.y };
  const moved = steerStep(st, u, goal.x, goal.y, speed);
  if (moved) {
    const step = dist(before.x, before.y, u.x, u.y);
    u.traveled += step;
    if (Math.abs(u.x - before.x) > 0.01) u.facing = u.x > before.x ? 1 : -1;
    u.action = 'move';
    if (u.waypoint && dist2(u.x, u.y, u.waypoint.x, u.waypoint.y) <= 0.16) u.waypoint = null;
    if (u.species === 'trex') {
      u.stompBank += step;
      if (u.stompBank >= MECHANICS.trexStompStride) {
        u.stompBank -= MECHANICS.trexStompStride;
        trexStomp(st, ev, u);
      }
    }
  } else {
    u.traveled = 0;
  }
  // Waypoint give-up: measured as NET progress (best distance so far), so
  // wall-wiggling can't masquerade as movement. A fling that lands behind a
  // wall the fine grid can't cross is abandoned after ~3 s and the unit
  // marches on the phase objective instead of grinding at a chokepoint.
  if (u.waypoint) {
    const dw = dist(u.x, u.y, u.waypoint.x, u.waypoint.y);
    if (dw < u.stallRef - 0.05) {
      u.stallRef = dw;
      u.stall = 0;
    } else {
      u.stall++;
      if (u.stall >= 10) {
        u.waypoint = null;
        u.stall = 0;
        u.stallRef = Infinity;
      }
    }
  } else if (target && u.unstick === 0 && !moved) {
    // Chase-lock wedge: steering has HARD-FAILED (not wiggled — failed) for
    // 3 s straight while holding a target. Break off the chase for ~4 s so
    // movement falls back to the corridor-routed siege march, which walks
    // the unit around the river instead of leaving it planted at the bank
    // until an enemy happens to wander into attack range.
    u.stall++;
    u.stallRef = Infinity;
    if (u.stall >= 10) {
      u.stall = 0;
      u.unstick = 14;
    }
  } else {
    u.stall = 0;
    u.stallRef = Infinity;
  }
}

/* ------------------------------------------------------------------------ */
/* Phase orchestration                                                        */
/* ------------------------------------------------------------------------ */

function scoreTerritory(st: GameState): void {
  for (const u of st.units) {
    if (u.hp <= 0) continue;
    const depth = u.owner === 0
      ? Math.max(0, WORLD_H / 2 - u.y)
      : Math.max(0, u.y - WORLD_H / 2);
    st.players[u.owner].territoryScore += depth;
  }
}

function beginTransition(st: GameState, ev: GameEvent[]): void {
  st.phase = 'transition';
  st.phaseTicksLeft = TRANSITION_TICKS;
  const chapter = phase1Winner(st);
  st.dominanceP0 = chapter === 0 ? 1 : chapter === 1 ? 0 : 0.5;
  if (chapter !== null) {
    st.players[chapter].blessed = true;
    ev.push({ type: 'blessing', player: chapter });
  }
  // Survivors form marching columns home THROUGH their own gates — the
  // renderer plays the exodus cutscene over these ticks.
  for (const u of st.units) {
    if (u.hp <= 0) continue;
    const lanes = FORT_LANES[u.owner];
    const lane = Math.abs(u.x - lanes[0]) < Math.abs(u.x - lanes[1]) ? lanes[0] : lanes[1];
    u.waypoint = { x: lane, y: u.owner === 0 ? WORLD_H - 1.4 : 1.4 };
    u.stall = 0;
    u.stallRef = Infinity;
    u.targetId = null;
  }
  ev.push({ type: 'phaseChange', phase: 'transition' });
}

function tickTransitionMarch(st: GameState): void {
  // Units stream toward their own edge, unopposed, for the cutscene.
  for (const raw of st.units) {
    if (raw.hp <= 0) continue;
    const u = rt(raw);
    u.px = u.x;
    u.py = u.y;
    const gy = u.owner === 0 ? WORLD_H - 1 : 1;
    steerStep(st, u, u.x, gy, Math.max(0.22, u.stats.speed * 1.6));
    u.action = 'move';
    u.facing = u.owner === 0 ? 1 : -1;
  }
}

function beginOasis(st: GameState, ev: GameEvent[]): void {
  st.phase = 'oasis';
  st.phaseTicksLeft = st.cfg.phase2Ticks;
  st.zones = [];
  st.projectiles = [];
  st.pendingLava = [];
  st.props = oasisProps();
  st.obelisks = [];
  const ward: PlayerId | null = st.players[0].blessed ? 0 : st.players[1].blessed ? 1 : null;
  st.marbles = makeMarbles(ward);
  st.cannons = makeCannons();
  st.marbleDamage = [0, 0];
  st.cannonDamage = [0, 0];
  st.cannonFellTick = [null, null];

  // Survivors re-enter from their own edge, scars intact, marching the pond
  // toward the enemy gun — the shrine waits until that pad falls.
  const survivors = st.units.filter((u) => u.hp > 0);
  st.units = [];
  let lane = 0;
  for (const u of survivors) {
    const spot = oasisReentry(u.owner, lane);
    lane++;
    u.x = spot.x;
    u.y = spot.y;
    u.px = spot.x;
    u.py = spot.y;
    const foeOwner = (1 - u.owner) as PlayerId;
    u.waypoint = cannonPad(foeOwner);
    u.stall = 0;
    u.stallRef = Infinity;
    u.buffs = freshBuffs();
    u.action = 'spawn';
    u.targetId = null;
    st.units.push(u);
    ev.push({ type: 'spawn', unitId: u.id, species: u.species, owner: u.owner, x: u.x, y: u.y });
  }
  ev.push({ type: 'phaseChange', phase: 'oasis' });
}

function dealCannonDamage(
  st: GameState, ev: GameEvent[], attacker: PlayerId, c: CannonState, amount: number,
): void {
  amount = Math.round(amount);
  if (c.hp <= 0 || amount <= 0) return;
  c.hp = Math.max(0, c.hp - amount);
  st.cannonDamage[attacker] += amount;
  st.players[attacker].damageDealt += amount;
  ev.push({ type: 'cannonHit', owner: c.owner, amount, x: c.x, y: c.y });
  if (c.hp <= 0) {
    if (st.cannonFellTick[c.owner] == null) st.cannonFellTick[c.owner] = st.tick;
    ev.push({ type: 'cannonDown', owner: c.owner, x: c.x, y: c.y });
  }
}

function dealMarbleDamage(
  st: GameState, ev: GameEvent[], attacker: PlayerId, m: MarbleState, amount: number,
): void {
  amount = Math.round(amount);
  if (m.hp <= 0 || amount <= 0) return;
  if (shrineGuarded(st, m.owner)) return;
  let left = amount;
  let shielded = false;
  if (m.shield > 0) {
    shielded = true;
    const eat = Math.min(m.shield, left);
    m.shield -= eat;
    left -= eat;
    if (m.shield <= 0) ev.push({ type: 'shieldBreak', owner: m.owner, x: m.x, y: m.y });
  }
  if (left > 0) m.hp = Math.max(0, m.hp - left);
  st.marbleDamage[attacker] += amount;
  st.players[attacker].damageDealt += amount;
  ev.push({ type: 'marbleHit', owner: m.owner, amount, x: m.x, y: m.y, shielded });
  if (m.hp <= 0) {
    ev.push({ type: 'marbleDown', owner: m.owner, x: m.x, y: m.y });
    const other = st.marbles.find((o) => o.owner !== m.owner);
    if (other && other.hp > 0) endGame(st, ev, attacker);
  }
}

function attackMarble(st: GameState, ev: GameEvent[], u: RuntimeUnit, m: MarbleState): void {
  u.traveled = 0;
  u.action = 'attack';
  u.facing = m.x >= u.x ? 1 : -1;
  let cd = u.stats.atkCd;
  if (u.buffs.berserk) cd = Math.max(1, Math.round(cd / 2));
  u.atkTimer = cd;
  ev.push({ type: 'attack', unitId: u.id, species: u.species, owner: u.owner, x: u.x, y: u.y, tx: m.x, ty: m.y, crit: false, air: false });
  if (u.stats.ranged) {
    const d = Math.max(0.001, dist(u.x, u.y, m.x, m.y));
    const speed = MECHANICS.acidJetSpeed;
    st.projectiles.push({
      id: nextProjId++,
      owner: u.owner,
      kind: 'acid',
      x: u.x, y: u.y, px: u.x, py: u.y,
      vx: ((m.x - u.x) / d) * speed,
      vy: ((m.y - u.y) / d) * speed,
      dmg: Math.round(effDmg(u, st)),
      ticksLeft: Math.max(1, Math.ceil(d / speed)),
    });
    ev.push({ type: 'shoot', unitId: u.id, x: u.x, y: u.y, tx: m.x, ty: m.y });
    return;
  }
  dealMarbleDamage(st, ev, u.owner, m, Math.round(effDmg(u, st)));
}

function attackCannon(st: GameState, ev: GameEvent[], u: RuntimeUnit, c: CannonState): void {
  u.traveled = 0;
  u.action = 'attack';
  u.facing = c.x >= u.x ? 1 : -1;
  let cd = u.stats.atkCd;
  if (u.buffs.berserk) cd = Math.max(1, Math.round(cd / 2));
  u.atkTimer = cd;
  ev.push({ type: 'attack', unitId: u.id, species: u.species, owner: u.owner, x: u.x, y: u.y, tx: c.x, ty: c.y, crit: false, air: false });
  if (u.stats.ranged) {
    const d = Math.max(0.001, dist(u.x, u.y, c.x, c.y));
    const speed = MECHANICS.acidJetSpeed;
    st.projectiles.push({
      id: nextProjId++,
      owner: u.owner,
      kind: 'acid',
      x: u.x, y: u.y, px: u.x, py: u.y,
      vx: ((c.x - u.x) / d) * speed,
      vy: ((c.y - u.y) / d) * speed,
      dmg: Math.round(effDmg(u, st)),
      ticksLeft: Math.max(1, Math.ceil(d / speed)),
    });
    ev.push({ type: 'shoot', unitId: u.id, x: u.x, y: u.y, tx: c.x, ty: c.y });
    return;
  }
  dealCannonDamage(st, ev, u.owner, c, Math.round(effDmg(u, st)));
}

function gateMouth(ob: ObeliskState): Vec2 {
  const front = FORT_WALL_FRONT[ob.owner];
  return { x: ob.x, y: ob.owner === 0 ? front - 0.12 : front + 0.12 };
}

function tickGates(st: GameState, ev: GameEvent[]): void {
  if (st.phase !== 'basalt') return;
  for (const ob of st.obelisks) {
    if (ob.hp <= 0) continue;
    if (ob.atkTimer > 0) ob.atkTimer--;
    if (ob.atkTimer > 0) continue;
    const mouth = gateMouth(ob);
    let best: UnitState | null = null;
    let bestScore = Infinity;
    for (const u of st.units) {
      if (u.hp <= 0 || u.owner === ob.owner) continue;
      if (!isCombatVisible(st, u)) continue;
      const d = dist(mouth.x, mouth.y, u.x, u.y);
      if (d > GATE_SHOT_RANGE) continue;
      const offLane = Math.abs(u.x - ob.x) > 2.2 ? 2 : 0;
      const score = d + offLane;
      if (score < bestScore) {
        bestScore = score;
        best = u;
      }
    }
    if (!best) {
      ob.atkTimer = 1;
      continue;
    }
    const d = Math.max(0.001, dist(mouth.x, mouth.y, best.x, best.y));
    const ticks = Math.max(1, Math.ceil(d / GATE_SHOT_SPEED));
    const style = st.players[ob.owner].faction === 'magma' ? 'ember' : 'water';
    st.projectiles.push({
      id: nextProjId++,
      owner: ob.owner,
      kind: 'gate',
      style,
      x: mouth.x, y: mouth.y, px: mouth.x, py: mouth.y,
      vx: (best.x - mouth.x) / ticks,
      vy: (best.y - mouth.y) / ticks,
      dmg: GATE_SHOT_DMG,
      ticksLeft: ticks,
    });
    ev.push({
      type: 'gateShot',
      owner: ob.owner,
      wing: ob.wing,
      x: mouth.x, y: mouth.y, tx: best.x, ty: best.y,
    });
    ob.atkTimer = GATE_SHOT_INTERVAL;
  }
}

function tickBridgeAlerts(st: GameState, ev: GameEvent[]): void {
  if (st.phase !== 'basalt') return;
  for (const u of st.units) {
    if (u.hp <= 0 || u.bridgeWarned) continue;
    const foe = (1 - u.owner) as PlayerId;
    const band = RIVER_BANDS[foe];
    if (u.y < band.y0 - 0.06 || u.y > band.y1 + 0.06) continue;
    const lanes = FORT_LANES[foe];
    const wing = Math.abs(u.x - lanes[0]) < Math.abs(u.x - lanes[1]) ? 0 : 1;
    if (Math.abs(u.x - lanes[wing]) > BRIDGE_HALF_W + 0.4) continue;
    u.bridgeWarned = true;
    ev.push({ type: 'bridgeThreat', owner: foe, wing, x: u.x, y: u.y });
  }
}

function inCannonHalf(c: CannonState, y: number): boolean {
  return c.owner === 0 ? y >= WORLD_H * 0.5 : y < WORLD_H * 0.5;
}

function tickCannons(st: GameState, ev: GameEvent[]): void {
  if (st.phase !== 'oasis') return;
  for (const c of st.cannons) {
    if (c.hp <= 0) continue;
    if (c.atkTimer > 0) c.atkTimer--;
    if (c.atkTimer > 0) continue;
    let best: UnitState | null = null;
    let bestD = Infinity;
    for (const u of st.units) {
      if (u.hp <= 0 || u.owner === c.owner) continue;
      if (!inCannonHalf(c, u.y)) continue;
      const pad = CANNON[c.owner];
      const d = dist(u.x, u.y, pad.padX, pad.padY);
      if (d > MARBLE_SHOT_RANGE) continue;
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    if (!best) {
      c.atkTimer = 1;
      continue;
    }
    const faction = st.players[c.owner].faction;
    const style = faction === 'magma' ? 'ember' : 'water';
    const shot = CANNON[c.owner];
    const d = Math.max(0.001, dist(shot.shotX, shot.shotY, best.x, best.y));
    // Land ON the aimed body. Constant speed overshoots whenever
    // distance/speed is not an integer — a 2.2 wu shot at speed 3 would
    // fly 3 wu and miss a 0.75 splash. At least three ticks so the shell
    // is on screen as a flying projectile, not a teleport.
    const ticks = Math.max(3, Math.ceil(d / MARBLE_CANNON_SPEED));
    st.projectiles.push({
      id: nextProjId++,
      owner: c.owner,
      kind: 'cannon',
      style,
      x: shot.shotX, y: shot.shotY, px: shot.shotX, py: shot.shotY,
      vx: (best.x - shot.shotX) / ticks,
      vy: (best.y - shot.shotY) / ticks,
      dmg: MARBLE_SHOT_DMG,
      ticksLeft: ticks,
    });
    ev.push({
      type: 'shrineShot',
      owner: c.owner,
      x: shot.shotX, y: shot.shotY, tx: best.x, ty: best.y,
      kind: style,
    });
    c.atkTimer = MARBLE_SHOT_INTERVAL;
  }
}

function cannonTiebreak(st: GameState): PlayerId | 'tie' {
  if (st.cannonDamage[0] !== st.cannonDamage[1]) {
    return st.cannonDamage[0] > st.cannonDamage[1] ? 0 : 1;
  }
  const fell0 = st.cannonFellTick[1]; // tick we toppled THEIR (seat 1) gun
  const fell1 = st.cannonFellTick[0];
  if (fell0 != null && fell1 != null) {
    if (fell0 !== fell1) return fell0 < fell1 ? 0 : 1;
    return 'tie';
  }
  if (fell0 != null) return 0;
  if (fell1 != null) return 1;
  return 'tie';
}

export function oasisWinner(st: GameState): PlayerId | 'tie' {
  const m0 = st.marbles.find((m) => m.owner === 0);
  const m1 = st.marbles.find((m) => m.owner === 1);
  if (!m0 || !m1) return 'tie';
  const d0 = m0.hp <= 0;
  const d1 = m1.hp <= 0;
  if (d1 && !d0) return 0;
  if (d0 && !d1) return 1;
  if (d0 && d1) {
    if (st.marbleDamage[0] !== st.marbleDamage[1]) {
      return st.marbleDamage[0] > st.marbleDamage[1] ? 0 : 1;
    }
    return cannonTiebreak(st);
  }
  const dealt0 = (m1.maxHp - m1.hp) + (m1.shieldMax - m1.shield);
  const dealt1 = (m0.maxHp - m0.hp) + (m0.shieldMax - m0.shield);
  if (dealt0 > dealt1) return 0;
  if (dealt1 > dealt0) return 1;
  return cannonTiebreak(st);
}

function endGame(st: GameState, ev: GameEvent[], forced?: PlayerId | 'tie'): void {
  if (st.phase === 'ended') return;
  st.phase = 'ended';
  st.winner = forced ?? oasisWinner(st);
  ev.push({ type: 'gameOver', winner: st.winner });
}

/* ------------------------------------------------------------------------ */
/* THE TICK                                                                   */
/* ------------------------------------------------------------------------ */

export function advanceTick(st: GameState, inputs: PlayerInput[]): TickResult {
  const ev: GameEvent[] = [];
  if (st.phase === 'ended') return { state: st, events: ev };

  st.tick++;

  let income = st.phase === 'oasis' ? AQUA_PER_TICK_P2 : AQUA_PER_TICK_P1;
  if (st.phase === 'basalt' && st.phaseTicksLeft <= AQUA_P1_LATE_TICKS) {
    income = AQUA_PER_TICK_P1_LATE;
  }
  if (st.phase !== 'transition') {
    for (const p of st.players) p.aqua = Math.min(AQUA_MAX, p.aqua + income);
  }

  // Inputs, deterministically ordered with alternating seat priority.
  const first = st.tick % 2;
  const sorted = [...inputs].sort(
    (a, b) => (a.player === first ? -1 : 1) - (b.player === first ? -1 : 1) || a.seq - b.seq,
  );
  if (st.phase === 'basalt' || st.phase === 'oasis') {
    for (const input of sorted) applyInput(st, ev, input);
  }

  resolveLavaRain(st, ev);

  if (st.phase === 'basalt' || st.phase === 'oasis') {
    const order = [...st.units].sort(
      (a, b) => (a.owner === first ? -1 : 1) - (b.owner === first ? -1 : 1) || a.id - b.id,
    );
    for (const u of order) {
      if (u.hp > 0) tickUnit(st, ev, u);
    }
    tickProjectiles(st, ev);
    separateUnits(st);
    laneDiscipline(st);
    for (const u of st.units) if (u.hp > 0) applyFieldEffects(st, ev, rt(u));
    applyZoneEffects(st, ev);
  } else if (st.phase === 'transition') {
    tickTransitionMarch(st);
  }

  st.units = st.units.filter((u) => u.hp > 0);

  if (st.phase === 'basalt') scoreTerritory(st);
  if (st.phase === 'basalt') {
    tickGates(st, ev);
    tickBridgeAlerts(st, ev);
  }
  if (st.phase === 'oasis') tickCannons(st, ev);

  // The Basalt Fields end only when a fortress has lost BOTH gatehouses —
  // a decisive phase-1 victory that carries the Blessing into the Oasis.
  if (st.phase === 'basalt' && ([0, 1] as const).some((seat) =>
    st.obelisks.filter((o) => o.owner === seat).every((o) => o.hp <= 0))) {
    beginTransition(st, ev);
  }

  st.phaseTicksLeft--;
  if (st.phaseTicksLeft <= 0) {
    if (st.phase === 'basalt') beginTransition(st, ev);
    else if (st.phase === 'transition') beginOasis(st, ev);
    else if (st.phase === 'oasis') endGame(st, ev);
  }

  return { state: st, events: ev };
}

/* ============================================================================
 * TickDriver — real-time pacing, async input queueing, rewind/replay.
 *
 * Battle pacing can phase-lock to the soundtrack's 8th-note grid (one tick =
 * MUSIC_TICK_SEC = TICK_MS/1000) via an injected TickClock. Sim contents stay
 * tick-authoritative; only wall-clock wake times move. Without a clock we
 * fall back to a plain interval (tests / non-audio hosts).
 * ========================================================================== */

export interface DriverCallbacks {
  onTick: (result: TickResult) => void;
  sendInput?: (input: PlayerInput) => void;
}

/** Optional audio/performance clock for phase-locking ticks to music. */
export interface TickClock {
  /** Current time in seconds (AudioContext.currentTime or performance). */
  now: () => number;
  /** Time corresponding to tick 0; tick k fires at origin + k * (TICK_MS/1000). */
  phaseOrigin: number;
  /** Snap a time down onto the shared 8th grid (used after long hitches). */
  align?: (t: number) => number;
}

export class TickDriver {
  state: GameState;
  private inputQueue = new Map<number, PlayerInput[]>();
  private history: Array<{ tick: number; snapshot: string }> = [];
  private appliedInputs: PlayerInput[] = [];
  private seq = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private timeout: ReturnType<typeof setTimeout> | null = null;
  private cb: DriverCallbacks;
  private accumulatedEvents: GameEvent[] = [];
  private clock: TickClock | null = null;
  private running = false;
  private onVis: (() => void) | null = null;

  constructor(seed: number, factions: [FactionId, FactionId], cb: DriverCallbacks, cfg?: PhaseConfig) {
    resetIds();
    this.state = createGame(seed, factions, cfg);
    this.cb = cb;
  }

  submit(player: PlayerId, action: PlayerInput['action']): PlayerInput {
    const input: PlayerInput = {
      seq: ++this.seq,
      player,
      tick: this.state.tick + 1,
      action,
    };
    this.enqueue(input);
    this.cb.sendInput?.(input);
    return input;
  }

  receiveRemote(input: PlayerInput): void {
    if (input.tick <= this.state.tick) {
      this.rewindAndReplay(input);
    } else {
      this.enqueue(input);
    }
  }

  private enqueue(input: PlayerInput): void {
    const list = this.inputQueue.get(input.tick) ?? [];
    if (list.some((i) => i.player === input.player && i.seq === input.seq)) return;
    list.push(input);
    this.inputQueue.set(input.tick, list);
  }

  private rewindAndReplay(lateInput: PlayerInput): void {
    const snap = [...this.history].reverse().find((h) => h.tick < lateInput.tick);
    if (!snap) {
      this.enqueue({ ...lateInput, tick: this.state.tick + 1 });
      return;
    }
    const currentTick = this.state.tick;
    this.state = JSON.parse(snap.snapshot) as GameState;
    const replay = this.appliedInputs.filter((i) => i.tick > snap.tick);
    replay.push(lateInput);
    for (const i of replay) this.enqueue(i);
    while (this.state.tick < currentTick) {
      this.stepOnce(true);
    }
  }

  private stepOnce(silent = false): void {
    const nextTick = this.state.tick + 1;
    const inputs = this.inputQueue.get(nextTick) ?? [];
    this.inputQueue.delete(nextTick);
    this.appliedInputs.push(...inputs);
    if (this.appliedInputs.length > 400) this.appliedInputs.splice(0, this.appliedInputs.length - 400);

    const result = advanceTick(this.state, inputs);
    this.state = result.state;

    if (this.state.tick % 10 === 0) {
      this.history.push({ tick: this.state.tick, snapshot: JSON.stringify(this.state) });
      if (this.history.length > 8) this.history.shift();
    }

    if (silent) {
      this.accumulatedEvents.push(...result.events);
    } else {
      const events = [...this.accumulatedEvents, ...result.events];
      this.accumulatedEvents = [];
      this.cb.onTick({ state: this.state, events });
    }
  }

  /**
   * Start real-time pacing. Pass a TickClock (from music.battleTickPhase) to
   * phase-lock sim ticks onto the soundtrack's 8th-note grid. Omitting the
   * clock keeps the classic setInterval fallback.
   */
  start(clock?: TickClock): void {
    if (this.running) return;
    this.running = true;
    this.clock = clock ?? null;
    if (this.clock) {
      this.armNextTick();
      this.onVis = () => this.reanchorIfStale();
      if (typeof document !== 'undefined') {
        document.addEventListener('visibilitychange', this.onVis);
      }
    } else {
      this.timer = setInterval(() => this.stepOnce(), TICK_MS);
    }
  }

  stop(): void {
    this.running = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = null;
    if (this.onVis && typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.onVis);
    }
    this.onVis = null;
    this.clock = null;
  }

  /** Ideal wall time (sec) when tick `k` should fire. */
  private deadlineFor(k: number): number {
    const tickSec = TICK_MS / 1000;
    return (this.clock?.phaseOrigin ?? 0) + k * tickSec;
  }

  private armNextTick(): void {
    if (!this.running || !this.clock) return;
    if (this.timeout) clearTimeout(this.timeout);
    this.reanchorIfStale();
    const now = this.clock.now();
    const nextTick = this.state.tick + 1;
    const due = this.deadlineFor(nextTick);
    // Never dump a multi-tick burst: minimum delay keeps catch-up one-at-a-time.
    const delayMs = Math.max(4, (due - now) * 1000);
    this.timeout = setTimeout(() => {
      this.timeout = null;
      if (!this.running) return;
      this.stepOnce();
      this.armNextTick();
    }, delayMs);
  }

  /**
   * After a long hitch (background tab), redefine phaseOrigin so the current
   * tick maps onto the latest grid line — no skipped/doubled sim ticks.
   */
  private reanchorIfStale(): void {
    if (!this.clock) return;
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    const tickSec = TICK_MS / 1000;
    const now = this.clock.now();
    const expected = this.deadlineFor(this.state.tick);
    const lagSec = now - expected;
    if (lagSec <= tickSec * 2) return;
    const aligned = this.clock.align ? this.clock.align(now) : now;
    this.clock.phaseOrigin = aligned - this.state.tick * tickSec;
  }
}

/* ============================================================================
 * Scripted opponent for Local Guest Mode.
 * ========================================================================== */

export class BotBrain {
  private rng: () => number;
  private nextActionTick = 0;
  /** Enemy unit ids seen last think — fresh ids mean the foe just deployed. */
  private knownFoes = new Set<number>();
  /** Punish-push window: answer a fresh enemy deployment back-to-back. */
  private punishUntil = 0;
  /** Wing of the previous deploy — the dual-lane squeeze alternates it. */
  private lastLane: 0 | 1 | null = null;
  constructor(private seat: PlayerId, seed: number, private strength: BotStrength = 'normal') {
    this.rng = makeRng(seed ^ 0xb07);
  }

  think(st: GameState): PlayerInput['action'] | null {
    if (st.phase !== 'basalt' && st.phase !== 'oasis') return null;
    const strong = this.strength === 'strong';
    // Punish-push detection runs before any cooldown gate so a player
    // deployment is never missed: fresh enemy bodies open a short window
    // where the bot answers immediately, back to back.
    const foeIds = st.units.filter((u) => u.hp > 0 && u.owner !== this.seat).map((u) => u.id);
    let newFoe = false;
    for (const id of foeIds) if (!this.knownFoes.has(id)) { newFoe = true; break; }
    this.knownFoes = new Set(foeIds);
    if (newFoe) this.punishUntil = st.tick + (strong ? 16 : 10);
    const punishing = st.tick < this.punishUntil;

    if (st.tick < this.nextActionTick) return null;
    const me = st.players[this.seat];
    // Act on OWN-priority ticks (input ordering alternates seat priority by
    // tick parity — acting off-parity donated every contested army-cap and
    // lane-cap slot to the opponent). Flush and punish override the wait.
    if (!strong && !punishing && me.aqua < 5.2 && st.tick % 2 !== this.seat % 2) return null;
    // Near the aqua cap every idle beat wastes income — spend with urgency.
    const flush = me.aqua >= (strong ? 6.25 : 7);

    const lavaInHand = me.hand.includes(LAVA_RAIN_CARD);
    if (lavaInHand && me.aqua >= cardDef(LAVA_RAIN_CARD, st.phase).cost) {
      const enemies = st.units.filter((u) => u.hp > 0 && u.owner !== this.seat && isCombatVisible(st, u));
      if (enemies.length >= 2) {
        let best: Vec2 | null = null;
        let bestScore = strong ? 0 : 2;
        for (const e of enemies) {
          const score = enemies.filter((o) => dist2(o.x, o.y, e.x, e.y) <= 1.7 * 1.7).length;
          if (score > bestScore) {
            bestScore = score;
            best = { x: e.x, y: e.y };
          }
        }
        if (best && (strong ? bestScore >= 2 : bestScore >= 3 || (this.rng() < 0.55 && bestScore >= 2))) {
          this.nextActionTick = st.tick + (strong ? 2 : 4);
          return { type: 'spell', card: LAVA_RAIN_CARD, x: best.x, y: best.y };
        }
      }
      // Empty board or a wounded gun / shrine: the sky still cracks stone.
      const foeCannon = st.cannons.find((c) => c.owner !== this.seat && c.hp > 0);
      const foeMarble = st.marbles.find((m) => m.owner !== this.seat && m.hp > 0);
      if (foeCannon && (flush || foeCannon.hp < foeCannon.maxHp * 0.7)) {
        this.nextActionTick = st.tick + (strong ? 2 : 4);
        return { type: 'spell', card: LAVA_RAIN_CARD, x: foeCannon.x, y: foeCannon.y };
      }
      if (foeMarble && !foeCannon && (flush || foeMarble.hp + foeMarble.shield < (foeMarble.maxHp + foeMarble.shieldMax) * 0.55)) {
        this.nextActionTick = st.tick + (strong ? 2 : 4);
        return { type: 'spell', card: LAVA_RAIN_CARD, x: foeMarble.x, y: foeMarble.y };
      }
    }

    // Relentless pressure: no idle beats — if the bot can act, it acts.
    if (me.aqua < 2) return null;

    const affordable = me.hand.filter((c) => cardDef(c, st.phase).cost <= me.aqua);
    if (affordable.length === 0) return null;
    // Score the hand: bigger bodies lead, with light counter-awareness —
    // anti-air against flyers, air pressure when the foe can't answer it.
    // Jitter keeps the bot human (reads, not scripts).
    const foes = st.units.filter((u) => u.hp > 0 && u.owner !== this.seat);
    const foeFlyers = foes.filter((u) => !!speciesDef(u.species).stats?.flying).length;
    const foeAntiAir = foes.some((u) => !!speciesDef(u.species).stats?.canHitAir);
    const scoreCard = (c: CardId): number => {
      const d = cardDef(c, st.phase);
      let s = strong ? d.cost : d.cost + this.rng() * 1.8;
      if (d.kind === 'unit') {
        if (!strong && foeFlyers > 0 && d.stats?.canHitAir) s += 2;
        if (!strong && !foeAntiAir && d.stats?.flying) s += 1.5;
        if (strong && d.stats) {
          // Strong evaluates the whole deployed formation rather than treating
          // price as quality. This avoids wasting five aqua on a lone support
          // unit when an efficient pair or tank is the better board play.
          const totalHp = d.stats.hp * d.stats.count;
          const totalDmg = d.stats.dmg * d.stats.count;
          s = totalHp / 100 + totalDmg / 15 + d.stats.speed * 4 - d.cost * 0.35;
          if (foes.length >= 3 && d.stats.count > 1) s += 1.2;
          if (foes.some((u) => speciesDef(u.species).stats?.heavy) && d.stats.heavy) s += 0.8;
          if (foeFlyers > 0 && d.stats.canHitAir) s += 3.5;
          if (!foeAntiAir && d.stats.flying) s += 2.5;
        }
      }
      return s;
    };
    const scored = affordable.map((c) => ({ c, s: scoreCard(c) }));
    scored.sort((a, b) => b.s - a.s);
    if (strong && !flush && !punishing) {
      const shrineThreat = st.marbles.some((m) =>
        m.owner === this.seat && m.hp > 0 &&
        foes.some((u) => dist2(u.x, u.y, m.x, m.y) <= 4.5 * 4.5))
        || st.cannons.some((c) =>
          c.owner === this.seat && c.hp > 0 &&
          foes.some((u) => dist2(u.x, u.y, c.x, c.y) <= 4.5 * 4.5));
      const urgentDefense = shrineThreat || st.obelisks
        .filter((o) => o.owner === this.seat && o.hp > 0)
        .some((o) => foes.some((u) => dist2(u.x, u.y, o.x, o.y) <= 4.5 * 4.5));
      const bestAffordable = scored[0]?.s ?? -Infinity;
      const nearAffordableUpgrade = me.hand
        .map((c) => ({ c, d: cardDef(c, st.phase), s: scoreCard(c) }))
        .filter(({ d, s }) => d.kind === 'unit' && d.cost > me.aqua && d.cost - me.aqua <= 1.1 && s > bestAffordable + 1)
        .sort((a, b) => b.s - a.s)[0];
      if (!urgentDefense && nearAffordableUpgrade) return null;
    }
    // Walk the scored list: a spell being HELD for a better clump must not
    // stall the whole turn — pressure falls through to the best unit.
    let pick: CardId | null = null;
    for (const cand of scored) {
      const d = cardDef(cand.c, st.phase);
      if (d.kind === 'spell') {
        if (cand.c === LAVA_RAIN_CARD) continue; // handled above
        // Thicket hides YOUR knot. Sulfur burns THEIRS.
        const hide = cand.c === PHASE_SPELL_CARD && st.phase === 'oasis';
        const pool = st.units.filter((u) =>
          u.hp > 0 &&
          (hide
            ? u.owner === this.seat && inOwnHalf(this.seat, u.y)
            : u.owner !== this.seat && isCombatVisible(st, u)));
        if (pool.length === 0) continue;
        let best = pool[0];
        let bestN = 0;
        for (const e of pool) {
          const n = pool.filter((o) => dist2(o.x, o.y, e.x, e.y) <= 1.6 * 1.6).length;
          if (n > bestN) {
            bestN = n;
            best = e;
          }
        }
        if (bestN < 2 && !flush) continue; // hold it — try the next card
        this.nextActionTick = st.tick + (strong ? 2 : 4);
        return { type: 'spell', card: cand.c as CardId, x: best.x, y: best.y };
      }
      pick = cand.c as CardId;
      break;
    }
    if (pick === null) return null;
    const def = cardDef(pick, st.phase);
    if (def.kind === 'unit' && armySize(st, this.seat) >= currentArmyCap(st)) return null;

    const dirY = this.seat === 0 ? -1 : 1;
    if (st.phase === 'basalt') {
      const threatWing = homeBridgeThreat(st, this.seat);
      if (threatWing !== null) {
        const drop = basaltDefendAnchor(this.seat, threatWing);
        const flying = !!def.stats?.flying;
        const snap = snapBasaltFieldDrop(st, this.seat, drop.x, drop.y, flying) ?? drop;
        this.lastLane = threatWing;
        this.nextActionTick = st.tick + (punishing || strong ? 1 : 2);
        return { type: 'deploy', card: pick, x: snap.x, y: snap.y, dirX: 0, dirY };
      }
      const pads = fortPads(this.seat);
      const wings = st.obelisks.filter((o) => o.owner !== this.seat && o.hp > 0);
      // Default: counter-siege the emptier lane so both fortresses take
      // pressure in the same match. Blind focus on the weakest wing made
      // both bots converge on one corridor — the winner razed both gates
      // and the loser never scored even one (0% 1–1 trades).
      let lane: 0 | 1 = this.rng() < 0.5 ? 0 : 1;
      if (foes.length > 0) {
        const c0 = foes.filter((u) => Math.abs(u.x - pads[0].x) <= Math.abs(u.x - pads[1].x)).length;
        const c1 = foes.length - c0;
        lane = c0 <= c1 ? 0 : 1;
      }
      // Dual-lane squeeze: with aqua to burn, alternate wings on consecutive
      // deploys so the defense has to split its attention.
      if (flush && this.lastLane !== null) lane = (1 - this.lastLane) as 0 | 1;
      // Commit to a crumbling wing (finishing blow).
      if (wings.length > 0 && (strong || this.rng() < 0.65)) {
        const weakest = wings.reduce((a, b) => (b.hp < a.hp ? b : a));
        // Strong maintains objective focus from the opening deployment; Normal
        // only commits after a gate is already visibly weakened.
        if (strong || weakest.hp < weakest.maxHp * 0.55) lane = weakest.wing;
      }
      // Highest priority: defend a gate under real pressure.
      const myWings = st.obelisks.filter((o) => o.owner === this.seat && o.hp > 0);
      let danger: 0 | 1 | null = null;
      let dangerN = 0;
      for (const w of myWings) {
        const n = foes.filter((u) => dist2(u.x, u.y, w.x, w.y) <= 4.5 * 4.5).length;
        if (n > dangerN) {
          dangerN = n;
          danger = w.wing;
        }
      }
      if (danger !== null && dangerN >= (strong ? 3 : 2) && (strong || this.rng() < 0.85)) lane = danger;
      // Respect lane soft-cap so the bot doesn't invent mid-lane soup.
      const flying = !!def.stats?.flying;
      const chosen = preferDeployLane(st, this.seat, lane, flying, def.stats?.count ?? 1);
      if (chosen === null) return null;
      lane = chosen;
      const pad = pads[lane];
      this.lastLane = lane;
      this.nextActionTick = st.tick + (punishing || strong ? 1 : 2);
      return { type: 'deploy', card: pick, x: pad.x, y: pad.y, dirX: 0, dirY };
    }
    // Strong play aims its Oasis deployment through the enemy concentration
    // and toward the pond instead of scattering randomly across the baseline.
    const visibleFoes = foes.filter((u) => isCombatVisible(st, u));
    const targetX = strong && visibleFoes.length > 0
      ? visibleFoes.reduce((sum, u) => sum + u.x, 0) / visibleFoes.length
      : WORLD_W / 2;
    const spread = strong ? (this.rng() - 0.5) * 0.7 : (this.rng() - 0.5) * 5;
    const foeGun = st.cannons.find((c) => c.owner !== this.seat && c.hp > 0);
    const marble = st.marbles.find((m) => m.owner !== this.seat && m.hp > 0);
    const defendGun = st.cannons.find((c) => c.owner === this.seat && c.hp > 0);
    const defend = st.marbles.find((m) => m.owner === this.seat && m.hp > 0);
    const aimX = foeGun?.x ?? marble?.x ?? WORLD_W / 2;
    const x = Math.max(0.8, Math.min(WORLD_W - 0.8, (strong ? aimX : targetX) + spread));
    const myHalfDeep = this.seat === 0
      ? WORLD_H * 0.5 + 0.35 + this.rng() * (WORLD_H * 0.42)
      : 0.45 + this.rng() * (WORLD_H * 0.42);
    const gunPressed = defendGun && foes.some((u) => dist2(u.x, u.y, defendGun.x, defendGun.y) <= 4.2 * 4.2);
    const shrinePressed = defend && foes.some((u) => dist2(u.x, u.y, defend.x, defend.y) <= 4.2 * 4.2);
    const y = gunPressed
      ? (this.seat === 0 ? CANNON[0].padY + 0.35 : CANNON[1].padY - 0.35)
      : shrinePressed
        ? (this.seat === 0 ? SHRINE[0].doorY + 0.4 : SHRINE[1].doorY - 0.4)
        : myHalfDeep;
    this.nextActionTick = st.tick + (punishing || strong ? 1 : 2);
    return {
      type: 'deploy',
      card: pick,
      x,
      y,
      dirX: strong ? (WORLD_W / 2 - x) * 0.45 : (this.rng() - 0.5) * 0.8,
      dirY,
    };
  }
}
