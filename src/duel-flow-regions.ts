/* ============================================================================
 * VAALBARA — duel-flow-regions.ts
 * Where the fluid lives in each duel backdrop.
 *
 * The duel stage animates its painting by cutting these rectangles out at
 * source resolution, chroma-keying them so only the fluid keeps alpha, and
 * moving the result. Coordinates are normalized to the painting so they
 * survive a re-export at any size — but they do NOT survive a repaint.
 * `node scripts/flow-regions.mjs` draws them over the source art so a new
 * backdrop can be re-walked by eye.
 *
 * Kept apart from duel-stage.ts purely so that script can import them
 * without dragging in the browser-only sprite loader.
 * ========================================================================== */

export type DuelWorld = 'basalt' | 'oasis';

export interface FlowRegionDef {
  /** Region in normalized image coordinates. */
  x: number; y: number; w: number; h: number;
  /** 'fall': material pours downward. 'ripple': surface shimmers in place. */
  kind: 'fall' | 'ripple';
  /** Loop speed (cycles/s for falls, wave speed for ripples). */
  speed: number;
  /** Ripple horizontal displacement, as a fraction of region width. */
  amp?: number;
}

export const FLOW_REGIONS: Record<DuelWorld, FlowRegionDef[]> = {
  basalt: [
    // The five lava cascades spilling off the caldera shelf, left to right.
    { x: 0.215, y: 0.455, w: 0.085, h: 0.145, kind: 'fall', speed: 0.30 },
    { x: 0.370, y: 0.435, w: 0.095, h: 0.165, kind: 'fall', speed: 0.34 },
    { x: 0.465, y: 0.425, w: 0.085, h: 0.180, kind: 'fall', speed: 0.31 },
    { x: 0.555, y: 0.430, w: 0.095, h: 0.175, kind: 'fall', speed: 0.33 },
    { x: 0.665, y: 0.445, w: 0.085, h: 0.155, kind: 'fall', speed: 0.28 },
    // Molten pool they all drain into — slow lateral churn.
    { x: 0.315, y: 0.600, w: 0.380, h: 0.050, kind: 'ripple', speed: 0.5, amp: 0.005 },
  ],
  oasis: [
    // Terraced falls down the left shoulder, taken as one tall region: the
    // lower step alone keys too thinly to read as moving.
    { x: 0.255, y: 0.420, w: 0.095, h: 0.200, kind: 'fall', speed: 0.5 },
    // Centre cascade into the pond.
    { x: 0.475, y: 0.545, w: 0.095, h: 0.100, kind: 'fall', speed: 0.55 },
    // Right cliff ribbon and the cascade below it.
    { x: 0.665, y: 0.350, w: 0.085, h: 0.190, kind: 'fall', speed: 0.5 },
    { x: 0.685, y: 0.545, w: 0.085, h: 0.100, kind: 'fall', speed: 0.52 },
    // The pond surface — a subtle refractive shimmer.
    { x: 0.200, y: 0.635, w: 0.600, h: 0.055, kind: 'ripple', speed: 0.8, amp: 0.006 },
  ],
};
