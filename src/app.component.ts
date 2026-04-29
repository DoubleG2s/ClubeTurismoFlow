import { Component, inject, signal, computed, OnInit, ViewChild, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FlightService } from './services/flight.service';
import { ReservationService } from './services/reservation.service';
import { QuoteService } from './services/quote.service';
import { AuthService } from './services/auth.service';
import { HotelService } from './services/hotel.service';
import { CreditService } from './services/credit.service';

import { FlightFormComponent } from './components/flight-form/flight-form.component';
import { FlightCardComponent } from './components/flight-card/flight-card.component';
import { ReservationFormComponent } from './components/reservation-form/reservation-form.component';
import { ReservationCardComponent } from './components/reservation-card/reservation-card.component';
import { QuoteFormComponent } from './components/quote-form/quote-form.component';
import { QuoteCardComponent } from './components/quote-card/quote-card.component';
import { HotelFormComponent } from './components/hotel-form/hotel-form.component';
import { HotelCardComponent } from './components/hotel-card/hotel-card.component';
import { HotelDetailsComponent } from './components/hotel-details/hotel-details.component';
import { ConfirmModalComponent } from './components/shared/confirm-modal/confirm-modal.component';
import { LoginComponent } from './components/login/login.component';
import { UserListComponent } from './components/user-management/user-list.component';
import { CreditFormComponent } from './components/credit-form/credit-form.component';
import { CreditCardComponent } from './components/credit-card/credit-card.component';
import { HotelEmailGeneratorComponent } from './components/hotel-email-generator/hotel-email-generator.component';
import { AiChatComponent } from './components/ai-chat/ai-chat.component';
import { CalendarioEmbarquesComponent } from './components/calendario-embarques/calendario-embarques.component';
import { AiAction } from './services/ai-interpreter.service';

import { AdminMasterComponent } from './components/admin-master/admin-master.component';
import { SubscriptionComponent } from './app/pages/subscription/subscription'; // Importando a tela SaaS
import { SubscriptionService } from './services/subscription.service';
import { QuoteProposalComponent } from './components/quote-proposal/quote-proposal.component';

import { Flight } from './models/flight';
import { Reservation } from './models/reservation';
import { Quote } from './models/quote';
import { Hotel } from './models/hotel';
import { Credit } from './models/credit';

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
    QuoteFormComponent,
    QuoteCardComponent,
    HotelFormComponent,
    HotelCardComponent,
    HotelDetailsComponent,
    ConfirmModalComponent,
    LoginComponent,
    UserListComponent,
    CreditFormComponent,
    CreditCardComponent,
    HotelEmailGeneratorComponent,
    AiChatComponent,
    CalendarioEmbarquesComponent,
    AdminMasterComponent,
    SubscriptionComponent,
    QuoteProposalComponent
  ],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private flightService = inject(FlightService);
  private reservationService = inject(ReservationService);
  private quoteService = inject(QuoteService);
  private hotelService = inject(HotelService);
  private creditService = inject(CreditService);
  public authService = inject(AuthService);
  private subscriptionService = inject(SubscriptionService);

  // ViewChild para controlar o formulário de cotação
  @ViewChild(QuoteFormComponent) quoteFormComp!: QuoteFormComponent;

  // State
  activeTab = signal<'voos' | 'reservas' | 'cotacoes' | 'hotel' | 'usuarios' | 'admin' | 'assinatura'>('reservas');
  isLockedOut = signal<boolean>(false); // Catraca SaaS
  activeReservaTab = signal<'reservas' | 'creditos' | 'calendario'>('reservas');
  activeHotelTab = signal<'hoteis' | 'email'>('hoteis');
  activeCotacaoTab = signal<'cadastro' | 'calculadora'>('cadastro');
  isFullscreenProposal = signal<boolean>(false);
  proposalQuoteId = signal<string>('');
  publicQuoteToken = signal<string>('');

  // Flight Edit State
  editingFlight = signal<Flight | null>(null);
  prefilledFlightData = signal<Partial<Flight> | null>(null);
  showEditModal = signal(false);

  // Reservation Edit State
  editingReservation = signal<Reservation | null>(null);
  showReservationEditModal = signal(false);
  prefilledReservationData = signal<Partial<Reservation> | null>(null);

  // Quote State
  editingQuote = signal<Quote | null>(null);
  showQuoteEditModal = signal(false);
  usdExchangeRate = signal<number>(6.00);
  isSavingQuote = signal(false);
  prefilledQuoteData = signal<Partial<Quote> | null>(null);

  // Hotel State
  editingHotel = signal<Hotel | null>(null);
  showHotelEditModal = signal(false);
  prefilledHotelName = signal<string>('');

  // Hotel Details View State
  selectedHotelDetails = signal<Hotel | null>(null);
  showHotelDetailsModal = signal(false);

  // Hotel Search State
  hotelSearchInputValue = signal('');
  hotelSearchTerm = signal('');
  private hotelSearchTimeout: any;

  // Credit State
  editingCredit = signal<Credit | null>(null);
  showCreditEditModal = signal(false);
  isSavingCredit = signal(false);
  prefilledCreditData = signal<Partial<Credit> | null>(null);

  // Shared Modal State
  showConfirmDeleteModal = signal(false);
  itemToDelete = signal<{ type: 'hotel', id: string } | null>(null);

  // --- FILTERS & SORTING STATE ---
  searchTerm = signal('');
  activeQuickFilter = signal<'hoje' | 'amanha' | 'em_viagem' | null>(null);
  showAdvancedFilters = signal(false);

  // ... (Sinais de filtro mantidos iguais) ...
  draftDateStart = signal('');
  draftDateEnd = signal('');
  draftReturnStart = signal('');
  draftReturnEnd = signal('');
  activeDateStart = signal('');
  activeDateEnd = signal('');
  activeReturnStart = signal('');
  activeReturnEnd = signal('');

  // Novos Sinais de Filtro
  draftMissingHotelEmail = signal(false);
  draftMissingPostTrip = signal(false);
  activeMissingHotelEmail = signal(false);
  activeMissingPostTrip = signal(false);

  sortField = signal<'date' | 'return_date'>('date');
  sortDirection = signal<'asc' | 'desc'>('desc');

  // --- List Animation State ---
  listAnimationClass = signal<string>('');

  triggerListAnimation() {
    this.listAnimationClass.set('');
    // Força reflow para reiniciar a animação
    setTimeout(() => this.listAnimationClass.set('animate-fade-in'), 10);
  }

  // --- Month Navigation State ---
  activeMonth = signal<number>(new Date().getMonth());
  activeYear = signal<number>(new Date().getFullYear());
  
  monthName = computed(() => {
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    return `${months[this.activeMonth()]} ${this.activeYear()}`;
  });

  prevMonth() {
    this.activeMonth.update(m => {
      if (m === 0) {
        this.activeYear.update(y => y - 1);
        return 11;
      }
      return m - 1;
    });
    this.triggerListAnimation();
  }

  nextMonth() {
    this.activeMonth.update(m => {
      if (m === 11) {
        this.activeYear.update(y => y + 1);
        return 0;
      }
      return m + 1;
    });
    this.triggerListAnimation();
  }

  // Derived state
  flights = this.flightService.flights;
  reservations = this.reservationService.reservations;
  quotes = this.quoteService.quotes;
  hotels = this.hotelService.hotels;
  credits = this.creditService.credits;

  // Computed filtered hotels
  filteredHotels = computed(() => {
    let result = this.hotels();
    const term = this.hotelSearchTerm().toLowerCase().trim();

    if (term) {
      result = result.filter(h => h.name.toLowerCase().includes(term));
    }
    
    return result;
  });

  // Computed filtered reservations
  filteredReservations = computed(() => {
    let result = this.reservations();

    // 1. Month Filter (Ida)
    const month = this.activeMonth();
    const year = this.activeYear();

    result = result.filter(res => {
      const qFilter = this.activeQuickFilter();
      if (qFilter === 'em_viagem') {
         // O filtro 'em_viagem' vai varrer reservas ativas independentemente do mês de ida
         return true;
      }

      if (!res.date || res.date.length < 10) return false;
      const parts = res.date.split('/');
      if (parts.length !== 3) return false;
      const resMonth = +parts[1] - 1;
      const resYear = +parts[2];
      return resMonth === month && resYear === year;
    });

    const term = this.searchTerm().toLowerCase().trim();

    if (term) {
      result = result.filter(res =>
        res.passengers.some(p => p.toLowerCase().includes(term)) ||
        res.reservation_number.toLowerCase().includes(term) ||
        (res.flight_voucher && res.flight_voucher.toLowerCase().includes(term))
      );
    }

    // Quick Filters Logic
    const qFilter = this.activeQuickFilter();
    if (qFilter) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();

      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowTime = tomorrow.getTime();

      result = result.filter(res => {
        const resDate = this.parseDate(res.date);
        const resReturn = res.return_date ? this.parseDate(res.return_date) : 0;

        if (qFilter === 'hoje') {
          return resDate === todayTime; // Somente ida
        } else if (qFilter === 'amanha') {
          return resDate === tomorrowTime; // Somente ida
        } else if (qFilter === 'em_viagem') {
          if (!resReturn) return false;
          return todayTime >= resDate && todayTime <= resReturn;
        }
        return true;
      });
    }

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

    const mHotel = this.activeMissingHotelEmail();
    const mPost = this.activeMissingPostTrip();
    
    if (mHotel || mPost) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTime = today.getTime();

      result = result.filter(res => {
        let matchHotel = true;
        let matchPost = true;

        if (mHotel) {
           matchHotel = !res.checklist?.hotel_email;
        }

        if (mPost) {
           const resReturn = res.return_date ? this.parseDate(res.return_date) : 0;
           matchPost = resReturn > 0 && resReturn < todayTime && !res.checklist?.post_trip;
        }

        return matchHotel && matchPost;
      });
    }

    const field = this.sortField();
    const direction = this.sortDirection() === 'asc' ? 1 : -1;

    result = [...result].sort((a, b) => {
      const dateA = field === 'date' ? this.parseDate(a.date) : (a.return_date ? this.parseDate(a.return_date) : 0);
      const dateB = field === 'date' ? this.parseDate(b.date) : (b.return_date ? this.parseDate(b.return_date) : 0);

      return (dateA - dateB) * direction;
    });

    return result;
  });

  hasActiveFilters = computed(() => {
    return !!(
      this.searchTerm() ||
      this.activeDateStart() ||
      this.activeDateEnd() ||
      this.activeReturnStart() ||
      this.activeReturnEnd() ||
      this.activeQuickFilter() !== null ||
      this.activeMissingHotelEmail() ||
      this.activeMissingPostTrip()
    );
  });

  hasDraftFilters = computed(() => {
    return !!(
      this.draftDateStart() ||
      this.draftDateEnd() ||
      this.draftReturnStart() ||
      this.draftReturnEnd() ||
      this.draftMissingHotelEmail() ||
      this.draftMissingPostTrip()
    );
  });

  isLoading = computed(() =>
    this.flightService.isLoading() ||
    this.reservationService.isLoading() ||
    this.quoteService.isLoading() ||
    this.hotelService.isLoading() ||
    this.creditService.isLoading()
  );

  constructor() {
    // Escuta o status de autenticação para checar regras da empresa ativa
    effect(() => {
       const user = this.authService.session();
       if (user) {
          // Quando o usuário loga e a company id está resolvida
          this.checkSubscriptionStatus();
       }
    });
  }

  ngOnInit() {
    const params = new URLSearchParams(window.location.search);
    
    const publicToken = params.get('public_quote');
    if (publicToken) {
      this.isFullscreenProposal.set(true);
      this.publicQuoteToken.set(publicToken);
      return; // Break out, no auth needed
    }

    const proposalId = params.get('proposal');
    if (proposalId) {
      this.isFullscreenProposal.set(true);
      this.proposalQuoteId.set(proposalId);
      return;
    }

    const tab = params.get('tab');
    if (tab === 'hotel') {
      this.activeTab.set('hotel');
      const newHotelName = params.get('new');
      if (newHotelName) {
        this.prefilledHotelName.set(newHotelName);
        // Não precisamos abrir o modal pois quando activeTab === 'hotel', 
        // o app-hotel-form é renderizado na listagem principal pela página se activeHotelTab === 'hoteis'.
        // Vamos garantir que a subTab de hoteis esteja ativa.
        this.activeHotelTab.set('hoteis');
        
        // Timeout pequeno só para rolar para o topo caso a div renderize atrasada
        setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 300);
      }
    }
  }

  async checkSubscriptionStatus() {
     const status = await this.subscriptionService.getCompanyStatus();
     
     if (!status || status.subscription_status !== 'active') {
        console.log('[Auth] Empresa inativa, trancando UI');
        this.isLockedOut.set(true);
        this.activeTab.set('assinatura');
     } else {
        // Liberado
        this.isLockedOut.set(false);
        if (this.activeTab() === 'assinatura') {
           this.activeTab.set('reservas'); // Restaura aba padrao
        }
     }
  }

  // --- Hotel Methods ---
  openHotelDetails(hotelId: string) {
    const hotel = this.hotels().find(h => h.id === hotelId);
    if (hotel) {
      this.selectedHotelDetails.set(hotel);
      this.showHotelDetailsModal.set(true);
    }
  }

  closeHotelDetailsModal() {
    this.showHotelDetailsModal.set(false);
    setTimeout(() => this.selectedHotelDetails.set(null), 300); // delay clear to let transition finish
  }

  // --- Helper Methods ---
  onHotelSearchInput(event: Event) {
    const term = (event.target as HTMLInputElement).value;
    this.hotelSearchInputValue.set(term);
    
    if (this.hotelSearchTimeout) {
      clearTimeout(this.hotelSearchTimeout);
    }
    this.hotelSearchTimeout = setTimeout(() => {
      this.hotelSearchTerm.set(term);
    }, 300);
  }

  clearHotelSearch() {
    this.hotelSearchInputValue.set('');
    this.hotelSearchTerm.set('');
    if (this.hotelSearchTimeout) {
      clearTimeout(this.hotelSearchTimeout);
    }
  }

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

  applyAdvancedFilters() {
    this.activeDateStart.set(this.draftDateStart());
    this.activeDateEnd.set(this.draftDateEnd());
    this.activeReturnStart.set(this.draftReturnStart());
    this.activeReturnEnd.set(this.draftReturnEnd());
    this.activeMissingHotelEmail.set(this.draftMissingHotelEmail());
    this.activeMissingPostTrip.set(this.draftMissingPostTrip());
    
    this.triggerListAnimation();
  }

  clearFilters() {
    this.searchTerm.set('');
    this.activeQuickFilter.set(null);
    this.draftDateStart.set('');
    this.draftDateEnd.set('');
    this.draftReturnStart.set('');
    this.draftReturnEnd.set('');
    this.draftMissingHotelEmail.set(false);
    this.draftMissingPostTrip.set(false);
    this.activeDateStart.set('');
    this.activeDateEnd.set('');
    this.activeReturnStart.set('');
    this.activeReturnEnd.set('');
    this.activeMissingHotelEmail.set(false);
    this.activeMissingPostTrip.set(false);
    this.sortField.set('date');
    this.sortDirection.set('desc');
    
    this.triggerListAnimation();
  }

  toggleQuickFilter(filter: 'hoje' | 'amanha' | 'em_viagem') {
    if (this.activeQuickFilter() === filter) {
      this.activeQuickFilter.set(null);
    } else {
      this.activeQuickFilter.set(filter);
      
      // Sincronizar controle mensal para os filtros Rápidos
      if (filter === 'hoje' || filter === 'amanha' || filter === 'em_viagem') {
        const targetDate = new Date();
        if (filter === 'amanha') {
           targetDate.setDate(targetDate.getDate() + 1);
        }
        this.activeMonth.set(targetDate.getMonth());
        this.activeYear.set(targetDate.getFullYear());
      }
    }
    this.triggerListAnimation();
  }

  formatForDatePicker(dateStr: string): string {
    if (!dateStr || dateStr.length !== 10) return '';
    const parts = dateStr.split('/');
    if (parts.length !== 3) return '';
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
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

  onNativeDateChange(event: Event, signalSetter: any) {
    const input = event.target as HTMLInputElement;
    const val = input.value; // yyyy-mm-dd
    if (val && val.length === 10) {
      const parts = val.split('-');
      signalSetter.set(`${parts[2]}/${parts[1]}/${parts[0]}`);
    } else {
      signalSetter.set('');
    }
  }

  onExchangeRateInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    if (!isNaN(value) && value > 0) {
      this.usdExchangeRate.set(value);
    }
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

  async onUpdateFlight(event: { id: string, data: Partial<Flight> }) {
    await this.flightService.updateFlight(event.id, event.data);
    this.closeEditModal();
  }

  onRemoveFlight(id: string) {
    this.flightService.removeFlight(id);
  }

  onToggleConfirm(event: { id: string, checked: boolean }) {
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

  async onUpdateReservation(event: { id: string, data: Partial<Reservation> }) {
    await this.reservationService.updateReservation(event.id, event.data);
  }

  async onUpdateReservationForm(event: { id: string, data: Partial<Reservation> }) {
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

  // --- Quote Actions ---
  async onAddQuote(data: Omit<Quote, 'id' | 'created_at'>) {
    this.isSavingQuote.set(true);
    try {
      const success = await this.quoteService.addQuote(data);
      if (success && this.quoteFormComp) {
        this.quoteFormComp.resetForm(); // Reset apenas se sucesso
      }
    } catch (e) {
      console.error('Falha inesperada no app.component ao salvar cotação', e);
    } finally {
      this.isSavingQuote.set(false);
    }
  }

  async onUpdateQuote(event: { id: string, data: Partial<Quote> }) {
    await this.quoteService.updateQuote(event.id, event.data);
    this.closeQuoteEditModal();
  }

  onRemoveQuote(id: string) {
    this.quoteService.removeQuote(id);
  }

  startEditQuote(id: string) {
    const quote = this.quotes().find(q => q.id === id);
    if (quote) {
      this.editingQuote.set(quote);
      this.showQuoteEditModal.set(true);
    }
  }

  closeQuoteEditModal() {
    this.showQuoteEditModal.set(false);
    this.editingQuote.set(null);
  }

  // --- Hotel Actions ---
  async onSaveHotel(event: any) {
    if (this.editingHotel()) {
      const newEmails = event.emails.filter((e: any) => !e.id).map((e: any) => ({ email: e.email, type: e.type }));
      const newPhones = event.phones.filter((p: any) => !p.id).map((p: any) => ({ phone: p.phone, is_whatsapp: p.is_whatsapp }));

      await this.hotelService.updateHotel(
        this.editingHotel()!.id,
        event.hotelData,
        newEmails,
        newPhones,
        event.newImages,
        event.deletedEmailIds,
        event.deletedPhoneIds,
        event.deletedImageIds
      );
    } else {
      await this.hotelService.addHotel(event.hotelData, event.emails, event.phones, event.images);
    }

    if (this.showHotelEditModal()) {
      this.closeHotelEditModal();
    }
  }

  startEditHotel(id: string) {
    const hotel = this.hotels().find(h => h.id === id);
    if (hotel) {
      this.editingHotel.set(hotel);
      this.showHotelEditModal.set(true);
    }
  }

  closeHotelEditModal() {
    this.showHotelEditModal.set(false);
    this.editingHotel.set(null);
  }

  promptDeleteHotel(id: string) {
    this.itemToDelete.set({ type: 'hotel', id });
    this.showConfirmDeleteModal.set(true);
  }

  confirmDelete() {
    const item = this.itemToDelete();
    if (item && item.type === 'hotel') {
      this.hotelService.deleteHotel(item.id);
    }
    this.closeConfirmModal();
  }

  closeConfirmModal() {
    this.showConfirmDeleteModal.set(false);
    this.itemToDelete.set(null);
  }

  switchTab(tab: 'voos' | 'reservas' | 'cotacoes' | 'hotel' | 'usuarios' | 'admin') {
    this.activeTab.set(tab);
  }

  switchReservaTab(tab: 'reservas' | 'creditos' | 'calendario') {
    this.activeReservaTab.set(tab);
  }

  switchHotelTab(tab: 'hoteis' | 'email') {
    this.activeHotelTab.set(tab);
  }

  switchCotacaoTab(tab: 'cadastro' | 'calculadora') {
    this.activeCotacaoTab.set(tab);
  }

  // --- Ai Assistant Actions ---
  @ViewChild('aiChat') aiChatComp!: AiChatComponent;

  isTabChanging(action: AiAction): boolean {
    const t = action.type;
    if (t.includes('RESERVATION')) return !(this.activeTab() === 'reservas' && this.activeReservaTab() === 'reservas');
    if (t.includes('QUOTE')) return !(this.activeTab() === 'cotacoes' && this.activeCotacaoTab() === 'cadastro');
    if (t.includes('HOTEL')) return !(this.activeTab() === 'hotel' && this.activeHotelTab() === 'hoteis');
    if (t.includes('CREDIT')) return !(this.activeTab() === 'reservas' && this.activeReservaTab() === 'creditos');
    if (t.includes('FLIGHT')) return !(this.activeTab() === 'voos');
    if (t === 'APPLY_FILTER') return !(this.activeTab() === 'reservas' && this.activeReservaTab() === 'reservas');
    return false;
  }

  handleAiAction(action: AiAction) {
    if (action.type !== 'CONFIRM_TAB_SWITCH' && this.isTabChanging(action) && this.isAnyFormDirty()) {
      const response = this.aiChatComp['aiInterpreter'].blockForTabConfirmation(action);
      this.aiChatComp.addBotMessage(response.message);
      return;
    }

    if (action.type === 'CONFIRM_TAB_SWITCH') {
      action = action.payload; // Extract the original action
    }

    const p = action.payload || {};

    // Searches for EDIT intents
    const searchTerm = (p.search_term || p.reservation_number || p.locator || p.title || p.name || p.origin || p.destination || '').toString().toLowerCase();

    // Flight Handlers
    if (action.type === 'CREATE_FLIGHT') {
      this.activeTab.set('voos');
      this.prefilledFlightData.set({
        locator: p.locator || '',
        origin: p.origin || '',
        date: p.date || p.flight_time || '',
        destination: p.destination || ''
      } as any);
      // Wait for tab switch
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 300);
    } else if (action.type === 'EDIT_FLIGHT') {
      this.activeTab.set('voos');
      const flight = this.flights().find(f => f.locator?.toLowerCase().includes(searchTerm));
      if (flight) this.startEdit(flight.id);
    }
    
    // Reservation Handlers
    else if (action.type === 'CREATE_RESERVATION') {
      this.activeTab.set('reservas');
      this.activeReservaTab.set('reservas');
      this.prefilledReservationData.set({
        destination: p.destination || '',
        passengers: Array.isArray(p.passengers) ? p.passengers : (p.passenger ? [p.passenger] : []),
        date: p.date || p.dateStr || '',
        return_date: p.return_date || '',
        reservation_number: p.reservation_number || '',
        flight_voucher: p.flight_voucher || '',
        notes: p.notes || ''
      } as any);
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 300);
    } else if (action.type === 'EDIT_RESERVATION') {
      this.activeTab.set('reservas');
      this.activeReservaTab.set('reservas');
      const res = this.reservations().find(r => r.reservation_number.toLowerCase().includes(searchTerm) || r.passengers.some(pa => pa.toLowerCase().includes(searchTerm)));
      if (res) this.startEditReservation(res.id);
    }
    
    // Quote Handlers
    else if (action.type === 'CREATE_QUOTE') {
      this.activeTab.set('cotacoes');
      this.activeCotacaoTab.set('cadastro');
      this.prefilledQuoteData.set({
        title: p.title || (p.destination ? `Cotação para ${p.destination}` : ''),
        adults: p.adults || 2,
        children: p.children || 0
      } as any);
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 300);
    } else if (action.type === 'EDIT_QUOTE') {
      this.activeTab.set('cotacoes');
      this.activeCotacaoTab.set('cadastro');
      const quote = this.quotes().find(q => q.title.toLowerCase().includes(searchTerm));
      if (quote) this.startEditQuote(quote.id);
    }
    
    // Hotel Handlers
    else if (action.type === 'CREATE_HOTEL') {
      this.activeTab.set('hotel');
      this.activeHotelTab.set('hoteis');
      this.prefilledHotelName.set(p.name || '');
      // Extra data can't directly map yet if no simple prefill is set.
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 300);
    } else if (action.type === 'EDIT_HOTEL') {
      this.activeTab.set('hotel');
      this.activeHotelTab.set('hoteis');
      const hotel = this.hotels().find(h => h.name.toLowerCase().includes(searchTerm));
      if (hotel) this.startEditHotel(hotel.id);
    }
    
    // Credit Handlers
    else if (action.type === 'CREATE_CREDIT') {
      this.activeTab.set('reservas');
      this.activeReservaTab.set('creditos');
      this.prefilledCreditData.set({
        client_name: p.customer || p.client_name || '',
        reservation_number: p.reservation_number || '',
        value: p.amount || p.value || 0,
        observations: p.notes || ''
      } as any);
      setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 300);
    } else if (action.type === 'EDIT_CREDIT') {
      this.activeTab.set('reservas');
      this.activeReservaTab.set('creditos');
      const credit = this.credits().find(c => c.client_name?.toLowerCase().includes(searchTerm));
      if (credit) this.startEditCredit(credit.id);
    }
    
    // Filter Handlers
    else if (action.type === 'APPLY_FILTER') {
      this.activeTab.set('reservas');
      this.activeReservaTab.set('reservas');
      if (p.filter === 'hoje' || p.filter === 'amanha') {
        this.activeQuickFilter.set(p.filter);
      } else if (searchTerm) {
        this.searchTerm.set(searchTerm);
      }
    }
  }

  isAnyFormDirty(): boolean {
    return false;
  }

  // --- Credit Actions ---
  async onAddCredit(data: Omit<Credit, 'id' | 'created_at' | 'expiration_date'>) {
    this.isSavingCredit.set(true);
    await this.creditService.addCredit(data);
    this.isSavingCredit.set(false);
  }

  async onUpdateCredit(event: { id: string, data: Partial<Credit> }) {
    this.isSavingCredit.set(true);
    await this.creditService.updateCredit(event.id, event.data);
    this.isSavingCredit.set(false);
    this.closeCreditEditModal();
  }

  onRemoveCredit(id: string) {
    this.creditService.removeCredit(id);
  }

  startEditCredit(id: string) {
    const credit = this.credits().find(c => c.id === id);
    if (credit) {
      this.editingCredit.set(credit);
      this.showCreditEditModal.set(true);
    }
  }

  closeCreditEditModal() {
    this.showCreditEditModal.set(false);
    this.editingCredit.set(null);
  }
}