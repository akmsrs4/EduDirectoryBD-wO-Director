import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const env = (import.meta as { env?: Record<string, string | undefined> }).env ?? {};
const supabaseUrl = (env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (
  env.VITE_SUPABASE_ANON_KEY ??
  env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  ''
).trim();

export function isSupabaseConfigured(): boolean {
  return (
    Boolean(supabaseUrl) &&
    Boolean(supabaseAnonKey) &&
    supabaseUrl.startsWith('https://') &&
    !supabaseUrl.includes('YOUR_PROJECT_ID') &&
    !supabaseAnonKey.includes('YOUR_SUPABASE_ANON_KEY')
  );
}

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }
  return client;
}
