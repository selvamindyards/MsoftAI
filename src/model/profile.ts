import type { Step } from './types';

/** A point on the revolved half-profile: radius r, and z <= 0 measured down from the surface. */
export interface ProfilePoint { r: number; z: number }

const isFlat = (a: number | null) => a === null || a <= 0 || a >= 90;

/**
 * Build the half-profile of a cavity from its step stack.
 * Each step is a full-diameter bore to `depth` (cumulative from the surface),
 * followed by a cone down to the next step's radius, with cone height
 * (r_outer - r_inner) / tan(angle). The final step ends in a drill tip.
 */
export function stepProfile(steps: Step[]): ProfilePoint[] {
  const s = steps
    .filter((st) => st.diameter != null && st.diameter > 0 && st.depth != null && st.depth > 0)
    .sort((a, b) => a.index - b.index);
  const pts: ProfilePoint[] = [];
  if (s.length === 0) return pts;
  pts.push({ r: 0, z: 0 });
  let z = 0;
  for (let i = 0; i < s.length; i++) {
    const st = s[i];
    const r = st.diameter / 2;
    const rNext = i + 1 < s.length ? s[i + 1].diameter / 2 : 0;
    const last = pts[pts.length - 1];
    if (last.r !== r || last.z !== z) pts.push({ r, z });
    let zb = -st.depth;
    if (zb > z) zb = z;
    pts.push({ r, z: zb });
    let h = 0;
    if (!isFlat(st.angle) && r > rNext) h = (r - rNext) / Math.tan((st.angle as number) * Math.PI / 180);
    z = zb - h;
    pts.push({ r: rNext, z });
  }
  return pts;
}

/** Total depth to the tip, as a positive number. */
export function profileDepth(pts: ProfilePoint[]): number {
  return pts.length ? -Math.min(...pts.map((p) => p.z)) : 0;
}

/** Largest radius in the profile (normally step 0). */
export function profileRadius(pts: ProfilePoint[]): number {
  return pts.length ? Math.max(...pts.map((p) => p.r)) : 0;
}
