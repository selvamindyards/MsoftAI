import type { CavityDef, FootprintCavity } from './types';

export class Library {
  readonly byId = new Map<number, CavityDef>();
  readonly footprintsByIndex = new Map<string, FootprintCavity[]>();
  readonly libraries: string[] = [];

  constructor(cavities: CavityDef[], footprints: FootprintCavity[]) {
    for (const c of cavities) {
      this.byId.set(c.id, c);
      if (!this.libraries.includes(c.library)) this.libraries.push(c.library);
    }
    this.libraries.sort();
    // Footprint children link to their parent cavity by (library, per-library footprint index).
    for (const f of footprints) {
      const k = Library.footprintKey(f.library, f.parentCavityId);
      const arr = this.footprintsByIndex.get(k) ?? [];
      arr.push(f);
      this.footprintsByIndex.set(k, arr);
    }
  }

  static footprintKey(library: string, index: number): string {
    return `${library}#${index}`;
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
    return this.footprintsByIndex.get(Library.footprintKey(def.library, def.footprintIndex)) ?? [];
  }

  static async load(base = './library/'): Promise<Library> {
    const [c, f] = await Promise.all([
      fetch(`${base}cavities.json`).then((r) => r.json() as Promise<CavityDef[]>),
      fetch(`${base}footprints.json`).then((r) => r.json() as Promise<FootprintCavity[]>),
    ]);
    return new Library(c, f);
  }
}
