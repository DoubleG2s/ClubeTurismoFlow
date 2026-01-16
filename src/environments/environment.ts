export const environment = {
  production: false,
  supabaseUrl: (window as any).__env?.SUPABASE_URL ?? '',
  supabaseAnonKey: (window as any).__env?.SUPABASE_ANON_KEY ?? ''
};
