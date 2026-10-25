import { describe, expect, it } from 'vitest';
import { faceToWorld, faceFrame, rotateLocal, faceDepth, worldToFace, faceFromNormal } from './faces';
import { FACES, type Block } from './types';

const block: Block = { length: 200, width: 120, height: 80, material: 'Al' };

describe('face frames', () => {
  it('keeps face-local points inside the block and frames right-handed', () => {
    for (const face of FACES) {
      const f = faceFrame(block, face);
      const [x, y, z] = faceToWorld(block, face, f.uLength / 2, f.vLength / 2);
      expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThanOrEqual(200);
      expect(y).toBeGreaterThanOrEqual(0); expect(y).toBeLessThanOrEqual(80);
      expect(z).toBeGreaterThanOrEqual(0); expect(z).toBeLessThanOrEqual(120);
      // u x v must equal n so that x right, y up, n toward the viewer.
      const cross = [
        f.u[1] * f.v[2] - f.u[2] * f.v[1],
        f.u[2] * f.v[0] - f.u[0] * f.v[2],
        f.u[0] * f.v[1] - f.u[1] * f.v[0],
      ].map((c) => c + 0); // normalise -0 to 0
      expect(cross).toEqual(f.n);
    }
  });

  it('places the top face centre on the top surface', () => {
    expect(faceToWorld(block, 'top', 100, 60)).toEqual([100, 80, 60]);
  });

  it('round-trips face-local coordinates through world space', () => {
    for (const face of FACES) {
      const [x, y] = worldToFace(block, face, faceToWorld(block, face, 37.5, 12.25));
      expect(x).toBeCloseTo(37.5, 9);
      expect(y).toBeCloseTo(12.25, 9);
    }
  });

  it('identifies a face from its outward normal', () => {
    expect(faceFromNormal([0, 1, 0])).toBe('top');
    expect(faceFromNormal([0, -1, 0])).toBe('bottom');
    expect(faceFromNormal([0, 0, 1])).toBe('front');
    expect(faceFromNormal([0, 0, -1])).toBe('back');
    expect(faceFromNormal([-1, 0, 0])).toBe('left');
    expect(faceFromNormal([1, 0, 0])).toBe('right');
  });

  it('reports drilling depth per face', () => {
    expect(faceDepth(block, 'top')).toBe(80);
    expect(faceDepth(block, 'front')).toBe(120);
    expect(faceDepth(block, 'left')).toBe(200);
  });

  it('rotates local offsets in 90 degree steps', () => {
    expect(rotateLocal(10, 0, 90)).toEqual([-0, 10]);
    expect(rotateLocal(10, 0, 180)).toEqual([-10, -0]);
    expect(rotateLocal(10, 0, 270)).toEqual([0, -10]);
    expect(rotateLocal(10, 5, 360)).toEqual([10, 5]);
  });
});
