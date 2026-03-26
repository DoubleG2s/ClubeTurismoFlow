export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent';
  company_id?: string;
  companies?: any; // Para joins do Supabase
  created_at: string;
}