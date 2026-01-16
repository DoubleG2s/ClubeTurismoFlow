import { createClient } from '@supabase/supabase-js';
import { environment } from '../environments/environment';

if (!environment.supabaseUrl || !environment.supabaseAnonKey) {
    console.error('Supabase env não carregado', (window as any).__env);
}

export const supabase = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey
);
