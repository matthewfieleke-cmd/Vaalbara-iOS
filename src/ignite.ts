/**
 * The ignite orb — one ember that survives the boot → cinematic handoff.
 *
 * Boot and the Tap-to-Begin gate are different React components, so each
 * mounts its own orb element. Anchoring both to one global breathing clock
 * (a negative animation-delay against the same period) keeps the pulse in
 * phase across the swap: the player sees a single continuous ember.
 */
export const IGNITE_BREATHE_PERIOD_S = 1.6;

export function igniteOrbPhaseStyle(): { animationDelay: string } {
  const phase = (performance.now() / 1000) % IGNITE_BREATHE_PERIOD_S;
  return { animationDelay: `${(-phase).toFixed(4)}s` };
}
