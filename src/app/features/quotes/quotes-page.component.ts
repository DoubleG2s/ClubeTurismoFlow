import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommissionCalculatorComponent } from '../../components/commission-calculator/commission-calculator.component';
import { QuoteCardComponent } from '../../components/quote-card/quote-card.component';
import { QuoteFormComponent } from '../../components/quote-form/quote-form.component';
import { Quote } from '../../models/quote';

type QuoteSubTab = 'cadastro' | 'calculadora';

@Component({
  selector: 'app-quotes-page',
  standalone: true,
  imports: [CommonModule, QuoteFormComponent, QuoteCardComponent, CommissionCalculatorComponent],
  templateUrl: './quotes-page.component.html'
})
export class QuotesPageComponent {
  @Input() activeSubTab: QuoteSubTab = 'cadastro';
  @Input() exchangeRate = 0;
  @Input() isSavingQuote = false;
  @Input() prefilledQuoteData: Partial<Quote> | null = null;
  @Input() quotes: Quote[] = [];

  @Output() activeSubTabChange = new EventEmitter<QuoteSubTab>();
  @Output() exchangeRateChange = new EventEmitter<string>();
  @Output() addQuote = new EventEmitter<Omit<Quote, 'id' | 'created_at'>>();
  @Output() editQuote = new EventEmitter<string>();
  @Output() removeQuote = new EventEmitter<string>();

  selectSubTab(tab: QuoteSubTab) {
    this.activeSubTabChange.emit(tab);
  }
}
