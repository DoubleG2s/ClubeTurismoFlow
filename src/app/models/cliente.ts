export type ClienteGender = 'Feminino' | 'Masculino' | 'Outro' | '';

export const CLIENTE_TAG_OPTIONS = [
  'VIP',
  'Lua-de-mel',
  'Família',
  'Corporativo',
  'Recorrente',
  'Aniversário',
  'Premium'
] as const;

export type ClienteTag = typeof CLIENTE_TAG_OPTIONS[number];

export interface ClienteTrip {
  destination: string;
  trip_date: string;
  amount: number;
  trip_type: string;
}

export interface Cliente {
  id: string;

  // Dados pessoais
  full_name: string;
  cpf?: string;
  rg?: string;
  birth_date?: string;
  gender?: ClienteGender;

  // Contato
  email?: string;
  phone_number?: string;
  whatsapp_number?: string;

  // Endereço
  zip_code?: string;
  address_street?: string;
  address_number?: string;
  address_complement?: string;
  address_district?: string;
  address_city?: string;
  address_state?: string;

  // Segmentação
  tags: ClienteTag[];
  customer_since?: string;
  notes?: string;

  // Histórico (somente leitura, alimentado futuramente por reservas)
  trips?: ClienteTrip[];

  created_at?: string;
  updated_at?: string;
}

export type ClienteFormValue = Omit<Cliente, 'id' | 'created_at' | 'updated_at' | 'trips'>;
