import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  OnInit,
  Input,
  OnChanges,
  SimpleChanges,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  CelulaCalendario,
  DiaCalendarioResumo,
  ReservaCalendario,
  ResumoMensal,
} from '../../models/calendario-embarques.models';
import { CalendarioEmbarquesService } from '../../services/calendario-embarques.service';
import { Reservation } from '../../models/reservation';

@Component({
  selector: 'app-calendario-embarques',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './calendario-embarques.component.html',
  styleUrls: ['./calendario-embarques.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CalendarioEmbarquesComponent implements OnInit, OnChanges {
  @Input() rawReservations: Reservation[] = [];

  monthNames: string[] = [];
  weekDays: string[] = [];

  currentDate: Date = new Date();
  monthGrid: CelulaCalendario[] = [];
  summary: ResumoMensal = {
    ida: 0,
    volta: 0,
    total: 0,
    pico: null,
  };

  drawerOpen = false;
  selectedDay: DiaCalendarioResumo | null = null;
  reservas: ReservaCalendario[] = [];

  // Passenger Modal State
  isPassengersModalOpen = false;
  selectedReservationForModal: ReservaCalendario | null = null;

  constructor(
    private readonly calendarioService: CalendarioEmbarquesService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.monthNames = this.calendarioService.getMonthNames();
    this.weekDays = this.calendarioService.getWeekDays();
    this.currentDate = new Date();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['rawReservations']) {
      this.reservas = this.calendarioService.mapReservationToMovimentos(this.rawReservations || []);
      this.loadCalendar();
    }
  }

  loadCalendar(): void {
    const resumoPorDia = this.calendarioService.buildResumoPorDia(this.reservas);
    this.monthGrid = this.calendarioService.buildMonthGrid(this.currentDate, resumoPorDia);
    this.summary = this.calendarioService.buildResumoMensal(this.currentDate, resumoPorDia);
    
    // Safety check just in case the active selected day was modified
    if (this.selectedDay) {
       this.selectedDay = resumoPorDia[this.selectedDay.date] || null;
       if (!this.selectedDay) this.drawerOpen = false;
    }
  }

  previousMonth(): void {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() - 1,
      1,
    );
    this.loadCalendar();
  }

  nextMonth(): void {
    this.currentDate = new Date(
      this.currentDate.getFullYear(),
      this.currentDate.getMonth() + 1,
      1,
    );
    this.loadCalendar();
  }
  
  resetToToday(): void {
    this.currentDate = new Date();
    this.loadCalendar();
  }

  selectDay(cell: CelulaCalendario): void {
    if (!cell.date || !cell.resumo) {
      return;
    }

    this.selectedDay = cell.resumo;
    this.drawerOpen = true;
  }

  closeDrawer(): void {
    this.drawerOpen = false;
  }

  openPassengersModal(reserva: ReservaCalendario, event: Event): void {
    event.stopPropagation();
    this.selectedReservationForModal = reserva;
    this.isPassengersModalOpen = true;
  }

  closePassengersModal(): void {
    this.isPassengersModalOpen = false;
    this.selectedReservationForModal = null;
  }

  trackByDate(index: number, item: CelulaCalendario): string {
    return item.key ?? `empty-${index}`;
  }

  trackByReserva(index: number, item: ReservaCalendario): string {
    return `${item.id}-${item.tipo}-${item.dataMovimento}-${index}`;
  }

  getIntensityClass(total: number): string {
    return this.calendarioService.getIntensityClass(total);
  }

  formatDatePtBr(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }

    return this.calendarioService.parseIsoDate(value).toLocaleDateString('pt-BR');
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.drawerOpen) {
      this.closeDrawer();
    }
  }
}
