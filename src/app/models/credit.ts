import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Reusing global configurations if necessary, but this model defines the shape of the data returning from Supabase.
// Calculation for status and days remaining will be placed either in utility or service layer to compute based on current Date.

export interface Credit {
  id: string;
  created_at: string;
  client_name: string;
  reservation_number: string;
  original_travel_date: string;
  credit_date: string;
  expiration_date: string; // Calculated field from DB
  value: number; // Stored in BRL
  observations: string | null;
}

// ----------------------------------------------------------------------------
// GLOBAL DOMAIN LOGIC (Status and Days Remaining)
// Used logic globally as requested by "Socratic Gate" #2
// ----------------------------------------------------------------------------

export type CreditStatus = 'Vencido' | 'Vence esse mês' | 'Próximo do vencimento' | 'Dentro do prazo';

export function getCreditStatusAndDays(expirationDateStr: string): { status: CreditStatus; daysRemaining: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiration = new Date(`${expirationDateStr}T00:00:00`);
  
  const diffTime = expiration.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return { status: 'Vencido', daysRemaining: diffDays };
  }
  
  // Check if it's strictly inside the current calendar month
  if (today.getFullYear() === expiration.getFullYear() && today.getMonth() === expiration.getMonth()) {
    return { status: 'Vence esse mês', daysRemaining: diffDays };
  }
  
  if (diffDays <= 30) {
    return { status: 'Próximo do vencimento', daysRemaining: diffDays };
  }
  
  return { status: 'Dentro do prazo', daysRemaining: diffDays };
}
