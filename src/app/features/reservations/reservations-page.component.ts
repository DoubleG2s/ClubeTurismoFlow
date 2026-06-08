import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CreditCardComponent } from '../../components/credit-card/credit-card.component';
import { CreditFormComponent } from '../../components/credit-form/credit-form.component';
import { ReservationCardComponent } from '../../components/reservation-card/reservation-card.component';
import { ReservationFormComponent } from '../../components/reservation-form/reservation-form.component';
import { CalendarioEmbarquesComponent } from '../../components/calendario-embarques/calendario-embarques.component';
import {
  QuickFilter,
  ReservationSortField,
  ReservationSubTab,
  SortDirection
} from '../../layout/app-shell.types';
import { Credit } from '../../models/credit';
import { Reservation } from '../../models/reservation';
import { formatInputDateToPtBr, formatPtBrDateToInputValue } from '../../shared/utils/date.utils';

@Component({
  selector: 'app-reservations-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReservationFormComponent,
    ReservationCardComponent,
    CreditFormComponent,
    CreditCardComponent,
    CalendarioEmbarquesComponent
  ],
  templateUrl: './reservations-page.component.html'
})
export class ReservationsPageComponent {
  formOpen = false;
  creditFormOpen = false;

  @Input() activeSubTab: ReservationSubTab = 'reservas';
  @Input() prefilledReservationData: Partial<Reservation> | null = null;
  @Input() filteredReservations: Reservation[] = [];
  @Input() listAnimationClass = '';
  @Input() monthName = '';
  @Input() activeQuickFilter: QuickFilter = null;
  @Input() searchTerm = '';
  @Input() showAdvancedFilters = false;
  @Input() hasActiveFilters = false;
  @Input() hasDraftFilters = false;
  @Input() draftDateStart = '';
  @Input() draftDateEnd = '';
  @Input() draftReturnStart = '';
  @Input() draftReturnEnd = '';
  @Input() draftMissingHotelEmail = false;
  @Input() draftMissingPostTrip = false;
  @Input() sortField: ReservationSortField = 'date';
  @Input() sortDirection: SortDirection = 'asc';
  @Input() credits: Credit[] = [];
  @Input() isSavingCredit = false;
  @Input() prefilledCreditData: Partial<Credit> | null = null;
  @Input() rawReservations: Reservation[] = [];

  @Output() activeSubTabChange = new EventEmitter<ReservationSubTab>();
  @Output() addReservation = new EventEmitter<Omit<Reservation, 'id' | 'created_at'>>();
  @Output() prevMonth = new EventEmitter<void>();
  @Output() nextMonth = new EventEmitter<void>();
  @Output() quickFilterToggle = new EventEmitter<Exclude<QuickFilter, null>>();
  @Output() searchTermChange = new EventEmitter<string>();
  @Output() showAdvancedFiltersChange = new EventEmitter<boolean>();
  @Output() draftDateStartChange = new EventEmitter<string>();
  @Output() draftDateEndChange = new EventEmitter<string>();
  @Output() draftReturnStartChange = new EventEmitter<string>();
  @Output() draftReturnEndChange = new EventEmitter<string>();
  @Output() draftMissingHotelEmailChange = new EventEmitter<boolean>();
  @Output() draftMissingPostTripChange = new EventEmitter<boolean>();
  @Output() toggleSort = new EventEmitter<ReservationSortField>();
  @Output() clearFilters = new EventEmitter<void>();
  @Output() applyFilters = new EventEmitter<void>();
  @Output() updateReservation = new EventEmitter<{ id: string; data: Partial<Reservation> }>();
  @Output() editReservation = new EventEmitter<string>();
  @Output() removeReservation = new EventEmitter<string>();
  @Output() addToFlights = new EventEmitter<Reservation>();
  @Output() prepareHotelEmail = new EventEmitter<Reservation>();
  @Output() addCredit = new EventEmitter<Omit<Credit, 'id' | 'created_at' | 'expiration_date'>>();
  @Output() editCredit = new EventEmitter<string>();
  @Output() removeCredit = new EventEmitter<string>();

  selectSubTab(tab: ReservationSubTab) {
    this.activeSubTabChange.emit(tab);
  }

  formatForDatePicker(dateStr: string): string {
    return formatPtBrDateToInputValue(dateStr);
  }

  onNativeDateChange(event: Event, field: 'start' | 'end' | 'returnStart' | 'returnEnd') {
    const input = event.target as HTMLInputElement;
    const formatted = formatInputDateToPtBr(input.value);

    switch (field) {
      case 'start':
        this.draftDateStartChange.emit(formatted);
        break;
      case 'end':
        this.draftDateEndChange.emit(formatted);
        break;
      case 'returnStart':
        this.draftReturnStartChange.emit(formatted);
        break;
      case 'returnEnd':
        this.draftReturnEndChange.emit(formatted);
        break;
    }
  }
}
