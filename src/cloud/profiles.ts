import type { SupabaseClient } from '@supabase/supabase-js';

export interface Profile {
  user_id: string;
  email: string;
  approved: boolean;
  role: 'user' | 'admin';
  created_at: string;
  approved_at: string | null;
}

/** The signed-in user's own profile, or null if the profile row does not exist yet. */
export async function myProfile(sb: SupabaseClient, userId: string): Promise<Profile | null> {
  const { data, error } = await sb.from('profiles').select('*').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data as Profile | null) ?? null;
}

/** All profiles. Only returns rows for administrators (row-level security). */
export async function listProfiles(sb: SupabaseClient): Promise<Profile[]> {
  const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function setApproved(sb: SupabaseClient, userId: string, approved: boolean): Promise<void> {
  const { error } = await sb
    .from('profiles')
    .update({ approved, approved_at: approved ? new Date().toISOString() : null })
    .eq('user_id', userId);
  if (error) throw error;
}

export async function setRole(sb: SupabaseClient, userId: string, role: Profile['role']): Promise<void> {
  const { error } = await sb.from('profiles').update({ role }).eq('user_id', userId);
  if (error) throw error;
}
