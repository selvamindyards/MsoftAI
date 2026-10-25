import type { SupabaseClient } from '@supabase/supabase-js';
import type { Design } from '../model/types';

export interface DesignSummary { id: string; name: string; updated_at: string }

/** Per-user design storage in the `designs` table, protected by row-level security. */
export class CloudDesigns {
  constructor(private sb: SupabaseClient, private userId: string) {}

  async list(): Promise<DesignSummary[]> {
    const { data, error } = await this.sb
      .from('designs')
      .select('id,name,updated_at')
      .order('updated_at', { ascending: false });
    if (error) throw error;
    return (data ?? []) as DesignSummary[];
  }

  /** Saves the design, assigning it a cloud id on first save. Returns the id. */
  async save(design: Design): Promise<string> {
    const id = design.id ?? crypto.randomUUID();
    design.id = id;
    const { error } = await this.sb.from('designs').upsert({
      id,
      user_id: this.userId,
      name: design.name,
      data: design,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
    return id;
  }

  async load(id: string): Promise<Design> {
    const { data, error } = await this.sb.from('designs').select('data').eq('id', id).single();
    if (error) throw error;
    const d = data.data as Design;
    d.id = id;
    return d;
  }

  async remove(id: string): Promise<void> {
    const { error } = await this.sb.from('designs').delete().eq('id', id);
    if (error) throw error;
  }
}
