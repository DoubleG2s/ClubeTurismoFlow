import { Component, inject, signal, computed, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule } from 'lucide-angular';
import { FormsModule } from '@angular/forms';
import { AdminMasterComponent } from '@components/admin-master/admin-master.component';
import { AiChatComponent } from '@components/ai-chat/ai-chat.component';
import { CreditFormComponent } from '@components/credit-form/credit-form.component';
import { FlightFormComponent } from '@components/flight-form/flight-form.component';
import { HotelDetailsComponent } from '@components/hotel-details/hotel-details.component';
import { HotelFormSubmission } from '@components/hotel-form/hotel-form.types';
import { HotelFormComponent } from '@components/hotel-form/hotel-form.component';
import { LoginComponent } from '@components/login/login.component';
import { QuoteFormComponent } from '@components/quote-form/quote-form.component';
import { QuoteProposalComponent } from '@components/quote-proposal/quote-proposal.component';
import { ReservationFormComponent } from '@components/reservation-form/reservation-form.component';
import { ConfirmModalComponent } from '@components/shared/confirm-modal/confirm-modal.component';
import {
  AccessGateState,
  AppTab,
  HotelSubTab,
  QuickFilter,
  QuoteSubTab,
  ReservationSortField,
  ReservationSubTab,
  SortDirection
} from '@layout/app-shell.types';
import {
  buildMonthLabel,
  filterReservations,
  hasActiveReservationFilters,
  hasDraftReservationFilters
} from '@layout/reservation-filters.utils';
import { Credit } from '@models/credit';
import { Flight } from '@models/flight';
import { Hotel } from '@models/hotel';
import { Quote } from '@models/quote';
import { Reservation } from '@models/reservation';
import { FlightsPageComponent } from '@features/flights/flights-page.component';
import { HotelsPageComponent } from '@features/hotels/hotels-page.component';
import { QuotesPageComponent } from '@features/quotes/quotes-page.component';
import { ClientesPageComponent } from '@features/clientes/clientes-page.component';
import { VendasPageComponent } from '@features/vendas/vendas-page.component';
import { ReservationsPageComponent } from '@features/reservations/reservations-page.component';
import { SubscriptionComponent } from '@features/subscription/subscription';
import { SettingsPageComponent } from '@features/settings/settings-page.component';
import { AiAction } from '@services/ai-interpreter.service';
import { AuthService } from '@services/auth.service';
import { CreditService } from '@services/credit.service';
import { FlightService } from '@services/flight.service';
import { HotelService } from '@services/hotel.service';
import { QuoteService } from '@services/quote.service';
import { ReservationService } from '@services/reservation.service';
import { SubscriptionService } from '@services/subscription.service';
import { expandCollapse, listStagger } from '@app/animations/reservation.animations';
import { animate } from 'motion';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    LucideAngularModule,
    FormsModule,
    FlightFormComponent,
    ReservationFormComponent,
    QuoteFormComponent,
    HotelFormComponent,
    HotelDetailsComponent,
    ConfirmModalComponent,
    LoginComponent,
    CreditFormComponent,
    AiChatComponent,
    AdminMasterComponent,
    FlightsPageComponent,
    HotelsPageComponent,
    QuotesPageComponent,
    ClientesPageComponent,
    VendasPageComponent,
    ReservationsPageComponent,
    SubscriptionComponent,
    QuoteProposalComponent,
    SettingsPageComponent
  ],
  templateUrl: './app.component.html',
  animations: [expandCollapse, listStagger],
})
export class AppComponent implements OnInit, AfterViewInit, OnDestroy {
  private flightService = inject(FlightService);
  private reservationService = inject(ReservationService);
  private quoteService = inject(QuoteService);
  private hotelService = inject(HotelService);
  private creditService = inject(CreditService);
  public authService = inject(AuthService);
  private subscriptionService = inject(SubscriptionService);
  private readonly pendingEmbeddedCheckoutStorageKey = 'clube-turismo-flow:pending-embedded-checkout';
  private readonly accessGateStoragePrefix = 'clube-turismo-flow:access-gate';

  // ViewChild para controlar o formulário de cotação
  @ViewChild(QuoteFormComponent) quoteFormComp!: QuoteFormComponent;
  @ViewChild(SubscriptionComponent) subscriptionView?: SubscriptionComponent;
  @ViewChild('sidebarEl') sidebarEl?: ElementRef<HTMLElement>;

  // UI state
  sidebarOpen = signal<boolean>(false);
  sidebarCollapsed = signal<boolean>(false);

  private readonly SIDEBAR_EXPANDED = '220px';
  private readonly SIDEBAR_COLLAPSED = '56px';

  ngAfterViewInit() {
    if (this.sidebarEl?.nativeElement) {
      this.sidebarEl.nativeElement.style.width = this.SIDEBAR_EXPANDED;
    }
  }

  toggleSidebar() {
    if (window.innerWidth >= 1024) {
      this.toggleCollapse();
    } else {
      this.sidebarOpen.update(v => !v);
    }
  }

  toggleCollapse() {
    const sidebar = this.sidebarEl?.nativeElement;
    if (!sidebar) return;

    // Ensure inline width is set so Motion has a concrete starting value
    if (!sidebar.style.width) {
      sidebar.style.width = getComputedStyle(sidebar).width;
    }

    const newCollapsed = !this.sidebarCollapsed();
    this.sidebarCollapsed.set(newCollapsed);

    // Motion drives the sidebar width; CSS transitions handle label visibility
    animate(
      sidebar,
      { width: newCollapsed ? this.SIDEBAR_COLLAPSED : this.SIDEBAR_EXPANDED },
      { duration: 0.3, ease: [0.16, 1, 0.3, 1] }
    );
  }

  closeSidebar() { this.sidebarOpen.set(false); }

  // Breadcrumb label for topbar
  activeTabLabel = computed(() => {
    const map: Record<AppTab, string> = {
      voos: 'Voos',
      reservas: 'Gestão de Reservas',
      vendas: 'Vendas',
      cotacoes: 'Cotações',
      hotel: 'Hotel',
      clientes: 'Clientes',
      admin: 'Administração',
      assinatura: 'Assinatura',
      configuracoes: 'Configurações',
    };
    return map[this.activeTab()] ?? this.activeTab();
  });

  // State
  activeTab = signal<AppTab>('reservas');
  isLockedOut = signal<boolean>(false); // Catraca SaaS
  isCheckingSubscriptionAccess = signal<boolean>(false);
  activeReservaTab = signal<ReservationSubTab>('reservas');
  activeHotelTab = signal<HotelSubTab>('hoteis');
  activeCotacaoTab = signal<QuoteSubTab>('cadastro');
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
  isNovaReservaExpanded = signal(false);

  // Quote State
  editingQuote = signal<Quote | null>(null);
  showQuoteEditModal = signal(false);
  usdExchangeRate = signal<number>(6.00);
  isSavingQuote = signal(false);
  prefilledQuoteData = signal<Partial<Quote> | null>(null);
  duplicatingQuote = signal<Quote | null>(null);

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
  private hotelSearchTimeout: ReturnType<typeof setTimeout> | null = null;

  // Credit State
  editingCredit = signal<Credit | null>(null);
  showCreditEditModal = signal(false);
  isSavingCredit = signal(false);
  prefilledCreditData = signal<Partial<Credit> | null>(null);

  // Shared Modal State
  showConfirmDeleteModal = signal(false);
  itemToDelete = signal<{ type: 'hotel', id: string } | null>(null);

  // Logout Modal State
  showLogoutModal = signal(false);

  // --- FILTERS & SORTING STATE ---
  searchTerm = signal('');
  activeQuickFilter = signal<QuickFilter>(null);
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

  sortField = signal<ReservationSortField>('date');
  sortDirection = signal<SortDirection>('asc');

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
  
  monthName = computed(() => buildMonthLabel(this.activeMonth(), this.activeYear()));

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
  filteredReservations = computed(() =>
    filterReservations(this.reservations(), {
      month: this.activeMonth(),
      year: this.activeYear(),
      searchTerm: this.searchTerm(),
      quickFilter: this.activeQuickFilter(),
      dateStart: this.activeDateStart(),
      dateEnd: this.activeDateEnd(),
      returnStart: this.activeReturnStart(),
      returnEnd: this.activeReturnEnd(),
      missingHotelEmail: this.activeMissingHotelEmail(),
      missingPostTrip: this.activeMissingPostTrip(),
      sortField: this.sortField(),
      sortDirection: this.sortDirection()
    })
  );
  hasActiveFilters = computed(() =>
    hasActiveReservationFilters({
      searchTerm: this.searchTerm(),
      quickFilter: this.activeQuickFilter(),
      dateStart: this.activeDateStart(),
      dateEnd: this.activeDateEnd(),
      returnStart: this.activeReturnStart(),
      returnEnd: this.activeReturnEnd(),
      missingHotelEmail: this.activeMissingHotelEmail(),
      missingPostTrip: this.activeMissingPostTrip(),
      sortField: this.sortField(),
      sortDirection: this.sortDirection()
    })
  );
  hasDraftFilters = computed(() =>
    hasDraftReservationFilters({
      dateStart: this.draftDateStart(),
      dateEnd: this.draftDateEnd(),
      returnStart: this.draftReturnStart(),
      returnEnd: this.draftReturnEnd(),
      missingHotelEmail: this.draftMissingHotelEmail(),
      missingPostTrip: this.draftMissingPostTrip()
    })
  );

  isLoading = computed(() =>
    this.flightService.isLoading() ||
    this.reservationService.isLoading() ||
    this.quoteService.isLoading() ||
    this.hotelService.isLoading() ||
    this.creditService.isLoading()
  );

  private accessCheckSequence = 0;
  private lastAccessGateKey: string | null = null;
  private returnFromSubscriptionHandler = () => {
    if (!this.isLockedOut()) {
      this.subscriptionView?.dismissEmbeddedCheckoutForNavigation();
      this.activeTab.set('reservas');
    }
  };

  private buildAccessGateStorageKey(accessGateKey: string) {
    return `${this.accessGateStoragePrefix}:${accessGateKey}`;
  }

  private readPersistedAccessGate(accessGateKey: string): AccessGateState | null {
    try {
      return (sessionStorage.getItem(this.buildAccessGateStorageKey(accessGateKey)) as AccessGateState | null) || null;
    } catch {
      return null;
    }
  }

  private persistAccessGate(accessGateKey: string, state: AccessGateState) {
    try {
      sessionStorage.setItem(this.buildAccessGateStorageKey(accessGateKey), state);
    } catch {
      // Seguimos sem persistencia se o navegador bloquear o storage.
    }
  }

  constructor() {
    // Escuta o status de autenticação para checar regras da empresa ativa
    effect(() => {
       const session = this.authService.session();
       const profile = this.authService.profile();
       const companyId = profile?.company_id || null;

       if (session?.user && companyId) {
          const accessGateKey = `${session.user.id}:${companyId}`;

          if (this.lastAccessGateKey === accessGateKey) {
            return;
          }

          this.lastAccessGateKey = accessGateKey;
          void this.refreshSubscriptionAccessGate(true);
       } else {
          this.lastAccessGateKey = null;
          this.isCheckingSubscriptionAccess.set(false);
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

    this.fetchExchangeRate();
    window.addEventListener('clube-turismo-flow:return-from-subscription', this.returnFromSubscriptionHandler);
  }

  async fetchExchangeRate() {
    try {
      const response = await fetch('https://economia.awesomeapi.com.br/json/last/USD-BRL');
      const data = await response.json();
      if (data && data.USDBRL && data.USDBRL.ask) {
        const parsedRate = parseFloat(data.USDBRL.ask);
        // Round to 2 decimal places to satisfy "duas casas decimais após a vírgula"
        this.usdExchangeRate.set(parseFloat(parsedRate.toFixed(2)));
      }
    } catch (e) {
      console.error('Falha ao buscar cotação do dólar', e);
    }
  }

  ngOnDestroy() {
    window.removeEventListener('clube-turismo-flow:return-from-subscription', this.returnFromSubscriptionHandler);
  }

  private async refreshSubscriptionAccessGate(showLoader = true) {
     const currentSequence = ++this.accessCheckSequence;
     if (showLoader) {
       this.isCheckingSubscriptionAccess.set(true);
     }

     try {
        // para bloquear rapido no login, a decisao principal usa apenas o
        // status da empresa. Historico e gerenciamento carregam depois.
        const status = await this.subscriptionService.getCompanyStatus({ force: true });

        if (currentSequence !== this.accessCheckSequence) {
          return;
        }

        if (!status || (status.subscription_status !== 'active' && status.subscription_status !== 'trial')) {
           console.log('[Auth] Empresa inativa, trancando UI');
           this.isLockedOut.set(true);
           this.activeTab.set('assinatura');
           if (this.lastAccessGateKey) {
             this.persistAccessGate(this.lastAccessGateKey, 'locked');
           }
        } else {
           this.isLockedOut.set(false);
           if (this.lastAccessGateKey) {
             this.persistAccessGate(this.lastAccessGateKey, 'open');
           }
           if (this.hasPendingEmbeddedCheckout()) {
              this.activeTab.set('assinatura');
           } else if (this.activeTab() === 'assinatura') {
              this.activeTab.set('reservas');
           }

           // O preload completo continua acontecendo, mas sem segurar a catraca.
           void this.subscriptionService.preloadSubscriptionData({ force: true });
        }
     } catch (error) {
        if (currentSequence !== this.accessCheckSequence) {
          return;
        }

        console.error('Erro ao verificar acesso da assinatura:', error);
        this.isLockedOut.set(true);
        this.activeTab.set('assinatura');
        if (this.lastAccessGateKey) {
          this.persistAccessGate(this.lastAccessGateKey, 'locked');
        }
     } finally {
        if (currentSequence === this.accessCheckSequence) {
          this.isCheckingSubscriptionAccess.set(false);
        }
     }
  }

  private hasPendingEmbeddedCheckout(): boolean {
    try {
      return !!sessionStorage.getItem(this.pendingEmbeddedCheckoutStorageKey);
    } catch {
      return false;
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
  onHotelSearchInput(term: string) {
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

  toggleSort(field: ReservationSortField) {
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
    this.sortDirection.set('asc');
    
    this.triggerListAnimation();
  }

  toggleQuickFilter(filter: Exclude<QuickFilter, null>) {
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

  onExchangeRateInput(rawValue: string | number) {
    const value = parseFloat(String(rawValue));
    if (!isNaN(value) && value > 0) {
      this.usdExchangeRate.set(value);
    }
  }

  // --- Auth Actions ---
  openLogoutModal() {
    this.showLogoutModal.set(true);
  }

  closeLogoutModal() {
    this.showLogoutModal.set(false);
  }

  confirmLogout() {
    this.showLogoutModal.set(false);
    this.onLogout();
  }

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

  onPrepareHotelEmail(reservation: Reservation) {
    this.hotelService.setPrefillHotelEmailData(reservation);
    this.switchTab('hotel');
    this.switchHotelTab('email');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 100);
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

  startDuplicateQuote(id: string) {
    const quote = this.quotes().find(q => q.id === id);
    if (!quote) return;
    this.duplicatingQuote.set(null);
    this.activeTab.set('cotacoes');
    this.activeCotacaoTab.set('cadastro');
    setTimeout(() => this.duplicatingQuote.set(quote), 0);
  }

  onDuplicateFilled() {
    this.duplicatingQuote.set(null);
  }

  // --- Hotel Actions ---
  async onSaveHotel(event: HotelFormSubmission) {
    let success = false;
    if (this.editingHotel()) {
      const newEmails = event.emails
        .filter((email) => !email.id)
        .map((email) => ({ email: email.email, type: email.type }));
      const newPhones = event.phones
        .filter((phone) => !phone.id)
        .map((phone) => ({ phone: phone.phone, is_whatsapp: phone.is_whatsapp }));

      success = await this.hotelService.updateHotel(
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
      success = !!(await this.hotelService.addHotel(event.hotelData, event.emails, event.phones, event.images));
    }

    if (!success) {
      // TODO (SEC-11): Substituir por um Toast global ou repassar erro via Input para o HotelFormComponent
      alert('Ocorreu um erro ao salvar o hotel. Verifique os dados ou a sua conexão e tente novamente.');
      return;
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

  switchTab(tab: AppTab) {
    this.activeTab.set(tab);
  }

  switchReservaTab(tab: ReservationSubTab) {
    this.activeReservaTab.set(tab);
  }

  switchHotelTab(tab: HotelSubTab) {
    this.activeHotelTab.set(tab);
  }

  switchCotacaoTab(tab: QuoteSubTab) {
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
      const response = this.aiChatComp.blockForTabConfirmation(action);
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
        date: p.date || p.flight_time || ''
      } satisfies Partial<Flight>);
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
      } satisfies Partial<Reservation>);
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
      } satisfies Partial<Quote>);
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
      } satisfies Partial<Credit>);
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
    return this.showEditModal() || 
           this.showReservationEditModal() || 
           this.showQuoteEditModal() || 
           this.showHotelEditModal() || 
           this.showCreditEditModal();
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

  isSubscriptionTabActive() {
    return this.activeTab() === 'assinatura';
  }
}

