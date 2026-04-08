import { Component, Input, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Quote } from '../../models/quote';
import { QuoteService } from '../../services/quote.service';

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
  selectedHotelIndex = signal(0);
  activeImageIndexPerHotel = signal<{ [key: number]: number }>({});
  expandedImage = signal<string | null>(null);

  // Calculados
  durationDays = computed(() => {
    const q = this.quote();
    if (!q) return 0;
    const diff = Math.abs(this.parseDate(q.check_out) - this.parseDate(q.check_in));
    return Math.ceil(diff / (1000 * 60 * 60 * 24)) + 1; // + 1 para contar o próprio dia inicial
  });

  durationNights = computed(() => {
    const days = this.durationDays();
    return days > 0 ? days - 1 : 0;
  });

  mainHotel = computed(() => {
    const q = this.quote();
    if (!q || !q.hotel_options?.length) return null;
    const index = this.selectedHotelIndex();
    return q.hotel_options[index] || q.hotel_options[0];
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
  private highlightTimeout: any;

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

  private parseDate(dateStr: string): number {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
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
