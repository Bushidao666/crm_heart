import { createClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
  },
});

export const heartSupabase = supabase.schema('heart');
export const coreSupabase = supabase.schema('core');
