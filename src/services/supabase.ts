import { createClient } from '@supabase/supabase-js';

// ATENÇÃO: Substitua os valores abaixo pelas credenciais do seu projeto Supabase
const SUPABASE_URL = 'https://hitzrhpmhlffxugjszlt.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpdHpyaHBtaGxmZnh1Z2pzemx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYxNzgxMjIsImV4cCI6MjA4MTc1NDEyMn0.cb85r0G4qZD_PaoFSNzScnOMQj36JfppE9w7QimcIwo';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);