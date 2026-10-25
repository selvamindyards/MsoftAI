/** Core data model for MsoftAI. Independent of rendering. */

export type Units = 'mm' | 'in';

/** The six faces of a rectangular block. */
export type FaceId = 'top' | 'bottom' | 'front' | 'back' | 'left' | 'right';
export const FACES: FaceId[] = ['top', 'bottom', 'front', 'back', 'left', 'right'];

/**
 * One step of a cavity profile. Analogous to a drill tool:
 * diameter, depth of the full-diameter bore measured from the block surface,
 * and the bottom cone half-angle in degrees measured from the axis
 * (59 = 118 degree drill point, 90 = flat bottom, 1.8 = NPT taper).
 */
export interface Step {
  index: number;
  diameter: number;
  depth: number;
  angle: number | null;
}

/** Port band of a cartridge valve cavity. diameter null = bottom port. */
export interface Port {
  diameter: number | null;
  depth: number | null;
  connectingCavity: string | null;
}

export interface ORing { diameter: number | null; depth: number | null; width: number | null }
export interface Thread { size: string | null; step: number | null; cls: string | null; pitch: string | null }
export interface Machine { diameter: string | null; depth: string | null; operation: string | null; tool: string | null }

/** A cavity definition from the library. */
export interface CavityDef {
  id: number;
  name: string;
  /** BH bolt hole, DH drill hole, CV cartridge valve, Port, LP locating pin. */
  type: string;
  library: string;
  steps: Step[];
  ports: Port[];
  numberOfPorts: number | null;
  orings: ORing[];
  threads: Thread[];
  machines: Machine[];
  isFootprint: boolean;
  footprintIndex: number | null;
  insertionDepth: number | null;
  plugHeadHeight: number | null;
  maxPressure: number | null;
  portApplicationName: string | null;
  comments: string | null;
}

/** A child hole of a footprint, positioned relative to the main cavity. */
export interface FootprintCavity {
  footprintIndex: number;
  parentCavityId: number;
  type: string;
  library: string;
  portApplicationName: string | null;
  x: number;
  y: number;
  steps: Step[];
  ports: Port[];
  threads: Thread[];
  machines: Machine[];
}

export interface Block {
  /** Along world X. */
  length: number;
  /** Along world Z. */
  width: number;
  /** Along world Y, up. */
  height: number;
  material: string;
}

/** A cavity placed on the block. Coordinates are face-local, from the face origin. */
export interface CavityInstance {
  id: string;
  defId: number;
  componentId: string;
  face: FaceId;
  x: number;
  y: number;
  /** Footprint rotation in degrees, multiples of 90. */
  rotation: number;
}

export interface Design {
  version: 1;
  /** Cloud id, set once the design has been saved to the user's account. */
  id?: string;
  name: string;
  units: Units;
  block: Block;
  cavities: CavityInstance[];
}
