import type { SupabaseClient } from '@supabase/supabase-js';
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

  /** Load from the Supabase library tables. Requires a signed-in session (row-level security). */
  static async fromSupabase(sb: SupabaseClient): Promise<Library> {
    const [c, f] = await Promise.all([
      sb.from('library_cavities').select('data').order('id').range(0, 4999),
      sb.from('library_footprints').select('data').order('id').range(0, 4999),
    ]);
    if (c.error) throw c.error;
    if (f.error) throw f.error;
    return new Library(
      (c.data ?? []).map((r) => r.data as CavityDef),
      (f.data ?? []).map((r) => r.data as FootprintCavity),
    );
  }
}
