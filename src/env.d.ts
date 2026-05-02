/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly SUPABASE_DB_URL?: string;
  readonly MENU_CONTENT_SOURCE?: "yaml" | "supabase";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
