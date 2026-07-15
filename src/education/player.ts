/**
 * One classroom-wide playback slot: tapping any example stops the previous
 * one, tapping the playing example stops it. Components subscribe to know
 * what is sounding and to run caption / notation-highlight clocks.
 */

import { music } from '../audio';
import { getDemo, type DemoId } from './demos';

/** Latency between playTheoryDemo() and its first beat (see audio.ts). */
export const DEMO_LEAD_S = 0.12;

let current: DemoId | null = null;
let startedAtMs = 0;
let endTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeDemo(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function currentDemo(): DemoId | null {
  return current;
}

/** performance.now() of the current demo's first beat. */
export function demoStartMs(): number {
  return startedAtMs;
}

export function toggleDemo(id: DemoId): void {
  if (current === id) {
    stopDemo();
    return;
  }
  if (endTimer) {
    clearTimeout(endTimer);
    endTimer = null;
  }
  const demo = getDemo(id);
  const startedAt = music.playTheoryDemo(demo.events);
  if (startedAt === null) {
    stopDemo();
    return;
  }
  current = id;
  startedAtMs = performance.now() + DEMO_LEAD_S * 1000;
  endTimer = setTimeout(() => {
    current = null;
    endTimer = null;
    notify();
  }, (demo.duration + DEMO_LEAD_S) * 1000);
  notify();
}

export function stopDemo(): void {
  music.stopTheoryDemo();
  if (endTimer) {
    clearTimeout(endTimer);
    endTimer = null;
  }
  if (current !== null) {
    current = null;
    notify();
  }
}
