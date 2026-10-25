import type { CavityDef, FootprintCavity } from './types';

export class Library {
  readonly byId = new Map<number, CavityDef>();
  readonly footprintsByIndex = new Map<number, FootprintCavity[]>();
  readonly libraries: string[] = [];

  constructor(cavities: CavityDef[], footprints: FootprintCavity[]) {
    for (const c of cavities) {
      this.byId.set(c.id, c);
      if (!this.libraries.includes(c.library)) this.libraries.push(c.library);
    }
    this.libraries.sort();
    for (const f of footprints) {
      const arr = this.footprintsByIndex.get(f.parentCavityId) ?? [];
      arr.push(f);
      this.footprintsByIndex.set(f.parentCavityId, arr);
    }
  }

  get(id: number): CavityDef | undefined {
    return this.byId.get(id);
  }

  inLibrary(name: string): CavityDef[] {
    return [...this.byId.values()].filter((c) => c.library === name).sort((a, b) => a.name.localeCompare(b.name));
  }

  /** Child holes of a footprint cavity, or an empty list. Linked by the cavity's footprintIndex. */
  footprint(def: CavityDef): FootprintCavity[] {
    if (!def.isFootprint || def.footprintIndex == null) return [];
    return this.footprintsByIndex.get(def.footprintIndex) ?? [];
  }

  static async load(base = './library/'): Promise<Library> {
    const [c, f] = await Promise.all([
      fetch(`${base}cavities.json`).then((r) => r.json() as Promise<CavityDef[]>),
      fetch(`${base}footprints.json`).then((r) => r.json() as Promise<FootprintCavity[]>),
    ]);
    return new Library(c, f);
  }
}
