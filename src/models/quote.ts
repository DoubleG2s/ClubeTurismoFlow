export interface HotelOption {
  hotel_id?: string; // Vinculo direto com Hotel.id da DB
  hotel_images?: string[]; // Array público armazenado pra cache da visualização da cotação
  hotel_name: string;
  regime: string; // Ex: Café da manhã
  accommodation: string; // Ex: Apto Luxo
  amount: number;
  currency: 'BRL' | 'USD';
  link?: string;
}

export interface FlightSegment {
  origin_city: string;
  destination_city: string;
  departure_time: string; // HH:mm
  arrival_time: string; // HH:mm
  has_connection?: boolean;
  connection_city?: string;
  connection_time?: string; // HH:mm
}

export interface QuoteFlightDetails {
  outbound: FlightSegment;
  inbound: FlightSegment;
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

  // Datas e Pax
  check_in: string; // dd/mm/aaaa
  check_out: string; // dd/mm/aaaa
  adults: number;
  children: number;

  // Detalhes do Voo
  flight_details: QuoteFlightDetails;

  // Detalhes Gerais
  tour_details?: string; // Opcional {passeio}
  has_transfer?: boolean; // Traslado chegada e saída

  // Lista de Hotéis (Dinâmica)
  hotel_options: HotelOption[];

  // Campos Legados (Mantidos para compatibilidade, mas podem ser ignorados na UI nova se vazios)
  city?: string;
  notes?: string;
}