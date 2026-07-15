/**
 * Interactive building blocks for the classroom: tap-to-hear buttons,
 * animated warrior listening cards with live narration, and the
 * check-your-understanding quiz.
 */

import { useEffect, useRef, useState } from 'react';
import type { SpeciesId } from '../types';
import { getAnim } from '../sprites';
import { drawSpecies } from '../vector-art';
import { playUi } from '../audio';
import { getDemo, type DemoId } from './demos';
import { toggleDemo } from './player';
import { useCaptions, useIsPlaying } from './Notation';

/* ------------------------------ demo button ------------------------------ */

export function DemoButton({ id, label, sub, compact }: {
  id: DemoId;
  label: string;
  sub?: string;
  compact?: boolean;
}) {
  const playing = useIsPlaying(id);
  const demo = getDemo(id);
  return (
    <button
      className={`demo-btn${playing ? ' playing' : ''}${compact ? ' compact' : ''}`}
      onClick={() => {
        playUi('tap');
        toggleDemo(id);
      }}
      aria-pressed={playing}
    >
      <span className="demo-icon" aria-hidden="true">{playing ? '◼' : '▶'}</span>
      <span className="demo-copy">
        <span className="demo-label">{label}</span>
        {sub && <span className="demo-sub">{sub}</span>}
      </span>
      {playing && (
        <span
          className="demo-progress"
          style={{ animationDuration: `${demo.duration}s` }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

/** Isolated / in-the-mix pair for the percussion chapter. */
export function IsoMixPair({ iso, mix, label, sub }: {
  iso: DemoId;
  mix: DemoId;
  label: string;
  sub?: string;
}) {
  return (
    <div className="iso-mix">
      <div className="iso-mix-head">
        <span className="demo-label">{label}</span>
        {sub && <span className="demo-sub">{sub}</span>}
      </div>
      <div className="iso-mix-btns">
        <DemoButton id={iso} label="Isolated" compact />
        <DemoButton id={mix} label="In the mix" compact />
      </div>
    </div>
  );
}

/* --------------------------- animated warrior card ------------------------ */

function useSpeciesAnimation(canvasRef: React.RefObject<HTMLCanvasElement | null>, species: SpeciesId): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let raf = 0;
    const start = performance.now();
    const flying = species === 'eagle' || species === 'bees';

    const frame = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const W = Math.max(1, Math.round(rect.width * dpr));
      const H = Math.max(1, Math.round(rect.height * dpr));
      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }
      ctx.clearRect(0, 0, W, H);
      const t = (performance.now() - start) / 1000;
      const anim = getAnim(species);
      const cx = W / 2;
      const cy = H * 0.52;
      if (anim) {
        // Same painted parade frames and non-dipping crossfade the intro uses.
        const frames = anim.intro && anim.intro.length >= 6 ? anim.intro : anim.run;
        const n = frames.length;
        const cps = flying ? 0.8 : 0.62;
        const phase = t * cps * n;
        const i0 = Math.floor(phase) % n;
        const frac = phase - Math.floor(phase);
        const mix = frac * frac * (3 - 2 * frac);
        const bob = flying ? Math.sin(t * 2.4) * H * 0.02 : 0;
        const draw = (f: typeof frames[number], alpha: number) => {
          const scale = Math.min((H * 0.72) / f.h, (W * 0.82) / f.w);
          const contentMidY = flying ? f.anchorY : f.anchorY - f.h * 0.48;
          ctx.globalAlpha = alpha;
          ctx.drawImage(
            f.canvas,
            cx - f.anchorX * scale,
            cy - contentMidY * scale + bob,
            f.canvas.width * scale,
            f.canvas.height * scale,
          );
        };
        draw(frames[i0], 1);
        if (mix > 0.02) draw(frames[(i0 + 1) % n], mix);
        ctx.globalAlpha = 1;
      } else {
        ctx.save();
        ctx.translate(cx, cy);
        drawSpecies(ctx, species, W * 0.35, t);
        ctx.restore();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [canvasRef, species]);
}

/**
 * The tappable animated warrior — the Eagle/Bee/Fire-Ant listening cards.
 * Tap to start the ~20 s guided example; the caption line narrates live.
 */
export function WarriorCard({ species, demoId, title, role, hint }: {
  species: SpeciesId;
  demoId: DemoId;
  title: string;
  role: string;
  hint: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playing = useIsPlaying(demoId);
  const demo = getDemo(demoId);
  const caption = useCaptions(demoId, demo.captions);
  useSpeciesAnimation(canvasRef, species);
  return (
    <div className={`warrior-card${playing ? ' playing' : ''}`}>
      <button
        className="warrior-tap"
        onClick={() => {
          playUi('tap');
          toggleDemo(demoId);
        }}
        aria-pressed={playing}
        aria-label={`${playing ? 'Stop' : 'Play'}: ${title}`}
      >
        <canvas ref={canvasRef} className="warrior-canvas" />
        <span className="warrior-name">
          <b>{title}</b>
          <i>{role}</i>
        </span>
        <span className="warrior-play" aria-hidden="true">{playing ? '◼' : '▶'}</span>
        {playing && (
          <span className="demo-progress" style={{ animationDuration: `${demo.duration}s` }} aria-hidden="true" />
        )}
      </button>
      <div className={`warrior-caption${caption ? ' live' : ''}`} aria-live="polite">
        {caption ?? hint}
      </div>
    </div>
  );
}

/* ---------------------------------- quiz --------------------------------- */

export interface QuizQuestion {
  prompt: string;
  options: string[];
  answer: number;
  explain: string;
  /** Optional listening component of the question. */
  listen?: DemoId;
  listenLabel?: string;
}

export function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const [picks, setPicks] = useState<Array<number | null>>(() => questions.map(() => null));
  const answered = picks.filter((p) => p !== null).length;
  const correct = picks.filter((p, i) => p === questions[i].answer).length;
  return (
    <section className="quiz">
      <h3 className="edu-h3">Check your understanding</h3>
      <p className="quiz-score">
        {answered === questions.length
          ? `Score: ${correct} / ${questions.length}`
          : `${answered} of ${questions.length} answered`}
      </p>
      {questions.map((q, qi) => {
        const pick = picks[qi];
        return (
          <div key={qi} className="quiz-q">
            <p className="quiz-prompt"><span className="qnum">{qi + 1}</span>{q.prompt}</p>
            {q.listen && (
              <DemoButton id={q.listen} label={q.listenLabel ?? 'Play the excerpt'} compact />
            )}
            <div className="quiz-options">
              {q.options.map((option, oi) => {
                let cls = 'quiz-option';
                if (pick !== null) {
                  if (oi === q.answer) cls += ' correct';
                  else if (oi === pick) cls += ' wrong';
                  else cls += ' dim';
                }
                return (
                  <button
                    key={oi}
                    className={cls}
                    disabled={pick !== null}
                    onClick={() => {
                      playUi('tap');
                      setPicks((prev) => prev.map((p, i) => (i === qi ? oi : p)));
                    }}
                  >
                    <span className="opt-letter">{String.fromCharCode(65 + oi)}</span>
                    {option}
                  </button>
                );
              })}
            </div>
            {pick !== null && (
              <p className={`quiz-explain${pick === q.answer ? ' right' : ''}`}>
                {pick === q.answer ? 'Correct. ' : 'Not quite. '}
                {q.explain}
              </p>
            )}
          </div>
        );
      })}
      {answered > 0 && (
        <button
          className="quiz-reset"
          onClick={() => {
            playUi('tap');
            setPicks(questions.map(() => null));
          }}
        >
          Reset quiz
        </button>
      )}
    </section>
  );
}
