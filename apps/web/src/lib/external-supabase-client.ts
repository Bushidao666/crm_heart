
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import { env } from '@/config/env'

let cachedClient: SupabaseClient | null = null

export const getExternalSupabaseClient = () => {
  if (cachedClient) return cachedClient
  if (!env.contextSupabaseUrl || !env.contextSupabaseAnonKey) return null
  try {
    cachedClient = createClient(env.contextSupabaseUrl, env.contextSupabaseAnonKey)
  } catch (error) {
    console.warn('Failed to instantiate external Supabase client', error)
    return null
  }
  return cachedClient
}
