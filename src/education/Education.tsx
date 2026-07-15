/**
 * Intro to Music Theory — the classroom of Vaalbara.
 *
 * Hub screen: six numbered chapters. Each chapter teaches a general music
 * theory concept first, then uses the game's own score as the example set.
 * Back always works: chapter → hub, hub → home (App handles the exit).
 */

import { useEffect, useState } from 'react';
import { playUi } from '../audio';
import { Quiz } from './components';
import { stopDemo } from './player';
import { TOPICS } from './topics';

export function Education({ onBack }: { onBack: () => void }) {
  const [topicIdx, setTopicIdx] = useState<number | null>(null);

  // Leaving the classroom (or switching chapters) silences any example.
  useEffect(() => stopDemo, []);
  useEffect(() => {
    stopDemo();
    // Each chapter opens at the top, like turning to a new page.
    document.querySelector('.edu-scroll')?.scrollTo({ top: 0 });
  }, [topicIdx]);

  const back = () => {
    playUi('tap');
    if (topicIdx === null) {
      // Silence the classroom BEFORE the menu music restarts — the unmount
      // cleanup would otherwise run after onBack has rebuilt the score bus.
      stopDemo();
      onBack();
    } else {
      setTopicIdx(null);
    }
  };

  const topic = topicIdx === null ? null : TOPICS[topicIdx];

  return (
    <div className="education">
      <button className="edu-back" onClick={back} aria-label="Back">
        ‹ Back
      </button>

      {!topic && (
        <div className="edu-scroll">
          <header className="edu-hero">
            <div className="edu-kicker">The Conservatory of Vaalbara</div>
            <h1>Intro to Music Theory</h1>
            <p>
              Six short chapters on how music works — taught through the living score you battle
              to. Every example is played, live, by the game's own orchestra. Headphones
              recommended.
            </p>
          </header>
          <nav className="edu-toc" aria-label="Chapters">
            {TOPICS.map((t, i) => (
              <button
                key={t.id}
                className="edu-toc-card"
                onClick={() => {
                  playUi('tap');
                  setTopicIdx(i);
                }}
              >
                <span className="toc-num">{i + 1}</span>
                <span className="toc-copy">
                  <span className="toc-title">{t.title}</span>
                  <span className="toc-tag">{t.tagline}</span>
                </span>
                <span className="toc-icon" aria-hidden="true">{t.icon}</span>
              </button>
            ))}
          </nav>
        </div>
      )}

      {topic && (
        <div className="edu-scroll" key={topic.id}>
          <header className="edu-topic-head">
            <div className="edu-kicker">Chapter {(topicIdx ?? 0) + 1} of {TOPICS.length}</div>
            <h2>{topic.title}</h2>
          </header>
          <article className="edu-body">
            <topic.Body />
          </article>
          <Quiz questions={topic.quiz} />
          {topicIdx !== null && topicIdx < TOPICS.length - 1 ? (
            <button
              className="edu-next"
              onClick={() => {
                playUi('tap');
                setTopicIdx(topicIdx + 1);
              }}
            >
              <span className="next-kicker">Next chapter</span>
              <span className="next-title">{TOPICS[topicIdx + 1].title} ›</span>
            </button>
          ) : (
            <button
              className="edu-next"
              onClick={() => {
                playUi('tap');
                setTopicIdx(null);
              }}
            >
              <span className="next-kicker">Course complete</span>
              <span className="next-title">Back to all chapters ›</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
