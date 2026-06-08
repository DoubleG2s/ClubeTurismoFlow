export type AppTab = 'voos' | 'reservas' | 'cotacoes' | 'hotel' | 'usuarios' | 'admin' | 'assinatura';
export type ReservationSubTab = 'reservas' | 'creditos' | 'calendario';
export type HotelSubTab = 'hoteis' | 'email';
export type QuoteSubTab = 'cadastro' | 'calculadora';
export type QuickFilter = 'hoje' | 'amanha' | 'em_viagem' | null;
export type ReservationSortField = 'date' | 'return_date' | 'created_at';
export type SortDirection = 'asc' | 'desc';
export type AccessGateState = 'open' | 'locked';

export interface ReservationActiveFilters {
  searchTerm: string;
  quickFilter: QuickFilter;
  dateStart: string;
  dateEnd: string;
  returnStart: string;
  returnEnd: string;
  missingHotelEmail: boolean;
  missingPostTrip: boolean;
  sortField: ReservationSortField;
  sortDirection: SortDirection;
}

export interface ReservationDraftFilters {
  dateStart: string;
  dateEnd: string;
  returnStart: string;
  returnEnd: string;
  missingHotelEmail: boolean;
  missingPostTrip: boolean;
}

export const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro'
] as const;
