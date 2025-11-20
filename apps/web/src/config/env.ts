const getEnv = (key: keyof ImportMetaEnv) => {
  const value = import.meta.env[key];

  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }

  return value;
};

const getOptionalEnv = (key: keyof ImportMetaEnv) => import.meta.env[key] ?? '';

export const env = {
  supabaseUrl: getEnv('VITE_SUPABASE_URL'),
  supabaseAnonKey: getEnv('VITE_SUPABASE_ANON_KEY'),
  evolutionApiUrl: getOptionalEnv('VITE_EVOLUTION_API_URL'),
  apiUrl: getOptionalEnv('VITE_API_URL'),
  contextSupabaseUrl: getOptionalEnv('VITE_CONTEXT_SUPABASE_URL'),
  contextSupabaseAnonKey: getOptionalEnv('VITE_CONTEXT_SUPABASE_ANON_KEY'),
  contextApiUrl: getOptionalEnv('VITE_CONTEXT_API_URL'),
  profileSchemaPriority: getOptionalEnv('VITE_PROFILE_SCHEMA_PRIORITY'),
};

type Env = typeof env;

export type { Env };
