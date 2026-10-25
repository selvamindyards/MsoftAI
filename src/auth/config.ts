/**
 * Supabase project settings. The anon key is a public, browser-safe key;
 * every table is protected by row-level security policies (see supabase/schema.sql).
 * Leave both empty to run without sign-in (library and cloud features unavailable).
 */
export const SUPABASE_URL = 'https://brptqofvjhtlfqxruvaw.supabase.co';
export const SUPABASE_ANON_KEY = 'sb_publishable_bdXBvuEe29f1w_9dS5NcXA_Lo6BtYoR';

export const isAuthConfigured = () => SUPABASE_URL.length > 0 && SUPABASE_ANON_KEY.length > 0;
