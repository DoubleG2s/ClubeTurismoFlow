export interface Quote {
  id: string;
  supplier: string; // Fornecedor
  check_in: string; // dd/mm/aaaa
  check_out: string; // dd/mm/aaaa
  hotel_name: string;
  city: string;
  accommodation_type: string;
  adults: number;
  children: number;
  lead_name?: string; // Titular (opcional)
  amount: number; // Valor numérico
  currency: 'BRL' | 'USD';
  notes?: string; // Observações (Novo)
  created_by?: string;
  created_at?: string;
  author_name?: string;
}