import { Component, Input, Output, EventEmitter, computed, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Quote } from '../../models/quote';

@Component({
  selector: 'app-quote-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './quote-card.component.html'
})
export class QuoteCardComponent {
  @Input({ required: true }) quote!: Quote;
  @Input({ required: true }) exchangeRate!: number;
  @Output() edit = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();

  showDeleteModal = signal(false);
  showViewModal = signal(false);
  generatedText = signal('');

  // Helpers para exibição rápida no card
  mainHotel = computed(() => this.quote.hotel_options?.[0]);
  totalOptions = computed(() => this.quote.hotel_options?.length || 0);

  // Cálculo aproximado em BRL para o card (apenas visualização rápida)
  approxValueBrl = computed(() => {
    const hotel = this.mainHotel();
    if (!hotel) return 0;
    return hotel.currency === 'USD' ? hotel.amount * this.exchangeRate : hotel.amount;
  });

  onDelete(event: Event) {
    event.stopPropagation();
    this.showDeleteModal.set(true);
  }

  onView(event: Event) {
    event.stopPropagation();
    this.generatedText.set(this.generateQuoteText());
    this.showViewModal.set(true);
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
      const valor = h.currency === 'BRL'
        ? h.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
        : h.amount.toLocaleString('en-US', { style: 'currency', currency: 'USD' });

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