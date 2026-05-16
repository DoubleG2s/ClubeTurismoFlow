import { Component, Input, Output, EventEmitter, computed, signal, HostListener, ChangeDetectionStrategy, inject, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Quote } from '../../models/quote';
import { QuoteService } from '../../services/quote.service';

@Component({
  selector: 'app-quote-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quote-card.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class QuoteCardComponent implements OnChanges {
  @Input({ required: true }) quote!: Quote;
  @Input({ required: true }) exchangeRate!: number;
  @Output() edit = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();

  private quoteService = inject(QuoteService);

  showDeleteModal = signal(false);
  showViewModal = signal(false);
  generatedText = signal('');
  isGeneratingLink = signal(false);
  
  // Sinal interno para reatividade do computed
  quoteSignal = signal<Quote | null>(null);

  ngOnChanges(changes: SimpleChanges) {
    if (changes['quote']) {
      this.quoteSignal.set(this.quote);
    }
  }

  // --- SUMMARY LAYER: Normalização e Cálculos Inteligentes ---

  // Normaliza o fallback de cotações antigas vs novas (assim como no proposal)
  normalizedOptions = computed(() => {
    const q = this.quoteSignal();
    if (!q) return [];
    
    if (q.options && q.options.length > 0) {
      return q.options;
    }
    // Fallback para cotação antiga
    return [{
      title: q.title || 'Opção Única',
      check_in: q.check_in,
      check_out: q.check_out,
      adults: q.adults,
      children: q.children,
      tour_details: q.tour_details || '',
      has_transfer: q.has_transfer || false,
      flight_details: q.flight_details,
      hotel_options: q.hotel_options || []
    }];
  });

  totalOptions = computed(() => this.normalizedOptions().length);
  mainOption = computed(() => this.normalizedOptions()[0]);
  mainHotel = computed(() => this.mainOption()?.hotel_options?.[0]);

  // Faixa de preço (menor valor entre todas as opções)
  lowestPrice = computed(() => {
    let minPrice = Infinity;
    this.normalizedOptions().forEach(opt => {
      opt.hotel_options?.forEach(hotel => {
        if (hotel.amount < minPrice) minPrice = hotel.amount;
      });
    });
    return minPrice === Infinity ? null : minPrice;
  });

  // Resumo de hotéis (pega até os 3 primeiros nomes distintos)
  uniqueHotelNames = computed(() => {
    const names = new Set<string>();
    this.normalizedOptions().forEach(opt => {
      opt.hotel_options?.forEach(hotel => {
        if (hotel.hotel_name) names.add(hotel.hotel_name);
      });
    });
    return Array.from(names).slice(0, 3);
  });

  // Helpers de formatação segura para garantir 9.999,99 independente do locale global
  formatCurrencyValue(value: number, currency: string = 'BRL'): string {
    if (value === undefined || value === null) return '';
    return value.toLocaleString('pt-BR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  onDelete(event: Event) {
    event.stopPropagation();
    this.showDeleteModal.set(true);
  }

  onView(event: Event) {
    event.stopPropagation();
    this.generatedText.set(this.generateQuoteText());
    this.showViewModal.set(true);
  }

  onShowProposal(event: Event) {
    event.stopPropagation();
    window.open(window.location.origin + '?proposal=' + this.quote.id, '_blank');
  }

  async onGeneratePublicLink(event: Event) {
    event.stopPropagation();
    
    // Se já tiver um link, apenas copia
    if (this.quote.is_public && this.quote.public_token) {
      this.copyPublicLink();
      return;
    }

    this.isGeneratingLink.set(true);
    try {
      const token = await this.quoteService.generatePublicLink(this.quote.id);
      if (token) {
        // Objeto é atualizado internamente pelo serviço via Signal, mas podemos garantir a cópia localmente
        this.quote.public_token = token;
        this.quote.is_public = true;
        this.copyPublicLink();
      }
    } finally {
      this.isGeneratingLink.set(false);
    }
  }

  async onRevokePublicLink(event: Event) {
    event.stopPropagation();
    if (confirm('Tem certeza que deseja inativar o link público? O cliente não poderá mais ver esta cotação.')) {
      await this.quoteService.revokePublicLink(this.quote.id);
    }
  }
  
  private copyPublicLink() {
    const url = `${window.location.origin}/?public_quote=${this.quote.public_token}`;
    navigator.clipboard.writeText(url).then(() => {
      alert('Link público copiado para a área de transferência!');
    });
  }

  confirmDelete() {
    this.remove.emit(this.quote.id);
    this.showDeleteModal.set(false);
  }


  cancelDelete() {
    this.showDeleteModal.set(false);
  }

  closeViewModal() {
    this.showViewModal.set(false);
  }

  copyToClipboard() {
    navigator.clipboard.writeText(this.generatedText()).then(() => {
      alert('Texto copiado para a área de transferência!');
    });
  }

  // Lógica principal de geração do texto
  private generateQuoteText(): string {
    const q = this.quote;
    const options = this.normalizedOptions();

    let text = `*${q.title.toUpperCase()}*\n`;
    if (q.subtitle) text += `${q.subtitle}\n`;
    
    text += `\n# Informações Gerais:\n`;
    
    if (options.length === 1) {
      // Single Option Format (Legacy-like)
      const opt = options[0];
      const diffTime = Math.abs(this.parseDate(opt.check_out) - this.parseDate(opt.check_in));
      const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const nights = days > 0 ? days - 1 : 0;
      const durationText = `${days} dias e ${nights} noites`;

      const paxText = `${opt.adults} adulto${opt.adults > 1 ? 's' : ''}` +
        (opt.children > 0 ? ` e ${opt.children} criança${opt.children > 1 ? 's' : ''}` : '');

      const tourBlock = opt.tour_details ? `🌴 ${opt.tour_details}\n` : '';

      text += `✈️ Voo saindo de ${opt.flight_details?.outbound?.origin_city || 'a definir'}\n`;
      text += `🚍 Transporte ida e volta\n`;
      text += `${tourBlock}🚑 Seguro Viagem\n`;
      text += `🧳 Bagagem de mão + 01 mochila/bolsa por passageiro\n\n`;
      
      text += `🗓️ ${opt.check_in} - ${opt.check_out} - ${durationText}\n\n`;

      if (opt.flight_details?.outbound?.departure_time) {
        text += `✈️ Ida: ${opt.flight_details.outbound.origin_city} ${opt.flight_details.outbound.departure_time} → ${opt.flight_details.outbound.destination_city} ${opt.flight_details.outbound.arrival_time}\n`;
        text += `✈️ Volta: ${opt.flight_details.inbound.origin_city} ${opt.flight_details.inbound.departure_time} → ${opt.flight_details.inbound.destination_city} ${opt.flight_details.inbound.arrival_time}\n\n`;
      }

      text += `Opções de hospedagem:\n\n`;

      const hotelsBlock = opt.hotel_options?.map(h => {
        const valor = this.formatCurrencyValue(h.amount, h.currency);
        return `🏨 **${h.hotel_name} + ${h.regime}** - (${h.accommodation})\nTotal = **${valor}** – ${paxText}\nFotos: ${h.link || 'Consulte-nos'}`;
      }).join('\n\n') || 'Sem hotéis definidos.';

      text += `${hotelsBlock}\n`;

    } else {
      // Multi-Option Format
      text += `Temos ${options.length} opções incríveis desenhadas para você!\n\n`;
      
      options.forEach((opt, index) => {
        const diffTime = Math.abs(this.parseDate(opt.check_out) - this.parseDate(opt.check_in));
        const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const nights = days > 0 ? days - 1 : 0;
        
        const paxText = `${opt.adults} adulto${opt.adults > 1 ? 's' : ''}` +
        (opt.children > 0 ? ` e ${opt.children} criança${opt.children > 1 ? 's' : ''}` : '');

        text += `🟢 **OPÇÃO ${index + 1}: ${opt.title || 'Pacote'}**\n`;
        text += `🗓️ ${opt.check_in} - ${opt.check_out} (${days} dias e ${nights} noites)\n`;
        text += `✈️ Voo: ${opt.flight_details?.outbound?.origin_city} → ${opt.flight_details?.outbound?.destination_city}\n`;
        if (opt.tour_details) text += `🌴 ${opt.tour_details}\n`;

        opt.hotel_options?.forEach(h => {
          const valor = this.formatCurrencyValue(h.amount, h.currency);
          text += `🏨 Hotel: **${h.hotel_name} + ${h.regime}**\nTotal: **${valor}** (${paxText})\n`;
        });
        text += `\n`;
      });
    }

    text += `_______________________________________________________\n\n`;
    text += `# Formas de pagamento:\n`;
    text += `💳 Até 10x sem juros no cartão de crédito (podendo utilizar mais de um cartão)\n\nOU\n\n`;
    text += `Entrada mínima de 10% (podendo parcelar a entrada no cartão) e saldo restante em até 12x no boleto sem juros, mediante aprovação bancária do CPF.\n\n`;
    text += `⚠️ Valores sujeitos a alteração sem aviso prévio.`;
    
    return text;
  }

  private parseDate(dateStr: string): number {
    if (!dateStr) return 0;
    const parts = dateStr.split('/');
    return new Date(+parts[2], +parts[1] - 1, +parts[0]).getTime();
  }

  @HostListener('document:keydown', ['$event'])
  handleKeyboardEvent(event: KeyboardEvent) {
    if (this.showDeleteModal()) {
      if (event.key === 'Enter') {
        event.preventDefault();
        this.confirmDelete();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        this.cancelDelete();
      }
    } else if (this.showViewModal() && event.key === 'Escape') {
      this.closeViewModal();
    }
  }
}