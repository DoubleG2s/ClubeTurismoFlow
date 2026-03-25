export type TipoMovimento = 'IDA' | 'VOLTA';

export interface ReservaCalendario {
  id: string; // Internal UUID
  reservationNumber: string; // User-facing external ID
  cliente: string; // Titular
  destino: string;
  fornecedor: string;
  tipo: TipoMovimento;
  passageiros: number; // Tally
  listaPassageiros: string[]; // Actual list of names
  dataMovimento: string; // formato ISO: yyyy-MM-dd
}

export interface DiaCalendarioResumo {
  date: string; // yyyy-MM-dd
  ida: number;
  volta: number;
  total: number;
  reservas: ReservaCalendario[];
}

export interface CelulaCalendario {
  date: Date | null;
  key: string | null;
  isCurrentMonth: boolean;
  resumo: DiaCalendarioResumo | null;
}

export interface ResumoMensal {
  ida: number;
  volta: number;
  total: number;
  pico: DiaCalendarioResumo | null;
}

export interface FiltroCalendario {
  referencia: Date;
}
