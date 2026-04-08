import { Component, Input, Output, EventEmitter, computed, signal, HostListener, ChangeDetectionStrategy, inject } from '@angular/core';
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
export class QuoteCardComponent {
  @Input({ required: true }) quote!: Quote;
  @Input({ required: true }) exchangeRate!: number;
  @Output() edit = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();

  private quoteService = inject(QuoteService);

  showDeleteModal = signal(false);
  showViewModal = signal(false);
  generatedText = signal('');
  isGeneratingLink = signal(false);

  // Helpers para exibição rápida no card
  mainHotel = computed(() => this.quote.hotel_options?.[0]);
  totalOptions = computed(() => this.quote.hotel_options?.length || 0);

  // Helpers de formatação segura para garantir 9.999,99 independente do locale global
  formatCurrencyValue(value: number, currency: string): string {
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

    // Cálculo de dias/noites
    const diffTime = Math.abs(this.parseDate(q.check_out) - this.parseDate(q.check_in));
    const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const nights = days > 0 ? days - 1 : 0;
    const durationText = `${days} dias e ${nights} noites`;

    // Texto de Passageiros
    const paxText = `${q.adults} adulto${q.adults > 1 ? 's' : ''}` +
      (q.children > 0 ? ` e ${q.children} criança${q.children > 1 ? 's' : ''}` : '');

    // Passeio (condicional)
    const tourBlock = q.tour_details ? `🌴 ${q.tour_details}\n` : '';

    // Opções de Hospedagem (Dinâmico)
    const hotelsBlock = q.hotel_options.map(h => {
      const valor = h.amount.toLocaleString('pt-BR', { style: 'currency', currency: h.currency });

      return `🏨 **${h.hotel_name} + ${h.regime}** - (${h.accommodation})
Total = **${valor}** – ${paxText}
Fotos: ${h.link || 'Consulte-nos'}`;
    }).join('\n\n');

    // Template Final
    return `*${q.title.toUpperCase()}*
${q.subtitle ? q.subtitle + '\n' : ''}
# Incluso:
✈️ Voo saindo de ${q.flight_details.outbound.origin_city}
🏨 Hospedagem ${q.hotel_options[0]?.regime || 'Variado'}
🚍 Transporte de ida e volta do aeroporto até o hotel
${tourBlock}🚑 Seguro Viagem
🧳 Bagagem de mão + 01 mochila/bolsa por passageiro

🗓️ ${q.check_in} - ${q.check_out} - ${durationText}

Voo direto na ida e na volta, voando ${q.supplier}

✈️ Ida: ${q.flight_details.outbound.origin_city} ${q.flight_details.outbound.departure_time} → ${q.flight_details.outbound.destination_city} ${q.flight_details.outbound.arrival_time}
✈️ Volta: ${q.flight_details.inbound.origin_city} ${q.flight_details.inbound.departure_time} → ${q.flight_details.inbound.destination_city} ${q.flight_details.inbound.arrival_time}

Opções de hospedagem:

${hotelsBlock}
_______________________________________________________

# Formas de pagamento:
💳 Até 10x sem juros no cartão de crédito (podendo utilizar mais de um cartão)

OU

Entrada mínima de 10% (podendo parcelar a entrada no cartão) e saldo restante em até 12x no boleto sem juros, mediante aprovação bancária do CPF.

⚠️ Valores sujeitos a alteração sem aviso prévio.`;
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