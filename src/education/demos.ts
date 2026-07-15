/**
 * Listening examples for the Intro to Music Theory classroom.
 *
 * Every demo is a timeline of TheoryEvents rendered LIVE by the score
 * engine's own instruments (src/audio.ts), built from the same data tables
 * the battle soundtrack plays — so what the student hears in the classroom
 * is literally the music of Vaalbara, excerpted and isolated for teaching.
 *
 * Grid: 100 BPM, 4/4. One sixteenth = 0.15 s, one beat = 0.6 s, one bar = 2.4 s.
 */

import type { TheoryCall, TheoryEvent } from '../audio';
import { MUSIC_16TH_SEC, scoreTables } from '../audio';

export const S = MUSIC_16TH_SEC;
export const BEAT = S * 4;
export const BAR = S * 16;

export interface TheoryDemo {
  /** Total seconds, including the ringing tail. */
  duration: number;
  events: TheoryEvent[];
  /** Narration timeline for guided (card) examples. */
  captions?: Array<{ at: number; text: string }>;
  /** Highlight times (s) parallel to an attached notation's note list. */
  noteTimes?: number[];
}

const ev = (at: number, call: TheoryCall): TheoryEvent => ({ at, call });

/* Pitch constants (Hz) used by the lessons. */
export const HZ = {
  D3: 146.83, E3: 164.81, F3: 174.61, G3: 196, A3: 220, Bb3: 233.08, C4: 261.63, Cs4: 277.18,
  D4: 293.66, E4: 329.63, F4: 349.23, G4: 392, A4: 440, Bb4: 466.16, C5: 523.25, Cs5: 554.37, D5: 587.33,
} as const;

const CHORD_ROMAN = ['i', 'VI', 'iv', 'V'] as const;
const CHORD_NAMES = ['D minor', 'B♭ major', 'G minor', 'A major'] as const;
export { CHORD_ROMAN, CHORD_NAMES };

/* ----------------------------- shared figures ---------------------------- */

/** The soft "piano" seed voice the score uses in minutes 1–2. */
function seedNote(events: TheoryEvent[], at: number, freq: number, dur: number, gain = 0.055): void {
  events.push(
    ev(at, { kind: 'voice', opts: { type: 'triangle', freq, dur: dur + 0.25, gain, attack: 0.006, pan: 0.12 } }),
    ev(at, { kind: 'voice', opts: { type: 'sine', freq: freq * 2.002, dur: dur * 0.5 + 0.12, gain: gain * 0.35, attack: 0.006, pan: -0.15 } }),
  );
}

/** One bar of harmonic floor: sustained strings + cello + sub bass root. */
function chordFloor(events: TheoryEvent[], at: number, chord: number, opts?: { gain?: number; dur?: number; taiko?: boolean }): void {
  const gain = opts?.gain ?? 0.024;
  const dur = opts?.dur ?? 2.5;
  events.push(
    ev(at, { kind: 'legato', freqs: [...scoreTables.bedChords[chord]], dur, gain, filterHz: 900, pos: 1 }),
    ev(at, { kind: 'cello', freq: scoreTables.cello[chord], dur: dur - 0.1, gain: 0.07 }),
    ev(at, { kind: 'voice', opts: { type: 'sawtooth', freq: scoreTables.bass[chord], dur: dur - 0.3, gain: 0.2, filterFreq: 130, attack: 0.03 } }),
  );
  if (opts?.taiko) events.push(ev(at, { kind: 'taiko', big: true, vel: 0.8 }));
}

/** The score's suspense ostinato — one bar of the given progression cell. */
function ostinatoBar(events: TheoryEvent[], at: number, chord: number, vel = 0.62, sixteenths = false): void {
  const cell = scoreTables.ostinato[chord];
  for (let i = 0; i < 16; i++) {
    if (!sixteenths && i % 2 === 1) continue;
    const accent = i % 4 === 0 ? 1.25 : 0.85;
    events.push(ev(at + i * S, { kind: 'stringNote', freq: cell[i], vel: accent * vel, dur: 0.14, filterHz: 1600 }));
  }
}

/** Off-beat tick hats exactly as the score rides them (odd sixteenths). */
function scoreHats(events: TheoryEvent[], at: number, bars: number, vel = 0.7): void {
  for (let b = 0; b < bars; b++) {
    for (let i = 1; i < 16; i += 2) {
      events.push(ev(at + b * BAR + i * S, { kind: 'hat', vel: (i % 4 === 3 ? 1 : 0.55) * vel }));
    }
  }
}

/** The minute-5 drummer's relentless sixteenth tom groove, one bar. */
function tomGrooveBar(events: TheoryEvent[], at: number, level = 1): void {
  for (let i = 0; i < 16; i++) {
    const acc = i % 4 === 0 ? 1 : i % 2 === 0 ? 0.7 : 0.42;
    events.push(ev(at + i * S, { kind: 'tom', freq: i % 8 < 4 ? 110 : 88, vel: acc * 0.98 * level }));
  }
}

/** Driving eighth kick between the quarters (the min-5 pattern). */
function driveKickBar(events: TheoryEvent[], at: number, level = 1): void {
  for (let i = 0; i < 16; i += 2) {
    if (i % 4 === 0) continue;
    events.push(ev(at + i * S, { kind: 'kick', vel: 0.8 * level }));
  }
}

/** Turnaround fill: snare-and-tom run up the last beat, flam at its end. */
function turnaroundFill(events: TheoryEvent[], at: number, level = 1): void {
  for (let i = 12; i < 16; i++) {
    events.push(
      ev(at + i * S, { kind: 'snare', vel: (0.4 + (i - 12) * 0.16) * level }),
      ev(at + i * S, { kind: 'tom', freq: 150 - (i - 12) * 18, vel: (0.6 + (i - 12) * 0.1) * level }),
    );
  }
  events.push(ev(at + 15 * S + 0.075, { kind: 'tom', freq: 78, vel: 0.9 * level }));
}

/* ------------------------------ 1 · Key ---------------------------------- */

function scaleDemo(seventh: number): TheoryDemo {
  const notes = [HZ.D4, HZ.E4, HZ.F4, HZ.G4, HZ.A4, HZ.Bb4, seventh, HZ.D5];
  const events: TheoryEvent[] = [];
  const noteTimes = notes.map((_, i) => i * BEAT);
  notes.forEach((freq, i) => seedNote(events, i * BEAT, freq, i === notes.length - 1 ? 1.1 : 0.5));
  return { duration: 8 * BEAT + 1.4, events, noteTimes };
}

function tonicGravity(): TheoryDemo {
  const events: TheoryEvent[] = [];
  chordFloor(events, 0, 0, { dur: 4.7, gain: 0.02 });
  // A wandering line that only rests when it lands on the tonic D.
  const line: Array<[number, number, number]> = [
    [0, HZ.F4, 0.55], [BEAT, HZ.G4, 0.55], [2 * BEAT, HZ.E4, 0.55], [3 * BEAT, HZ.A4, 0.55],
    [4 * BEAT, HZ.E4, 0.55], [5 * BEAT, HZ.D4, 2.2],
  ];
  for (const [at, freq, dur] of line) events.push(ev(at, { kind: 'horn', freq, dur, gain: 0.085 }));
  events.push(ev(5 * BEAT, { kind: 'harp', freq: HZ.D5, gain: 0.045, pan: 0.2 }));
  return { duration: 5 * BEAT + 2.8, events };
}

function ostinatoPulse(): TheoryDemo {
  const events: TheoryEvent[] = [];
  for (let b = 0; b < 2; b++) {
    chordFloor(events, b * BAR, 0, { gain: 0.016, taiko: true });
    ostinatoBar(events, b * BAR, 0, 0.62);
  }
  return { duration: 2 * BAR + 1.2, events };
}

/* --------------------------- 2 · Chords ---------------------------------- */

function singleChord(chord: number): TheoryDemo {
  const events: TheoryEvent[] = [];
  chordFloor(events, 0, chord, { gain: 0.03, dur: 2.6, taiko: true });
  return { duration: 3.4, events };
}

function progressionLoop(): TheoryDemo {
  const events: TheoryEvent[] = [];
  for (let b = 0; b < 8; b++) {
    const chord = b % 4;
    chordFloor(events, b * BAR, chord, { taiko: true });
    events.push(ev(b * BAR + 10 * S, { kind: 'taiko', big: false, vel: 0.8 }));
    ostinatoBar(events, b * BAR, chord, 0.5);
  }
  scoreHats(events, 0, 8, 0.5);
  return {
    duration: 8 * BAR + 1.2,
    events,
    noteTimes: Array.from({ length: 8 }, (_, b) => b * BAR),
  };
}

function cadenceDemo(): TheoryDemo {
  const events: TheoryEvent[] = [];
  chordFloor(events, 0, 2, { taiko: true });                  // iv — G minor
  chordFloor(events, BAR, 3, { taiko: true });                // V — A major
  events.push(ev(BAR, { kind: 'horn', freq: HZ.Cs4, dur: 2.3, gain: 0.09 })); // the leading tone, held
  chordFloor(events, 2 * BAR, 0, { taiko: true });            // i — home
  events.push(
    ev(2 * BAR, { kind: 'horn', freq: HZ.D4, dur: 2.3, gain: 0.095 }),
    ev(2 * BAR, { kind: 'harp', freq: HZ.D5, gain: 0.05, pan: 0.15 }),
  );
  chordFloor(events, 3 * BAR, 0, { gain: 0.018, dur: 2.2 });
  return { duration: 4 * BAR + 1.2, events, noteTimes: [0, BAR, 2 * BAR] };
}

function suspensionDemo(): TheoryDemo {
  const events: TheoryEvent[] = [];
  // The score's own 4–3 suspension: Asus4 holds D, then resolves to C#.
  events.push(ev(0, { kind: 'legato', freqs: [...scoreTables.aSus4], dur: 1.25, gain: 0.028, filterHz: 900, pos: 1 }));
  events.push(ev(0, { kind: 'horn', freq: HZ.D4, dur: 1.25, gain: 0.09 }));
  events.push(ev(1.2, { kind: 'legato', freqs: [...scoreTables.bedChords[3]], dur: 1.3, gain: 0.028, filterHz: 900, pos: 1 }));
  events.push(ev(1.2, { kind: 'horn', freq: HZ.Cs4, dur: 1.3, gain: 0.09 }));
  chordFloor(events, 2.4, 0, { taiko: true });
  events.push(ev(2.4, { kind: 'horn', freq: HZ.D4, dur: 2.2, gain: 0.09 }));
  return { duration: 2.4 + BAR + 1, events };
}

/* --------------------------- 3 · Melody ---------------------------------- */

function themeDemo(notes: ReadonlyArray<readonly [number, number, number]>, beds: number[]): TheoryDemo {
  const events: TheoryEvent[] = [];
  beds.forEach((chord, b) => chordFloor(events, b * BAR, chord, { gain: 0.018, taiko: true }));
  const noteTimes: number[] = [];
  for (const [st, freq, durSteps] of notes) {
    noteTimes.push(st * S);
    events.push(ev(st * S, { kind: 'horn', freq, dur: durSteps * S + 0.12, gain: 0.1 }));
  }
  return { duration: beds.length * BAR + 1.6, events, noteTimes };
}

function fragmentDemo(): TheoryDemo {
  const events: TheoryEvent[] = [];
  for (const [st, freq, durSteps] of scoreTables.themeFrag) {
    seedNote(events, st * S, freq * 2, durSteps * S, 0.05);
  }
  return { duration: 20 * S + 1.6, events, noteTimes: scoreTables.themeFrag.map(([st]) => st * S) };
}

function phraseArrival(): TheoryDemo {
  const events: TheoryEvent[] = [];
  // Cycle's last two bars (iv, V) — the cello answer pulls C# against A…
  chordFloor(events, 0, 2, { taiko: true });
  ostinatoBar(events, 0, 2, 0.55);
  chordFloor(events, BAR, 3, { taiko: true });
  ostinatoBar(events, BAR, 3, 0.55);
  for (const [st, freq, durSteps] of scoreTables.celloAnswer) {
    events.push(ev(st * S, { kind: 'cello', freq, dur: durSteps * S + 0.15, gain: 0.075 }));
  }
  events.push(ev(BAR + 8 * S, { kind: 'swell', dur: 1.15, gain: 0.028 }));
  // …and Theme A ARRIVES on the Dm downbeat of the new cycle.
  events.push(
    ev(2 * BAR, { kind: 'taiko', big: true, vel: 1.1 }),
    ev(2 * BAR, { kind: 'crash', gain: 0.09 }),
  );
  chordFloor(events, 2 * BAR, 0, { gain: 0.02 });
  chordFloor(events, 3 * BAR, 1, { gain: 0.02, taiko: true });
  for (const [st, freq, durSteps] of scoreTables.themeA) {
    events.push(ev(2 * BAR + st * S, { kind: 'horn', freq, dur: durSteps * S + 0.12, gain: 0.105 }));
  }
  return { duration: 4 * BAR + 1.6, events };
}

/* --------------------------- 4 · Harmony --------------------------------- */

function intervalDemo(low: number, high: number): TheoryDemo {
  const events: TheoryEvent[] = [];
  events.push(ev(0, { kind: 'pad', freqs: [low], dur: 3.1, gain: 0.05 }));
  events.push(ev(0.9, { kind: 'pad', freqs: [high], dur: 2.2, gain: 0.05 }));
  return { duration: 3.8, events };
}

function eagleDuet(): TheoryDemo {
  const events: TheoryEvent[] = [];
  // The score's actual Eagle phrase tables (basalt): lead + harmony calls.
  const leadCalls: Array<[number, number]> = [[880, 698.5], [698.5, 587.3], [784, 587.3], [659.3, 554.4]];
  const harmonyCalls: Array<[number, number]> = [[698.5, 587.3], [587.3, 466.2], [587.3, 466.2], [554.4, 440]];
  for (let b = 0; b < 8; b++) {
    const chord = b % 4;
    const at = b * BAR;
    chordFloor(events, at, chord, { gain: 0.016 });
    const callAt = at + 8 * S; // beat 3, exactly where the score sings it
    const [leadA, leadB] = leadCalls[chord];
    events.push(
      ev(callAt, { kind: 'eagle', freq: leadA, gain: 0.036, pan: -0.22, entry: b === 0 }),
      ev(callAt + 0.62, { kind: 'eagle', freq: leadB, gain: 0.03, pan: -0.14 }),
    );
    if (b >= 4) {
      const [harmonyA, harmonyB] = harmonyCalls[chord];
      events.push(
        ev(callAt + 0.035, { kind: 'eagle', freq: harmonyA, gain: 0.026, pan: 0.22 }),
        ev(callAt + 0.655, { kind: 'eagle', freq: harmonyB, gain: 0.023, pan: 0.14 }),
      );
    }
  }
  return {
    duration: 8 * BAR + 1.4,
    events,
    captions: [
      { at: 0, text: 'The chord bed loops underneath: D minor → B♭ → G minor → A…' },
      { at: 1.1, text: 'One Eagle sings a two-note call on beat 3 — each pair descends through the CURRENT chord\'s own tones.' },
      { at: 5.6, text: 'Bar to bar the call moves by small steps, not leaps. That smoothness is called voice leading.' },
      { at: 9.6, text: 'Now a second Eagle joins BELOW the first — in consonant thirds and sixths.' },
      { at: 14.6, text: 'Two voices moving together, chord by chord: the Eagles are literally singing the harmony.' },
    ],
  };
}

function beeHive(): TheoryDemo {
  const events: TheoryEvent[] = [];
  for (let b = 0; b < 8; b++) {
    const chord = b % 4;
    const at = b * BAR;
    chordFloor(events, at, chord, { gain: 0.014 });
    for (let e = 0; e < 8; e++) {
      events.push(ev(at + e * MUSIC_16TH_SEC * 2, {
        kind: 'bee',
        gain: 0.03,
        harmony: b >= 4 ? 1 : 0,
        harmonyFreq: chord === 3 ? 277.2 : 293.7,
      }));
    }
  }
  return {
    duration: 8 * BAR + 1,
    events,
    captions: [
      { at: 0, text: 'One swarm hums a DRONE on the note A. A is the fifth of D minor — and it belongs to every chord in our loop.' },
      { at: 4.9, text: 'The chords change underneath, but the hum holds still. Feel the gentle tension over B♭ and G minor, the release over Dm and A.' },
      { at: 9.6, text: 'A second swarm joins on D — now the hive is singing the key\'s home note above its drone.' },
      { at: 14.5, text: 'And on the A chord, the harmony bends up to C♯ — the LEADING TONE — pulling the whole loop home to D.' },
    ],
  };
}

/* ---------------------- 5 · Time Signature / Rhythm ----------------------- */

function measuresDemo(): TheoryDemo {
  const events: TheoryEvent[] = [];
  const noteTimes: number[] = [];
  for (let b = 0; b < 4; b++) {
    for (let beat = 0; beat < 4; beat++) {
      const at = b * BAR + beat * BEAT;
      noteTimes.push(at);
      if (beat === 0) {
        events.push(ev(at, { kind: 'taiko', big: true, vel: 1 }));
      } else {
        events.push(ev(at, { kind: 'kick', vel: 0.5 }));
      }
    }
  }
  return { duration: 4 * BAR + 0.8, events, noteTimes };
}

function noteValueDemo(kind: 'whole' | 'quarter' | 'eighth' | 'sixteenth'): TheoryDemo {
  const events: TheoryEvent[] = [];
  const noteTimes: number[] = [];
  for (let b = 0; b < 2; b++) {
    const at = b * BAR;
    // Quarter-note kick reference pulse under every example except itself.
    for (let beat = 0; beat < 4; beat++) {
      events.push(ev(at + beat * BEAT, { kind: 'kick', vel: kind === 'quarter' ? 0.95 : 0.55 }));
      if (kind === 'quarter') noteTimes.push(at + beat * BEAT);
    }
    if (kind === 'whole') {
      noteTimes.push(at);
      events.push(ev(at, { kind: 'legato', freqs: [...scoreTables.bedChords[0]], dur: 2.35, gain: 0.028, filterHz: 900, pos: 1 }));
    } else if (kind === 'eighth') {
      for (let i = 0; i < 16; i += 2) {
        noteTimes.push(at + i * S);
        events.push(ev(at + i * S, { kind: 'stringNote', freq: HZ.D3, vel: i % 4 === 0 ? 0.85 : 0.6, dur: 0.14, filterHz: 1600 }));
      }
    } else if (kind === 'sixteenth') {
      for (let i = 0; i < 16; i++) {
        noteTimes.push(at + i * S);
        const acc = i % 4 === 0 ? 1 : i % 2 === 0 ? 0.7 : 0.42;
        events.push(ev(at + i * S, { kind: 'tom', freq: i % 8 < 4 ? 110 : 88, vel: acc * 0.9 }));
      }
    }
  }
  return { duration: 2 * BAR + 1, events, noteTimes };
}

function syncopationDemo(): TheoryDemo {
  const events: TheoryEvent[] = [];
  for (let b = 0; b < 4; b++) {
    const at = b * BAR;
    for (let beat = 0; beat < 4; beat++) {
      events.push(ev(at + beat * BEAT, { kind: 'kick', vel: 0.85 }));
      if (b < 2) events.push(ev(at + beat * BEAT, { kind: 'hat', vel: 1.1 }));
    }
    if (b >= 2) {
      // Accents shift to the "and" of every beat — the off-beats.
      for (let i = 2; i < 16; i += 4) {
        events.push(ev(at + i * S, { kind: 'hat', vel: 1.35 }));
      }
    }
  }
  return {
    duration: 4 * BAR + 0.8,
    events,
    captions: [
      { at: 0, text: 'First, accents ON the beat: 1, 2, 3, 4. Square and steady.' },
      { at: 4.8, text: 'Now the accents move BETWEEN the beats — onto the "and" of each beat. That forward lean is syncopation.' },
    ],
  };
}

function fireAntSixteenths(): TheoryDemo {
  const events: TheoryEvent[] = [];
  const bite = (at: number, i: number): TheoryEvent =>
    ev(at, { kind: 'noise', opts: { dur: 0.022, gain: 0.1, filterFreq: 2800 + i * 200, filterType: 'bandpass' } });
  for (let b = 0; b < 4; b++) {
    const at = b * BAR;
    for (let beat = 0; beat < 4; beat++) events.push(ev(at + beat * BEAT, { kind: 'kick', vel: 0.8 }));
    if (b >= 1) {
      // The four-bite figure fills beats 2 and 4 with true sixteenths.
      for (const beat of [1, 3]) {
        for (let i = 0; i < 4; i++) events.push(bite(at + beat * BEAT + i * S, i));
      }
    }
  }
  return {
    duration: 4 * BAR + 0.6,
    events,
    captions: [
      { at: 0, text: 'The pulse: quarter notes at 100 beats per minute.' },
      { at: 2.4, text: 'The Fire Ants bite in SIXTEENTH notes — four even strikes packed into a single beat.' },
      { at: 7.2, text: 'Count with them: "1 e & a". Four sixteenths per beat, sixteen per measure.' },
    ],
  };
}

/* --------------------------- 6 · Percussion ------------------------------- */

function kitPiece(kind: 'kick' | 'snare' | 'hat' | 'tom' | 'crash' | 'taiko'): TheoryDemo {
  const events: TheoryEvent[] = [];
  if (kind === 'kick') {
    for (let i = 0; i < 8; i++) events.push(ev(i * BEAT, { kind: 'kick', vel: 1 }));
    return { duration: 8 * BEAT + 0.6, events };
  }
  if (kind === 'snare') {
    for (let i = 0; i < 8; i++) events.push(ev(i * BEAT, { kind: 'snare', vel: 0.95 }));
    return { duration: 8 * BEAT + 0.6, events };
  }
  if (kind === 'hat') {
    scoreHats(events, 0, 2, 1);
    for (let b = 0; b < 2; b++) for (let beat = 0; beat < 4; beat++) events.push(ev(b * BAR + beat * BEAT, { kind: 'kick', vel: 0.4 }));
    return { duration: 2 * BAR + 0.5, events };
  }
  if (kind === 'tom') {
    const freqs = [150, 132, 110, 88];
    for (let r = 0; r < 2; r++) freqs.forEach((freq, i) => events.push(ev(r * BAR + i * BEAT, { kind: 'tom', freq, vel: 0.95 })));
    return { duration: 2 * BAR + 0.6, events };
  }
  if (kind === 'crash') {
    events.push(ev(0, { kind: 'crash', gain: 0.13 }), ev(1.8, { kind: 'crash', gain: 0.1 }));
    return { duration: 3.4, events };
  }
  events.push(
    ev(0, { kind: 'taiko', big: true, vel: 1.1 }),
    ev(0.6, { kind: 'taiko', big: false, vel: 0.8 }),
    ev(1.2, { kind: 'taiko', big: true, vel: 1 }),
    ev(1.35, { kind: 'taiko', big: false, vel: 0.7 }),
  );
  return { duration: 2.6, events };
}

function backbeat(mix: boolean): TheoryDemo {
  const events: TheoryEvent[] = [];
  const bars = mix ? 4 : 2;
  for (let b = 0; b < bars; b++) {
    const at = b * BAR;
    const chord = b % 4;
    events.push(
      ev(at, { kind: 'kick', vel: 1 }),
      ev(at + 2 * BEAT, { kind: 'kick', vel: 0.9 }),
      ev(at + BEAT, { kind: 'snare', vel: 0.95 }),
      ev(at + 3 * BEAT, { kind: 'snare', vel: 0.95 }),
    );
    scoreHats(events, at, 1, 0.55);
    if (mix) {
      // Minute-4 verse: power-chord riff + chugs + the bed, crash each cycle.
      const root = scoreTables.bedChords[chord][0];
      chordFloor(events, at, chord, { gain: 0.02 });
      events.push(ev(at, { kind: 'powerChord', freq: root, dur: 1.15, gain: 0.05 }));
      events.push(
        ev(at + 6 * S, { kind: 'powerChord', freq: root, dur: 0.28, gain: 0.038, pan: -0.2 }),
        ev(at + 10 * S, { kind: 'powerChord', freq: root, dur: 0.28, gain: 0.038, pan: 0.2 }),
      );
      if (b === 0) events.push(ev(at, { kind: 'crash', gain: 0.09 }));
    }
  }
  return { duration: bars * BAR + 1, events };
}

function tomGroove(mix: boolean): TheoryDemo {
  const events: TheoryEvent[] = [];
  const bars = mix ? 4 : 2;
  for (let b = 0; b < bars; b++) {
    const at = b * BAR;
    tomGrooveBar(events, at);
    if (mix) {
      const chord = b % 4;
      const root = scoreTables.bedChords[chord][0];
      driveKickBar(events, at);
      events.push(
        ev(at + BEAT, { kind: 'snare', vel: 1.1 }),
        ev(at + 3 * BEAT, { kind: 'snare', vel: 1.1 }),
      );
      if (b % 2 === 0) events.push(ev(at, { kind: 'crash', gain: 0.1 }));
      chordFloor(events, at, chord, { gain: 0.02 });
      events.push(ev(at, { kind: 'powerChord', freq: root, dur: 1.15, gain: 0.05 }));
      scoreHats(events, at, 1, 0.5);
    }
  }
  return { duration: bars * BAR + 1, events };
}

function fillDemo(mix: boolean): TheoryDemo {
  const events: TheoryEvent[] = [];
  const bars = mix ? 4 : 2;
  for (let b = 0; b < bars; b++) {
    const at = b * BAR;
    const fillBar = b % 2 === 1;
    if (mix) {
      const chord = b % 4;
      chordFloor(events, at, chord, { gain: 0.02 });
      events.push(ev(at, { kind: 'powerChord', freq: scoreTables.bedChords[chord][0], dur: 1.15, gain: 0.048 }));
      scoreHats(events, at, 1, 0.5);
    }
    if (b % 2 === 0) events.push(ev(at, { kind: 'crash', gain: mix ? 0.1 : 0.08 }));
    events.push(
      ev(at, { kind: 'kick', vel: 1 }),
      ev(at + 2 * BEAT, { kind: 'kick', vel: 0.85 }),
      ev(at + BEAT, { kind: 'snare', vel: 0.9 }),
    );
    if (fillBar) {
      turnaroundFill(events, at);
    } else {
      events.push(ev(at + 3 * BEAT, { kind: 'snare', vel: 0.9 }));
    }
  }
  events.push(ev(bars * BAR, { kind: 'crash', gain: 0.12 }), ev(bars * BAR, { kind: 'kick', vel: 1.05 }));
  return { duration: bars * BAR + 1.6, events };
}

function halfTime(mix: boolean): TheoryDemo {
  const events: TheoryEvent[] = [];
  if (!mix) {
    for (let b = 0; b < 2; b++) {
      const at = b * BAR;
      events.push(
        ev(at, { kind: 'kick', vel: 1.1 }),
        ev(at, { kind: 'crash', gain: 0.08 }),
        ev(at + 2 * BEAT, { kind: 'snare', vel: 1.25 }),
        ev(at + 2 * BEAT, { kind: 'tom', freq: 88, vel: 0.9 }),
      );
    }
    return { duration: 2 * BAR + 1.2, events };
  }
  // Two driving bars, then the kit opens to half-time — mass with room.
  for (let b = 0; b < 2; b++) {
    const at = b * BAR;
    const chord = b % 4;
    tomGrooveBar(events, at);
    driveKickBar(events, at);
    events.push(ev(at + BEAT, { kind: 'snare', vel: 1.05 }), ev(at + 3 * BEAT, { kind: 'snare', vel: 1.05 }));
    if (b === 0) events.push(ev(at, { kind: 'crash', gain: 0.1 }));
    chordFloor(events, at, chord, { gain: 0.02 });
    events.push(ev(at, { kind: 'powerChord', freq: scoreTables.bedChords[chord][0], dur: 1.15, gain: 0.048 }));
  }
  for (let b = 2; b < 4; b++) {
    const at = b * BAR;
    const chord = b % 4;
    events.push(
      ev(at, { kind: 'kick', vel: 1.1 }),
      ev(at, { kind: 'crash', gain: 0.09 }),
      ev(at + 2 * BEAT, { kind: 'snare', vel: 1.3 }),
      ev(at + 2 * BEAT, { kind: 'tom', freq: 88, vel: 0.9 }),
    );
    chordFloor(events, at, chord, { gain: 0.022 });
    events.push(
      ev(at, { kind: 'powerChord', freq: scoreTables.bedChords[chord][0], dur: 2.3, gain: 0.05 }),
      ev(at, { kind: 'lowBrass', freq: scoreTables.cello[chord], dur: 2.3, gain: 0.05 }),
    );
  }
  return { duration: 4 * BAR + 1.4, events };
}

function suckoutSlam(): TheoryDemo {
  const events: TheoryEvent[] = [];
  // Bar 0 — full minute-5 groove on iv (G minor).
  tomGrooveBar(events, 0);
  driveKickBar(events, 0);
  events.push(ev(BEAT, { kind: 'snare', vel: 1.05 }), ev(3 * BEAT, { kind: 'snare', vel: 1.05 }));
  events.push(ev(0, { kind: 'crash', gain: 0.1 }));
  chordFloor(events, 0, 2, { gain: 0.02 });
  events.push(ev(0, { kind: 'powerChord', freq: scoreTables.bedChords[2][0], dur: 1.15, gain: 0.05 }));
  scoreHats(events, 0, 1, 0.5);
  // Bar 1 — the GATHERING on V (A): two unison stabs, then the suckout.
  const at1 = BAR;
  chordFloor(events, at1, 3, { gain: 0.018, dur: 1.1 });
  events.push(
    ev(at1, { kind: 'stab', root: scoreTables.bedChords[3][0], vel: 1.05 }),
    ev(at1 + BEAT, { kind: 'stab', root: scoreTables.bedChords[3][0], vel: 1.1 }),
  );
  events.push(ev(at1 + 2 * BEAT, {
    kind: 'voice',
    opts: { type: 'sine', freq: scoreTables.cello[3], freqEnd: 30, dur: 0.55, gain: 0.34 },
  }));
  events.push(ev(at1 + 2 * BEAT, { kind: 'swell', dur: 1.15, gain: 0.032 }));
  for (let i = 8; i < 16; i++) {
    events.push(ev(at1 + i * S, { kind: 'snare', vel: 0.22 + (i - 8) * 0.075 }));
  }
  // Bar 2 — THE SLAM, with Theme A landing on the same Dm downbeat.
  const at2 = 2 * BAR;
  events.push(
    ev(at2, { kind: 'taiko', big: true, vel: 1.25 }),
    ev(at2, { kind: 'crash', gain: 0.14 }),
    ev(at2, { kind: 'snare', vel: 1.15 }),
    ev(at2, { kind: 'powerChord', freq: scoreTables.bedChords[0][0], dur: 1.2, gain: 0.07 }),
    ev(at2, { kind: 'braam', freq: 73.4, dur: 1.85, gain: 0.5 }),
  );
  chordFloor(events, at2, 0, { gain: 0.02 });
  chordFloor(events, at2 + BAR, 1, { gain: 0.02 });
  for (const [st, freq, durSteps] of scoreTables.themeA) {
    events.push(ev(at2 + st * S, { kind: 'horn', freq, dur: durSteps * S + 0.12, gain: 0.115 }));
  }
  for (let b = 2; b < 4; b++) {
    tomGrooveBar(events, b * BAR, 0.85);
    driveKickBar(events, b * BAR, 0.9);
    events.push(ev(b * BAR + BEAT, { kind: 'snare', vel: 1 }), ev(b * BAR + 3 * BEAT, { kind: 'snare', vel: 1 }));
  }
  events.push(ev(3 * BAR, { kind: 'crash', gain: 0.09 }));
  return {
    duration: 4 * BAR + 2,
    events,
    captions: [
      { at: 0, text: 'Fortissimo — the full groove, wall of guitars and toms.' },
      { at: 2.35, text: 'The gathering: two unison stabs… then the floor DROPS OUT. Only a snare roll swells through the silence — that\'s the suckout.' },
      { at: 4.75, text: 'THE SLAM — and Theme A lands WITH it, on the downbeat of a new cycle. Maximum tension, then release: dynamics telling the story.' },
    ],
  };
}

/* ------------------------------- registry -------------------------------- */

export type DemoId =
  | 'scale-natural' | 'scale-harmonic' | 'tonic-gravity' | 'ostinato-pulse'
  | 'chord-i' | 'chord-VI' | 'chord-iv' | 'chord-V' | 'progression-loop' | 'cadence' | 'suspension'
  | 'theme-a' | 'theme-b' | 'theme-frag' | 'phrase-arrival'
  | 'interval-p5' | 'interval-m3' | 'interval-M3' | 'interval-m2' | 'eagle-duet' | 'bee-hive'
  | 'measures' | 'note-whole' | 'note-quarter' | 'note-eighth' | 'note-sixteenth' | 'syncopation' | 'fireants-16ths'
  | 'kit-kick' | 'kit-snare' | 'kit-hat' | 'kit-tom' | 'kit-crash' | 'kit-taiko'
  | 'backbeat-iso' | 'backbeat-mix' | 'tom-groove-iso' | 'tom-groove-mix'
  | 'fill-iso' | 'fill-mix' | 'halftime-iso' | 'halftime-mix' | 'suckout-slam';

const BUILDERS: Record<DemoId, () => TheoryDemo> = {
  'scale-natural': () => scaleDemo(HZ.C5),
  'scale-harmonic': () => scaleDemo(HZ.Cs5),
  'tonic-gravity': tonicGravity,
  'ostinato-pulse': ostinatoPulse,
  'chord-i': () => singleChord(0),
  'chord-VI': () => singleChord(1),
  'chord-iv': () => singleChord(2),
  'chord-V': () => singleChord(3),
  'progression-loop': progressionLoop,
  'cadence': cadenceDemo,
  'suspension': suspensionDemo,
  'theme-a': () => themeDemo(scoreTables.themeA, [0, 1]),
  'theme-b': () => themeDemo(scoreTables.themeB, [0, 1]),
  'theme-frag': fragmentDemo,
  'phrase-arrival': phraseArrival,
  'interval-p5': () => intervalDemo(HZ.D3, HZ.A3),
  'interval-m3': () => intervalDemo(HZ.D4, HZ.F4),
  'interval-M3': () => intervalDemo(HZ.Bb3, HZ.D4),
  'interval-m2': () => intervalDemo(HZ.Cs4, HZ.D4),
  'eagle-duet': eagleDuet,
  'bee-hive': beeHive,
  'measures': measuresDemo,
  'note-whole': () => noteValueDemo('whole'),
  'note-quarter': () => noteValueDemo('quarter'),
  'note-eighth': () => noteValueDemo('eighth'),
  'note-sixteenth': () => noteValueDemo('sixteenth'),
  'syncopation': syncopationDemo,
  'fireants-16ths': fireAntSixteenths,
  'kit-kick': () => kitPiece('kick'),
  'kit-snare': () => kitPiece('snare'),
  'kit-hat': () => kitPiece('hat'),
  'kit-tom': () => kitPiece('tom'),
  'kit-crash': () => kitPiece('crash'),
  'kit-taiko': () => kitPiece('taiko'),
  'backbeat-iso': () => backbeat(false),
  'backbeat-mix': () => backbeat(true),
  'tom-groove-iso': () => tomGroove(false),
  'tom-groove-mix': () => tomGroove(true),
  'fill-iso': () => fillDemo(false),
  'fill-mix': () => fillDemo(true),
  'halftime-iso': () => halfTime(false),
  'halftime-mix': () => halfTime(true),
  'suckout-slam': suckoutSlam,
};

const cache = new Map<DemoId, TheoryDemo>();

export function getDemo(id: DemoId): TheoryDemo {
  let demo = cache.get(id);
  if (!demo) {
    demo = BUILDERS[id]();
    cache.set(id, demo);
  }
  return demo;
}
