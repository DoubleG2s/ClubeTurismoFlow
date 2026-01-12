import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlightService } from './services/flight.service';
import { ReservationService } from './services/reservation.service';
import { AuthService } from './services/auth.service';

import { FlightFormComponent } from './components/flight-form/flight-form.component';
import { FlightCardComponent } from './components/flight-card/flight-card.component';
import { ReservationFormComponent } from './components/reservation-form/reservation-form.component';
import { ReservationCardComponent } from './components/reservation-card/reservation-card.component';
import { LoginComponent } from './components/login/login.component';
import { UserListComponent } from './components/user-management/user-list.component';

import { Flight } from './models/flight';
import { Reservation } from './models/reservation';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule, 
    FlightFormComponent, 
    FlightCardComponent,
    ReservationFormComponent,
    ReservationCardComponent,
    LoginComponent,
    UserListComponent
  ],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private flightService = inject(FlightService);
  private reservationService = inject(ReservationService);
  public authService = inject(AuthService); // Public for HTML access
  
  // State
  activeTab = signal<'voos' | 'reservas' | 'hotel' | 'usuarios'>('voos');
  
  // Flight Edit State
  editingFlight = signal<Flight | null>(null);
  prefilledFlightData = signal<Partial<Flight> | null>(null);
  showEditModal = signal(false);

  // Reservation Edit State
  editingReservation = signal<Reservation | null>(null);
  showReservationEditModal = signal(false);

  // --- FILTERS & SORTING STATE ---
  searchTerm = signal('');
  showAdvancedFilters = signal(false);

  // 1. DRAFT STATE (User is typing, but not applied yet)
  draftDateStart = signal(''); 
  draftDateEnd = signal('');   
  draftReturnStart = signal(''); 
  draftReturnEnd = signal('');   

  // 2. ACTIVE STATE (Filters actually applied to the list)
  activeDateStart = signal(''); 
  activeDateEnd = signal('');   
  activeReturnStart = signal(''); 
  activeReturnEnd = signal(''); 

  // Sorting
  sortField = signal<'date' | 'return_date'>('date');
  sortDirection = signal<'asc' | 'desc'>('desc'); // Default: Mais recente primeiro

  // Derived state
  flights = this.flightService.flights;
  reservations = this.reservationService.reservations;
  
  // Computed filtered reservations
  filteredReservations = computed(() => {
    let result = this.reservations();
    const term = this.searchTerm().toLowerCase().trim();

    // 1. Text Search (Immediate)
    if (term) {
      result = result.filter(res => 
        res.passengers.some(p => p.toLowerCase().includes(term)) ||
        res.reservation_number.toLowerCase().includes(term) ||
        (res.flight_voucher && res.flight_voucher.toLowerCase().includes(term))
      );
    }

    // 2. Date Range Filters (Uses ACTIVE signals, not drafts)
    const dStart = this.parseDate(this.activeDateStart());
    const dEnd = this.parseDate(this.activeDateEnd());
    const rStart = this.parseDate(this.activeReturnStart());
    const rEnd = this.parseDate(this.activeReturnEnd());

    if (dStart || dEnd || rStart || rEnd) {
      result = result.filter(res => {
        const resDate = this.parseDate(res.date);
        const resReturn = res.return_date ? this.parseDate(res.return_date) : 0;

        const matchIda = (!dStart || resDate >= dStart) && (!dEnd || resDate <= dEnd);
        
        const hasReturnFilter = rStart || rEnd;
        let matchVolta = true;
        
        if (hasReturnFilter) {
           if (!resReturn) matchVolta = false;
           else matchVolta = (!rStart || resReturn >= rStart) && (!rEnd || resReturn <= rEnd);
        }

        return matchIda && matchVolta;
      });
    }

    // 3. Sorting
    const field = this.sortField();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;

    result = [...result].sort((a, b) => {
      const dateA = field === 'date' ? this.parseDate(a.date) : (a.return_date ? this.parseDate(a.return_date) : 0);
      const dateB = field === 'date' ? this.parseDate(b.date) : (b.return_date ? this.parseDate(b.return_date) : 0);
      
      return (dateA - dateB) * direction;
    });

    return result;
  });

  // Check if any filter (Text OR Date) is active
  hasActiveFilters = computed(() => {
    return !!(
      this.searchTerm() || 
      this.activeDateStart() || 
      this.activeDateEnd() || 
      this.activeReturnStart() || 
      this.activeReturnEnd()
    );
  });

  // Check if user typed anything in the draft fields (to enable the "Filter" button)
  hasDraftFilters = computed(() => {
    return !!(
      this.draftDateStart() || 
      this.draftDateEnd() || 
      this.draftReturnStart() || 
      this.draftReturnEnd()
    );
  });

  isLoading = this.flightService.isLoading; 

  ngOnInit() {
    // Data loaded in services
  }

  // --- Helper Methods ---

  private parseDate(dateStr: string): number {
    if (!dateStr || dateStr.length < 10) return 0;
    const parts = dateStr.split('/');
    if (parts.length !== 3) return 0;
    return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
  }

  toggleSort(field: 'date' | 'return_date') {
    if (this.sortField() === field) {
      this.sortDirection.update(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortField.set(field);
      this.sortDirection.set('desc');
    }
  }

  // Action: Apply the typed dates to the active filter logic
  applyAdvancedFilters() {
    this.activeDateStart.set(this.draftDateStart());
    this.activeDateEnd.set(this.draftDateEnd());
    this.activeReturnStart.set(this.draftReturnStart());
    this.activeReturnEnd.set(this.draftReturnEnd());
  }

  // Action: Clear everything
  clearFilters() {
    // Clear Text
    this.searchTerm.set('');
    
    // Clear Drafts
    this.draftDateStart.set('');
    this.draftDateEnd.set('');
    this.draftReturnStart.set('');
    this.draftReturnEnd.set('');

    // Clear Actives
    this.activeDateStart.set('');
    this.activeDateEnd.set('');
    this.activeReturnStart.set('');
    this.activeReturnEnd.set('');
    
    // Reset Sort to Default
    this.sortField.set('date');
    this.sortDirection.set('desc');
  }

  onDateInput(event: Event, signalSetter: any) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); 
    if (value.length > 8) value = value.slice(0, 8);
    if (value.length >= 5) {
      value = value.slice(0, 2) + '/' + value.slice(2, 4) + '/' + value.slice(4);
    } else if (value.length >= 3) {
      value = value.slice(0, 2) + '/' + value.slice(2);
    }
    input.value = value;
    signalSetter.set(value);
  }

  // --- Auth Actions ---
  async onLogout() {
    await this.authService.signOut();
    this.activeTab.set('voos');
  }

  // --- Flight Actions ---
  async onAddFlight(flightData: Omit<Flight, 'id' | 'created_at' | 'confirmed'>) {
    await this.flightService.addFlight(flightData);
    if (this.showEditModal()) {
      this.closeEditModal();
    }
  }

  async onUpdateFlight(event: {id: string, data: Partial<Flight>}) {
    await this.flightService.updateFlight(event.id, event.data);
    this.closeEditModal();
  }

  onRemoveFlight(id: string) {
    this.flightService.removeFlight(id);
  }

  onToggleConfirm(event: {id: string, checked: boolean}) {
    this.flightService.toggleConfirmation(event.id, event.checked);
  }

  startEdit(id: string) {
    const flight = this.flights().find(f => f.id === id);
    if (flight) {
      this.editingFlight.set(flight);
      this.showEditModal.set(true);
    }
  }

  closeEditModal() {
    this.showEditModal.set(false);
    this.editingFlight.set(null);
    this.prefilledFlightData.set(null);
  }

  // --- Reservation Actions ---
  async onAddReservation(data: Omit<Reservation, 'id' | 'created_at'>) {
    await this.reservationService.addReservation(data);
  }

  async onUpdateReservation(event: {id: string, data: Partial<Reservation>}) {
    await this.reservationService.updateReservation(event.id, event.data);
  }

  async onUpdateReservationForm(event: {id: string, data: Partial<Reservation>}) {
    await this.reservationService.updateReservation(event.id, event.data);
    this.closeReservationEditModal();
  }

  onRemoveReservation(id: string) {
    this.reservationService.removeReservation(id);
  }

  startEditReservation(id: string) {
    const reservation = this.reservations().find(r => r.id === id);
    if (reservation) {
      this.editingReservation.set(reservation);
      this.showReservationEditModal.set(true);
    }
  }

  closeReservationEditModal() {
    this.showReservationEditModal.set(false);
    this.editingReservation.set(null);
  }

  async onCopyReservationToFlight(reservation: Reservation) {
    if (!reservation.flight_voucher) {
      alert('Esta reserva não possui um voucher de voo.');
      return;
    }

    const prefillData: Partial<Flight> = {
      locator: reservation.flight_voucher,
      date: reservation.date,
      return_date: reservation.return_date,
      origin: '' 
    };

    this.prefilledFlightData.set(prefillData);
    this.showEditModal.set(true);
    this.activeTab.set('voos'); 
    
    if (!reservation.checklist.flight_registered) {
       this.reservationService.updateReservation(reservation.id, {
         checklist: { ...reservation.checklist, flight_registered: true }
       });
    }
  }

  switchTab(tab: 'voos' | 'reservas' | 'hotel' | 'usuarios') {
    this.activeTab.set(tab);
  }
}