import { BotBrain, advanceTick, createGame, resetIds } from '../src/engine';
import type { BotStrength, FactionId, GameState, PlayerId, PlayerInput } from '../src/types';
import { PHASE1_TICKS, PHASE2_TICKS, TRANSITION_TICKS } from '../src/types';

const MAX_TICKS = PHASE1_TICKS + TRANSITION_TICKS + PHASE2_TICKS + 5;

function runMatch(
  seed: number,
  factions: [FactionId, FactionId],
  strengths: [BotStrength, BotStrength],
): PlayerId | 'tie' {
  resetIds();
  const state: GameState = createGame(seed, factions);
  const bots = [
    new BotBrain(0, seed + 1, strengths[0]),
    new BotBrain(1, seed + 2, strengths[1]),
  ];
  let seq = 0;

  for (let i = 0; i < MAX_TICKS && state.phase !== 'ended'; i++) {
    const inputs: PlayerInput[] = [];
    for (const seat of [0, 1] as const) {
      const action = bots[seat].think(state);
      if (action) inputs.push({ seq: ++seq, player: seat, tick: state.tick + 1, action });
    }
    advanceTick(state, inputs);
  }

  if (state.winner === null) throw new Error(`Match ${seed} did not finish`);
  return state.winner;
}

let strongWins = 0;
let normalWins = 0;
let ties = 0;
const breakdown: Record<string, { wins: number; losses: number; ties: number }> = {};
const matches = 80;

for (let i = 0; i < matches; i++) {
  const strongSeat: PlayerId = i % 2 as PlayerId;
  // Mirror factions to isolate decision quality from roster balance.
  const factions: [FactionId, FactionId] = i % 4 < 2
    ? ['magma', 'magma']
    : ['oasis', 'oasis'];
  const strengths: [BotStrength, BotStrength] = strongSeat === 0
    ? ['strong', 'normal']
    : ['normal', 'strong'];
  const key = `${factions[strongSeat]}-seat${strongSeat}`;
  breakdown[key] ??= { wins: 0, losses: 0, ties: 0 };
  const winner = runMatch((i + 1) * 104729, factions, strengths);
  if (winner === 'tie') {
    ties++;
    breakdown[key].ties++;
  } else if (winner === strongSeat) {
    strongWins++;
    breakdown[key].wins++;
  } else {
    normalWins++;
    breakdown[key].losses++;
  }
}

const decisive = strongWins + normalWins;
const strongRate = decisive > 0 ? strongWins / decisive : 0;
console.log({ matches, strongWins, normalWins, ties, strongRate, breakdown });

if (strongRate < 0.6) {
  throw new Error(`Strong bot won only ${(strongRate * 100).toFixed(1)}% of decisive matches`);
}
