import { Component, Input, Output, EventEmitter, computed } from '@angular/core';
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
  @Input({ required: true }) exchangeRate!: number; // Passed from parent
  @Output() edit = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();

  // Computed value for converted BRL
  convertedBrl = computed(() => {
    if (this.quote.currency === 'USD') {
      return this.quote.amount * this.exchangeRate;
    }
    return null;
  });

  onDelete(event: Event) {
    event.stopPropagation();
    if (confirm('Tem certeza que deseja excluir esta cotação permanentemente?')) {
      this.remove.emit(this.quote.id);
    }
  }
}