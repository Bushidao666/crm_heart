/// <reference types="vite/client" />

declare module '*.module.css' {
  const classes: Record<string, string>
  export default classes
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_EVOLUTION_API_URL?: string
  readonly VITE_AUTENTIQUE_API_TOKEN?: string
  readonly VITE_IPDATA_API_KEY?: string
  readonly VITE_CONTEXT_SUPABASE_URL?: string
  readonly VITE_CONTEXT_SUPABASE_ANON_KEY?: string
  readonly VITE_CONTEXT_API_URL?: string
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
