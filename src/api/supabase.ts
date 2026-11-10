import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** true when no Supabase project is configured: the app runs on browser-only demo data. */
export const isDemo = !url || !key;

let client: SupabaseClient | null = null;
export function sb(): SupabaseClient {
  if (!url || !key) throw new Error('Supabase is not configured');
  if (!client) client = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
  return client;
}
