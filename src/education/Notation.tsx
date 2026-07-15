/**
 * Hand-engraved SVG notation for the classroom, with live highlight sync:
 * while a demo plays, the note that is sounding lights up on the staff.
 * Everything is drawn with primitives (heads, stems, flags, beams) so it
 * renders identically in WKWebView with no music-font dependency.
 */

import { useEffect, useRef, useState } from 'react';
import type { DemoId } from './demos';
import { currentDemo, demoStartMs, subscribeDemo } from './player';

/* ------------------------------ demo clocks ------------------------------ */

/** Index of the timeline entry currently sounding, or -1 when idle. */
export function useDemoTimeline(id: DemoId, times: readonly number[] | undefined): number {
  const [active, setActive] = useState(-1);
  useEffect(() => {
    if (!times || times.length === 0) return;
    let raf = 0;
    let mounted = true;
    const tick = () => {
      if (!mounted) return;
      if (currentDemo() !== id) {
        setActive(-1);
        return;
      }
      const t = (performance.now() - demoStartMs()) / 1000;
      let idx = -1;
      for (let i = 0; i < times.length; i++) {
        if (t >= times[i] - 0.02) idx = i;
      }
      setActive(idx);
      raf = requestAnimationFrame(tick);
    };
    const restart = () => {
      cancelAnimationFrame(raf);
      if (currentDemo() === id) raf = requestAnimationFrame(tick);
      else setActive(-1);
    };
    const unsubscribe = subscribeDemo(restart);
    restart();
    return () => {
      mounted = false;
      unsubscribe();
      cancelAnimationFrame(raf);
    };
  }, [id, times]);
  return active;
}

export function useIsPlaying(id: DemoId): boolean {
  const [playing, setPlaying] = useState(currentDemo() === id);
  useEffect(() => subscribeDemo(() => setPlaying(currentDemo() === id)), [id]);
  return playing;
}

/** The caption that should be showing for a narrated demo, or null. */
export function useCaptions(id: DemoId, captions: ReadonlyArray<{ at: number; text: string }> | undefined): string | null {
  const times = useRef(captions?.map((c) => c.at)).current;
  const idx = useDemoTimeline(id, times);
  if (!captions || idx < 0) return null;
  return captions[idx].text;
}

/* ------------------------------- engraving ------------------------------- */

export type NoteDur = 'w' | 'h' | 'q' | 'e' | 's';

export interface StaffNote {
  /** Scientific name, restricted to the range the lessons use. */
  name: string;
  dur: NoteDur;
}

/** Diatonic staff position: 0 = bottom line (E4), each step = half space. */
const POS: Record<string, number> = {
  C4: -2, D4: -1, E4: 0, F4: 1, G4: 2, A4: 3, B4: 4, Bb4: 4,
  C5: 5, 'C#5': 5, D5: 6, E5: 7, F5: 8,
};

const DUR_STEPS: Record<NoteDur, number> = { w: 16, h: 8, q: 4, e: 2, s: 1 };

const LINE = 9;

interface Glyph {
  cx: number;
  pos: number;
  dur: NoteDur;
  accidental?: string;
  label?: string;
}

function NoteGlyph({ glyph, baseline, active }: { glyph: Glyph; baseline: number; active: boolean }) {
  const { cx, pos, dur } = glyph;
  const cy = baseline - (pos * LINE) / 2;
  const hollow = dur === 'w' || dur === 'h';
  const stemUp = pos < 4;
  const stemX = stemUp ? cx + 5.4 : cx - 5.4;
  const stemY1 = stemUp ? cy - 3 : cy + 3;
  const stemY2 = stemUp ? cy - 32 : cy + 32;
  const flags = dur === 'e' ? 1 : dur === 's' ? 2 : 0;
  const ledgers: number[] = [];
  for (let p = -2; p >= pos; p -= 2) ledgers.push(baseline - (p * LINE) / 2);
  return (
    <g className={`staff-note${active ? ' active' : ''}`}>
      {ledgers.map((y, i) => (
        <line key={i} x1={cx - 9.5} y1={y} x2={cx + 9.5} y2={y} className="staff-line" />
      ))}
      {glyph.accidental && (
        <text x={cx - 15} y={cy + 4.5} className="staff-accidental">{glyph.accidental}</text>
      )}
      <ellipse
        cx={cx}
        cy={cy}
        rx={5.8}
        ry={4.3}
        transform={`rotate(-18 ${cx} ${cy})`}
        className={hollow ? 'staff-head hollow' : 'staff-head'}
      />
      {dur !== 'w' && <line x1={stemX} y1={stemY1} x2={stemX} y2={stemY2} className="staff-stem" />}
      {Array.from({ length: flags }, (_, i) => (
        <path
          key={i}
          d={stemUp
            ? `M ${stemX} ${stemY2 + i * 7} c 8 3, 10 10, 4.5 19`
            : `M ${stemX} ${stemY2 - i * 7} c 8 -3, 10 -10, 4.5 -19`}
          className="staff-flag"
        />
      ))}
      {glyph.label && (
        <text x={cx} y={baseline + 26} className="staff-label">{glyph.label}</text>
      )}
    </g>
  );
}

export interface StaffProps {
  notes: StaffNote[];
  /** Show the D-minor key signature (one flat, on the B line). */
  keySig?: boolean;
  timeSig?: boolean;
  /** Letter labels under the notes (scale spelling). */
  labels?: string[];
  /** Highlight index driven by a demo timeline. */
  demoId: DemoId;
  noteTimes?: readonly number[];
  /** Lay notes out proportionally to duration (melody) or evenly (scale). */
  proportional?: boolean;
}

export function Staff({ notes, keySig, timeSig, labels, demoId, noteTimes, proportional }: StaffProps) {
  const active = useDemoTimeline(demoId, noteTimes);
  const top = 30;
  const baseline = top + 4 * LINE; // bottom staff line (E4)
  const leadIn = 30 + (keySig ? 26 : 0) + (timeSig ? 26 : 0);
  const stepPx = proportional ? 8.6 : 0;
  const evenGap = 34;

  const glyphs: Glyph[] = [];
  let cursor = 0;
  const barlines: number[] = [];
  notes.forEach((note, i) => {
    const cx = proportional
      ? leadIn + 14 + cursor * stepPx
      : leadIn + 20 + i * evenGap;
    // With the key signature shown, B♭ needs no courtesy accidental.
    const accidental = note.name.includes('#')
      ? '♯'
      : note.name.includes('b') && !keySig
        ? '♭'
        : undefined;
    glyphs.push({
      cx,
      pos: POS[note.name] ?? 0,
      dur: note.dur,
      accidental,
      label: labels?.[i],
    });
    cursor += DUR_STEPS[note.dur];
    if (proportional && cursor % 16 === 0 && i < notes.length - 1) {
      barlines.push(leadIn + 14 + cursor * stepPx - 14);
    }
  });

  const width = proportional
    ? leadIn + 28 + cursor * stepPx
    : leadIn + 24 + notes.length * evenGap;
  const height = baseline + (labels ? 36 : 18);

  return (
    <svg
      className="staff-svg"
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Music notation"
    >
      {Array.from({ length: 5 }, (_, i) => (
        <line key={i} x1={4} y1={top + i * LINE} x2={width - 4} y2={top + i * LINE} className="staff-line" />
      ))}
      <line x1={4} y1={top} x2={4} y2={baseline} className="staff-bar" />
      <line x1={width - 4} y1={top} x2={width - 4} y2={baseline} className="staff-bar" />
      {barlines.map((x, i) => (
        <line key={i} x1={x} y1={top} x2={x} y2={baseline} className="staff-bar" />
      ))}
      <text x={8} y={baseline - 2} className="staff-clef">𝄞</text>
      {keySig && <text x={38} y={top + 2 * LINE + 4.5} className="staff-accidental keysig">♭</text>}
      {timeSig && (
        <g className="staff-timesig">
          <text x={keySig ? 62 : 40} y={top + LINE + 4}>4</text>
          <text x={keySig ? 62 : 40} y={top + 3 * LINE + 4}>4</text>
        </g>
      )}
      {glyphs.map((glyph, i) => (
        <NoteGlyph key={i} glyph={glyph} baseline={baseline} active={i === active} />
      ))}
    </svg>
  );
}

/* ------------------------- note-value pyramid ---------------------------- */

function PyramidRow({ y, count, dur, label, beamGroup }: {
  y: number; count: number; dur: NoteDur; label: string; beamGroup: number;
}) {
  const width = 330;
  const left = 128;
  const span = width - left - 14;
  const glyphs = Array.from({ length: count }, (_, i) => left + (count === 1 ? span / 2 : (i * span) / (count - 1) + 0));
  const hollow = dur === 'w' || dur === 'h';
  const beams: Array<[number, number]> = [];
  if (beamGroup > 1) {
    for (let i = 0; i < count; i += beamGroup) {
      beams.push([glyphs[i] + 5.4, glyphs[Math.min(i + beamGroup - 1, count - 1)] + 5.4]);
    }
  }
  return (
    <g>
      <text x={8} y={y + 4} className="pyramid-label">{label}</text>
      {glyphs.map((cx, i) => (
        <g key={i} className="staff-note">
          <ellipse cx={cx} cy={y} rx={5.4} ry={4} transform={`rotate(-18 ${cx} ${y})`} className={hollow ? 'staff-head hollow' : 'staff-head'} />
          {dur !== 'w' && <line x1={cx + 5.4} y1={y - 3} x2={cx + 5.4} y2={y - 26} className="staff-stem" />}
          {beamGroup === 1 && dur === 'e' && (
            <path d={`M ${cx + 5.4} ${y - 26} c 8 3, 10 10, 4.5 19`} className="staff-flag" />
          )}
        </g>
      ))}
      {beams.map(([x1, x2], i) => (
        <g key={i}>
          <line x1={x1} y1={y - 26} x2={x2} y2={y - 26} className="staff-beam" />
          {dur === 's' && <line x1={x1} y1={y - 21} x2={x2} y2={y - 21} className="staff-beam" />}
        </g>
      ))}
    </g>
  );
}

/** One 4/4 measure of each value — the 1 : 2 : 4 : 8 : 16 arithmetic. */
export function NoteValuePyramid() {
  return (
    <svg className="staff-svg pyramid" viewBox="0 0 330 240" role="img" aria-label="Note value chart">
      <PyramidRow y={38} count={1} dur="w" label="whole — 4 beats" beamGroup={1} />
      <PyramidRow y={86} count={2} dur="h" label="half — 2 beats" beamGroup={1} />
      <PyramidRow y={134} count={4} dur="q" label="quarter — 1 beat" beamGroup={1} />
      <PyramidRow y={182} count={8} dur="e" label="eighth — ½ beat" beamGroup={2} />
      <PyramidRow y={230} count={16} dur="s" label="16th — ¼ beat" beamGroup={4} />
    </svg>
  );
}

/* ----------------------------- meter counter ----------------------------- */

/** A 4/4 measure with a live beat counter — highlights while measures play. */
export function MeterStrip({ demoId, noteTimes }: { demoId: DemoId; noteTimes: readonly number[] }) {
  const active = useDemoTimeline(demoId, noteTimes);
  const beat = active < 0 ? -1 : active % 4;
  const bar = active < 0 ? -1 : Math.floor(active / 4);
  return (
    <div className="meter-strip" aria-label="Beat counter">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className={`meter-beat${i === beat ? ' active' : ''}${i === 0 ? ' downbeat' : ''}`}>
          <span className="count">{i + 1}</span>
          <span className="tag">{i === 0 ? 'downbeat' : ''}</span>
        </div>
      ))}
      <div className="meter-measure">{bar >= 0 ? `measure ${bar + 1}` : 'measure —'}</div>
    </div>
  );
}

/* --------------------------- chord progression --------------------------- */

export function ChordStrip({ demoId, noteTimes, chords, loop }: {
  demoId: DemoId;
  noteTimes: readonly number[];
  chords: ReadonlyArray<{ roman: string; name: string }>;
  /** When the demo cycles the strip (e.g. 8 bars over 4 cards). */
  loop?: boolean;
}) {
  const active = useDemoTimeline(demoId, noteTimes);
  const idx = active < 0 ? -1 : loop ? active % chords.length : Math.min(active, chords.length - 1);
  return (
    <div className="chord-strip">
      {chords.map((chord, i) => (
        <div key={i} className={`chord-card${i === idx ? ' active' : ''}`}>
          <span className="roman">{chord.roman}</span>
          <span className="cname">{chord.name}</span>
        </div>
      ))}
    </div>
  );
}
