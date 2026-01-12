export interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'agent';
  created_at: string;
}