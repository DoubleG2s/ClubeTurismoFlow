import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Quote, HotelOption, QuoteOption } from '../../models/quote';
import { QuoteService } from '../../services/quote.service';
import { parsePtBrDate } from '../../shared/utils/date.utils';

@Component({
  selector: 'app-quote-proposal',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quote-proposal.component.html'
})
export class QuoteProposalComponent implements OnInit {
  @Input() quoteId: string = '';
  @Input() publicToken: string = '';
  
  private quoteService = inject(QuoteService);
  
  quote = signal<Quote | null>(null);
  isLoading = signal(true);
  
  // States
  activeOptionIndex = signal(0);
  selectedHotelIndex = signal(0);
  activeImageIndexPerHotel = signal<{ [key: number]: number }>({});
  expandedImage = signal<string | null>(null);
  expandedConnections = signal<{ outbound: boolean, inbound: boolean }>({ outbound: false, inbound: false });

  // Normalização de Opções
  normalizedOptions = computed<QuoteOption[]>(() => {
    const q = this.quote();
    if (!q) return [];
    if (q.options && q.options.length > 0) return q.options;
    // Fallback para cotações antigas
    return [{
      title: 'Opção Única',
      check_in: q.check_in,
      check_out: q.check_out,
      adults: q.adults,
      children: q.children,
      flight_details: q.flight_details,
      hotel_options: q.hotel_options,
      tour_details: q.tour_details,
      has_transfer: q.has_transfer
    }];
  });

  currentOption = computed(() => {
    const opts = this.normalizedOptions();
    if (!opts.length) return null;
    return opts[this.activeOptionIndex()] || opts[0];
  });

  // Calculados
  durationDays = computed(() => {
    const opt = this.currentOption();
    if (!opt || !opt.check_in || !opt.check_out) return 0;
    const diff = Math.abs(parsePtBrDate(opt.check_out) - parsePtBrDate(opt.check_in));
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1; // + 1 para contar o próprio dia inicial
  });

  durationNights = computed(() => {
    const days = this.durationDays();
    return days > 0 ? days - 1 : 0;
  });

  mainHotel = computed(() => {
    const opt = this.currentOption();
    if (!opt || !opt.hotel_options?.length) return null;
    const index = this.selectedHotelIndex();
    return opt.hotel_options[index] || opt.hotel_options[0];
  });

  totalValue = computed(() => {
    if (!this.mainHotel()) return '';
    return this.formatCurrencyValue(this.mainHotel()!.amount, this.mainHotel()!.currency);
  });

  ngOnInit() {
    if (this.quoteId || this.publicToken) {
      this.loadQuote();
    }
  }

  async loadQuote() {
    this.isLoading.set(true);
    try {
      if (this.publicToken) {
        // Fluxo de Link Público
        const q = await this.quoteService.getPublicQuote(this.publicToken);
        if (q) {
          this.quote.set(q);
          this.selectedHotelIndex.set(0);
        } else {
          console.warn('Link público expirado, inválido ou bloqueado.');
        }
        this.isLoading.set(false);
      } else {
        // Fluxo de Admin Logado
        const q = this.quoteService.quotes().find(x => x.id === this.quoteId);
        if (q) {
          this.quote.set(q);
          this.selectedHotelIndex.set(0);
          this.isLoading.set(false);
        } else {
          setTimeout(() => {
            const fetchedQ = this.quoteService.quotes().find(x => x.id === this.quoteId) || null;
            this.quote.set(fetchedQ);
            this.selectedHotelIndex.set(0);
            this.isLoading.set(false);
          }, 1500);
        }
      }
    } catch {
      this.isLoading.set(false);
    }
  }

  isValueHighlighting = signal(false);
  isSwitchingOption = signal(false);
  private highlightTimeout: any;

  selectOption(index: number) {
    if (this.activeOptionIndex() === index) return;
    
    // 1. Inicia o fade-out suave do conteúdo
    this.isSwitchingOption.set(true);
    
    setTimeout(() => {
      // 2. Troca o estado da opção
      this.activeOptionIndex.set(index);
      this.selectedHotelIndex.set(0);
      this.activeImageIndexPerHotel.set({}); // Reset image indices for the new option
      
      // 3. Remove o fade-out e inicia o fade-in do novo conteúdo
      setTimeout(() => {
        this.isSwitchingOption.set(false);
      }, 50);
    }, 250); // 250ms de fade-out
  }

  selectHotel(index: number) {
    if (this.selectedHotelIndex() === index) return;
    this.selectedHotelIndex.set(index);
    
    // Feedback visual do valor atualizado
    this.isValueHighlighting.set(true);
    if (this.highlightTimeout) clearTimeout(this.highlightTimeout);
    this.highlightTimeout = setTimeout(() => {
      this.isValueHighlighting.set(false);
    }, 5000);
  }

  getHotelImage(hotelIndex: number, images: string[]): string {
    if (!images || !images.length) return '';
    const idx = this.activeImageIndexPerHotel()[hotelIndex] || 0;
    return images[idx] || images[0];
  }

  setHotelImage(event: Event, hotelIndex: number, imageIndex: number) {
    event.stopPropagation(); // Evita que o card do hotel seja selecionado se o clique for só na thumbnail
    this.activeImageIndexPerHotel.update(state => ({
      ...state,
      [hotelIndex]: imageIndex
    }));
  }

  openExpandedImage(event: Event, url: string) {
    event.stopPropagation();
    this.expandedImage.set(url);
  }

  closeExpandedImage() {
    this.expandedImage.set(null);
  }

  toggleConnection(segment: 'outbound' | 'inbound') {
    this.expandedConnections.update(state => ({
      ...state,
      [segment]: !state[segment]
    }));
  }

  getHotelTotalValue(hotel: HotelOption): string {
    return this.formatCurrencyValue(hotel.amount, hotel.currency);
  }

  formatCurrencyValue(value: number, currency: string): string {
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  printProposal() {
    window.print();
  }
}
