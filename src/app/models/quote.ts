export interface HotelOption {
  hotel_id?: string; // Vinculo direto com Hotel.id da DB
  hotel_images?: string[]; // Array público armazenado pra cache da visualização da cotação
  hotel_name: string;
  regime: string; // Ex: Café da manhã
  accommodation: string; // Ex: Apto Luxo
  amount: number;
  currency: 'BRL' | 'USD';
  link?: string;
  description?: string;
  price_mode?: 'total' | 'per_person';
}

export interface FlightSegment {
  origin_city: string;
  destination_city: string;
  departure_time: string; // HH:mm
  arrival_time: string; // HH:mm
  has_connection?: boolean;
  connection_city?: string;
  connection_time?: string; // HH:mm
  seats_included?: boolean;
  checked_baggage?: boolean;
}

export interface QuoteFlightDetails {
  outbound: FlightSegment;
  inbound: FlightSegment;
}

export interface QuoteOption {
  // Opcional ID or title to distinguish options
  id?: string;
  title?: string; // e.g. "Opção 1"

  // Datas e Pax
  check_in?: string; // dd/mm/aaaa
  check_out?: string; // dd/mm/aaaa
  adults?: number;
  children?: number;

  // Detalhes do Voo
  flight_details?: QuoteFlightDetails;

  // Hospedagem (Pode ser array, mas geralmente a opção terá 1 ou mais hotéis alternativos para essa logística)
  hotel_options?: HotelOption[];

  // Detalhes Gerais
  tour_details?: string; // Opcional {passeio}
  has_transfer?: boolean; // Traslado chegada e saída
}

export interface Quote {
  id: string;
  created_at?: string;
  created_by?: string;
  author_name?: string;

  // Campos Obrigatórios Principais
  title: string;
  subtitle?: string; // Opcional
  supplier: string;

  // Novas Múltiplas Opções
  options?: QuoteOption[];

  // ----------------------------------------------------
  // CAMPOS LEGADOS (MANTIDOS PARA RETROCOMPATIBILIDADE)
  // ----------------------------------------------------
  // Datas e Pax
  check_in?: string; // dd/mm/aaaa
  check_out?: string; // dd/mm/aaaa
  adults?: number;
  children?: number;

  // Detalhes do Voo
  flight_details?: QuoteFlightDetails;

  // Detalhes Gerais
  tour_details?: string; // Opcional {passeio}
  has_transfer?: boolean; // Traslado chegada e saída

  // Lista de Hotéis (Dinâmica)
  hotel_options?: HotelOption[];

  city?: string;
  notes?: string;

  // Validade do desconto (dd/mm/yyyy)
  discount_valid_until?: string;

  // Compartilhamento
  public_token?: string;
  is_public?: boolean;
  public_expires_at?: string;
}