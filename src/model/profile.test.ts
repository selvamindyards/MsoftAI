import { describe, expect, it } from 'vitest';
import { profileDepth, profileRadius, stepProfile } from './profile';

describe('step profile', () => {
  it('builds a tapped hole: step 0 bore then step 12 tap drill with a 118 degree point', () => {
    const pts = stepProfile([
      { index: 0, diameter: 10, depth: 19.05, angle: 60 },
      { index: 12, diameter: 8.33, depth: 31.75, angle: 59 },
    ]);
    expect(profileRadius(pts)).toBe(5);
    const tip = 31.75 + 4.165 / Math.tan((59 * Math.PI) / 180);
    expect(profileDepth(pts)).toBeCloseTo(tip, 5);
    expect(pts[0]).toEqual({ r: 0, z: 0 });
    expect(pts[pts.length - 1].r).toBe(0);
  });

  it('treats angle 90 as a flat bottom', () => {
    const pts = stepProfile([{ index: 0, diameter: 20, depth: 10, angle: 90 }]);
    expect(profileDepth(pts)).toBe(10);
  });

  it('ignores empty steps', () => {
    expect(stepProfile([{ index: 3, diameter: 0, depth: 0, angle: null }])).toEqual([]);
  });
});
