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
  @Input({ required: true }) exchangeRate!: number; // Passed from parent
  @Output() edit = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();

  showDeleteModal = signal(false);

  // Computed value for converted BRL
  convertedBrl = computed(() => {
    if (this.quote.currency === 'USD') {
      return this.quote.amount * this.exchangeRate;
    }
    return null;
  });

  onDelete(event: Event) {
    event.stopPropagation();
    this.showDeleteModal.set(true);
  }

  confirmDelete() {
    this.remove.emit(this.quote.id);
    this.showDeleteModal.set(false);
  }

  cancelDelete() {
    this.showDeleteModal.set(false);
  }

  // Handle global keyboard events only when this specific card's modal is open
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
    }
  }
}