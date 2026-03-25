import { Injectable } from '@angular/core';
import {
  CelulaCalendario,
  DiaCalendarioResumo,
  ReservaCalendario,
  ResumoMensal,
} from '../models/calendario-embarques.models';
import { Reservation } from '../models/reservation';

@Injectable({
  providedIn: 'root',
})
export class CalendarioEmbarquesService {
  private readonly monthNames = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
  ];

  private readonly weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  getMonthNames(): string[] {
    return this.monthNames;
  }

  getWeekDays(): string[] {
    return this.weekDays;
  }
  
  // ADAPTER: Converts Clube Turismo Reservation to UI format
  parseBrDateToIso(dateStr: string | undefined): string | null {
    if (!dateStr) return null;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      return `${parts[2]}-${parts[1]}-${parts[0]}`;
    }
    return null;
  }

  mapReservationToMovimentos(reservas: Reservation[]): ReservaCalendario[] {
    const movimentos: ReservaCalendario[] = [];
    
    reservas.forEach(r => {
      const pCount = r.passengers && r.passengers.length > 0 ? r.passengers.length : 1;
      const primaryClient = (r.passengers && r.passengers.length > 0) ? r.passengers[0] : 'Viajante Desconhecido';
      
      const idaDate = this.parseBrDateToIso(r.date);
      const voltaDate = this.parseBrDateToIso(r.return_date);

      if (idaDate) {
        movimentos.push({
          id: r.id || '',
          reservationNumber: r.reservation_number || 'S/ Número',
          cliente: primaryClient,
          destino: r.destination || 'Destino',
          fornecedor: r.flight_voucher ? `Voo: ${r.flight_voucher}` : (r.notes || 'ND'),
          tipo: 'IDA',
          passageiros: pCount,
          listaPassageiros: r.passengers || [],
          dataMovimento: idaDate
        });
      }

      if (voltaDate) {
        movimentos.push({
          id: r.id || '',
          reservationNumber: r.reservation_number || 'S/ Número',
          cliente: primaryClient,
          destino: r.destination || 'Destino',
          fornecedor: r.flight_voucher ? `Voo: ${r.flight_voucher}` : (r.notes || 'ND'),
          tipo: 'VOLTA',
          passageiros: pCount,
          listaPassageiros: r.passengers || [],
          dataMovimento: voltaDate
        });
      }
    });

    return movimentos;
  }

  buildResumoPorDia(reservas: ReservaCalendario[]): Record<string, DiaCalendarioResumo> {
    return reservas.reduce<Record<string, DiaCalendarioResumo>>((acc, reserva) => {
      const key = reserva.dataMovimento;

      if (!acc[key]) {
        acc[key] = {
          date: key,
          ida: 0,
          volta: 0,
          total: 0,
          reservas: [],
        };
      }

      if (reserva.tipo === 'IDA') {
        acc[key].ida += reserva.passageiros;
      }

      if (reserva.tipo === 'VOLTA') {
        acc[key].volta += reserva.passageiros;
      }

      acc[key].total += reserva.passageiros;
      acc[key].reservas.push(reserva);

      return acc;
    }, {});
  }

  buildResumoMensal(
    referencia: Date,
    resumoPorDia: Record<string, DiaCalendarioResumo>,
  ): ResumoMensal {
    const diasDoMes = Object.values(resumoPorDia).filter((item) => {
      const date = this.parseIsoDate(item.date);
      return (
        date.getFullYear() === referencia.getFullYear() &&
        date.getMonth() === referencia.getMonth()
      );
    });

    const ida = diasDoMes.reduce((acc, item) => acc + item.ida, 0);
    const volta = diasDoMes.reduce((acc, item) => acc + item.volta, 0);
    const total = diasDoMes.reduce((acc, item) => acc + item.total, 0);
    const pico = diasDoMes.reduce<DiaCalendarioResumo | null>((best, item) => {
      if (!best || item.total > best.total) {
        return item;
      }
      return best;
    }, null);

    return { ida, volta, total, pico };
  }

  buildMonthGrid(
    referencia: Date,
    resumoPorDia: Record<string, DiaCalendarioResumo>,
  ): CelulaCalendario[] {
    const year = referencia.getFullYear();
    const month = referencia.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const cells: CelulaCalendario[] = [];

    for (let i = 0; i < startOffset; i += 1) {
      cells.push({
        date: null,
        key: null,
        isCurrentMonth: false,
        resumo: null,
      });
    }

    for (let day = 1; day <= totalDays; day += 1) {
      const date = new Date(year, month, day);
      const key = this.formatDateKey(date);

      cells.push({
        date,
        key,
        isCurrentMonth: true,
        resumo: resumoPorDia[key] ?? null,
      });
    }

    while (cells.length % 7 !== 0) {
      cells.push({
        date: null,
        key: null,
        isCurrentMonth: false,
        resumo: null,
      });
    }

    return cells;
  }

  formatDateKey(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  parseIsoDate(value: string): Date {
    return new Date(`${value}T12:00:00`);
  }

  getIntensityClass(total: number): string {
    if (total >= 12) return 'intensity-4';
    if (total >= 7) return 'intensity-3';
    if (total >= 3) return 'intensity-2';
    if (total >= 1) return 'intensity-1';
    return 'intensity-0';
  }
}
