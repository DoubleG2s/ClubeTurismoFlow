
export interface ReservationChecklist {
  contract: boolean; // Agora visualizado como "Contrato enviado?"
  payment: boolean;
  flight_registered: boolean;
  hotel_confirmed: boolean;
  // Novos campos solicitados
  checkin_outbound: boolean; // Orientação check-in IDA
  checkin_inbound: boolean;  // Orientação check-in VOLTA
  hotel_email: boolean;      // E-mail enviado para o hotel
  seats_assigned: boolean;   // Assentos marcados - IDA
  seats_assigned_inbound: boolean; // Assentos marcados - VOLTA

  // Novos campos da atualização
  contract_signed: boolean; // Contrato assinado?
  voucher_sent: boolean;    // Voucher enviado?
}

export interface Reservation {
  id: string;
  reservation_number: string;
  date: string; // Data de Ida (dd/mm/yyyy)
  return_date?: string; // Data de Volta (dd/mm/yyyy) - Novo Campo
  flight_voucher?: string; // Voucher de Voo (6 chars) - Novo Campo
  passengers: string[]; // Stored as JSONB in Supabase
  checklist: ReservationChecklist; // Stored as JSONB in Supabase
  notes?: string;
  author_name?: string;
  created_by?: string;
  created_at?: string;
}