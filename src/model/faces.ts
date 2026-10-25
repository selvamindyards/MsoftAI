import type { Block, FaceId } from './types';

export type Vec3 = [number, number, number];

/**
 * A face coordinate frame: origin corner in world space, unit u and v axes
 * lying in the face, and the outward normal n. Face-local (x, y) maps to
 * origin + x*u + y*v. Cavities drill along -n.
 *
 * World axes: X = length, Y = height (up), Z = width. The block occupies
 * [0,L] x [0,H] x [0,W]. Each face origin is the corner that appears at the
 * bottom-left when the face is viewed from outside with its v axis up.
 */
export interface FaceFrame {
  origin: Vec3;
  u: Vec3;
  v: Vec3;
  n: Vec3;
  uLength: number;
  vLength: number;
}

export function faceFrame(block: Block, face: FaceId): FaceFrame {
  const { length: L, width: W, height: H } = block;
  switch (face) {
    case 'top':
      return { origin: [0, H, W], u: [1, 0, 0], v: [0, 0, -1], n: [0, 1, 0], uLength: L, vLength: W };
    case 'bottom':
      return { origin: [0, 0, 0], u: [1, 0, 0], v: [0, 0, 1], n: [0, -1, 0], uLength: L, vLength: W };
    case 'front':
      return { origin: [0, 0, W], u: [1, 0, 0], v: [0, 1, 0], n: [0, 0, 1], uLength: L, vLength: H };
    case 'back':
      return { origin: [L, 0, 0], u: [-1, 0, 0], v: [0, 1, 0], n: [0, 0, -1], uLength: L, vLength: H };
    case 'left':
      return { origin: [0, 0, 0], u: [0, 0, 1], v: [0, 1, 0], n: [-1, 0, 0], uLength: W, vLength: H };
    case 'right':
      return { origin: [L, 0, W], u: [0, 0, -1], v: [0, 1, 0], n: [1, 0, 0], uLength: W, vLength: H };
  }
}

export function faceToWorld(block: Block, face: FaceId, x: number, y: number): Vec3 {
  const f = faceFrame(block, face);
  return [
    f.origin[0] + x * f.u[0] + y * f.v[0],
    f.origin[1] + x * f.u[1] + y * f.v[1],
    f.origin[2] + x * f.u[2] + y * f.v[2],
  ];
}

/** Depth available for drilling into this face, i.e. the block dimension along n. */
export function faceDepth(block: Block, face: FaceId): number {
  switch (face) {
    case 'top':
    case 'bottom':
      return block.height;
    case 'front':
    case 'back':
      return block.width;
    case 'left':
    case 'right':
      return block.length;
  }
}

/** Rotate a face-local offset by a multiple of 90 degrees. */
export function rotateLocal(x: number, y: number, degrees: number): [number, number] {
  const r = ((Math.round(degrees / 90) % 4) + 4) % 4;
  switch (r) {
    case 1: return [-y, x];
    case 2: return [-x, -y];
    case 3: return [y, -x];
    default: return [x, y];
  }
}

/** MDTools-style drawing view letters. */
export const FACE_LABEL: Record<FaceId, string> = {
  top: 'A Top', front: 'B Front', bottom: 'C Bottom', left: 'D Left', right: 'E Right', back: 'F Back',
};
