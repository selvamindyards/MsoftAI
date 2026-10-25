import * as THREE from 'three';
import type { CavityInstance, Design, Step } from '../model/types';
import type { Library } from '../model/library';
import { faceFrame, faceToWorld, rotateLocal } from '../model/faces';
import { stepProfile } from '../model/profile';

const TYPE_COLOR: Record<string, number> = {
  CV: 0x4f8cff, Port: 0x3ec97a, DH: 0x9aa4b2, BH: 0xd9a441, LP: 0xd9a441,
};

export function buildCavityObject(design: Design, inst: CavityInstance, lib: Library, selected: boolean): THREE.Group {
  const def = lib.get(inst.defId);
  const group = new THREE.Group();
  group.userData.cavityId = inst.id;
  if (!def) return group;

  const frame = faceFrame(design.block, inst.face);
  const n = new THREE.Vector3(...frame.n);
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);

  const place = (steps: Step[], type: string, lx: number, ly: number, main: boolean) => {
    const pts = stepProfile(steps);
    if (pts.length < 3) return;
    const geo = new THREE.LatheGeometry(pts.map((p) => new THREE.Vector2(p.r, p.z)), 48);
    const mat = new THREE.MeshStandardMaterial({
      color: selected && main ? 0xff6b3d : (TYPE_COLOR[type] ?? 0x9aa4b2),
      metalness: 0.1, roughness: 0.6, side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(...faceToWorld(design.block, inst.face, lx, ly));
    mesh.quaternion.copy(quat);
    mesh.userData.cavityId = inst.id;
    group.add(mesh);
    // Surface ring for a crisp edge on the face.
    const r = Math.max(...pts.map((p) => p.r));
    const ringPts = Array.from({ length: 65 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2;
      return new THREE.Vector3(r * Math.cos(a), 0.05, r * Math.sin(a));
    });
    const ring = new THREE.Line(new THREE.BufferGeometry().setFromPoints(ringPts), new THREE.LineBasicMaterial({ color: 0x111111 }));
    ring.position.copy(mesh.position);
    ring.quaternion.copy(quat);
    group.add(ring);
  };

  place(def.steps, def.type, inst.x, inst.y, true);
  for (const fp of lib.footprint(def)) {
    const [dx, dy] = rotateLocal(fp.x, fp.y, inst.rotation);
    place(fp.steps, fp.type, inst.x + dx, inst.y + dy, false);
  }
  return group;
}
