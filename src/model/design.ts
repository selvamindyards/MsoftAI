import type { Block, CavityInstance, Design, FaceId, Units } from './types';

export function newDesign(name = 'Untitled', units: Units = 'mm'): Design {
  return {
    version: 1,
    name,
    units,
    block: { length: 200, width: 120, height: 80, material: 'Aluminium 6061' },
    cavities: [],
  };
}

let seq = 0;
export function uid(): string {
  seq += 1;
  return `c${Date.now().toString(36)}${seq.toString(36)}`;
}

export function nextComponentId(design: Design, prefix: string): string {
  const used = new Set(design.cavities.map((c) => c.componentId));
  let n = 1;
  while (used.has(`${prefix}${n}`)) n += 1;
  return `${prefix}${n}`;
}

export function addCavity(
  design: Design,
  defId: number,
  face: FaceId,
  x: number,
  y: number,
  componentId: string,
  rotation = 0,
): CavityInstance {
  const inst: CavityInstance = { id: uid(), defId, componentId, face, x, y, rotation };
  design.cavities.push(inst);
  return inst;
}

export function removeCavity(design: Design, id: string): void {
  design.cavities = design.cavities.filter((c) => c.id !== id);
}

export function setBlock(design: Design, block: Partial<Block>): void {
  design.block = { ...design.block, ...block };
}

export function serialize(design: Design): string {
  return JSON.stringify(design, null, 2);
}

export function deserialize(text: string): Design {
  const d = JSON.parse(text) as Design;
  if (d.version !== 1 || !d.block || !Array.isArray(d.cavities)) throw new Error('Not an MsoftAI design file');
  return d;
}
