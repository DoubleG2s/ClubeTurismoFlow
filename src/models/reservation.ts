export enum ProductType {
  PACOTE = 'PACOTE',
  VOO = 'VOO',
  HOSPEDAGEM = 'HOSPEDAGEM',
  CRUZEIRO = 'CRUZEIRO'
}

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

  // Novos campos da atualização anterior
  contract_signed: boolean; // Contrato assinado?
  voucher_sent: boolean;    // Voucher enviado?

  // Novo campo solicitado agora
  post_trip: boolean;       // Pós-viagem
}

export interface Reservation {
  id: string;
  reservation_number: string;
  date: string; // Data de Ida (dd/mm/yyyy)
  return_date?: string; // Data de Volta (dd/mm/yyyy) - Novo Campo
  destination?: string; // Destino - Novo Campo
  flight_voucher?: string; // Voucher de Voo (6 chars) - Novo Campo
  nome_hotel?: string | null;
  quarto?: string | null;
  regime_alimentacao?: string | null;
  localizador_hotel?: string | null;
  // Novos campos flat
  product_type?: ProductType | string;
  supplier?: string | null;
  airline?: string | null;
  origin?: string | null;
  cruise_company?: string | null;
  ship_name?: string | null;
  cabin?: string | null;

  passengers: string[]; // Stored as JSONB in Supabase
  checklist: ReservationChecklist; // Stored as JSONB in Supabase
  notes?: string;
  author_name?: string;
  created_by?: string;
  created_at?: string;
}