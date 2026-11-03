// True once the Supabase project URL and publishable key are configured for the browser.
export const backendConfigured = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY),
);
