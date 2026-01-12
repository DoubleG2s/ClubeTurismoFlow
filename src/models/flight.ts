export interface Flight {
  id: string;
  locator: string;
  origin: string;
  date: string; // Data de Ida (dd/mm/yyyy)
  return_date?: string; // Data de Volta (dd/mm/yyyy)
  confirmed: boolean;
  author_name?: string;
  created_by?: string;
  created_at?: string;
}