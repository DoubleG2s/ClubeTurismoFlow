export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent';
  company_id?: string;
  companies?: {
    id?: string;
    name?: string;
    slug?: string;
  } | null; // Join opcional com a empresa atual do usuario
  created_at: string;
  last_seen_at?: string | null;
}
