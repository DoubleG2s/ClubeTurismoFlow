import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges, signal } from '@angular/core';
import { CommissionCalculatorComponent } from '../../components/commission-calculator/commission-calculator.component';
import { QuoteCardComponent } from '../../components/quote-card/quote-card.component';
import { QuoteFormComponent } from '../../components/quote-form/quote-form.component';
import { Quote } from '../../models/quote';

type QuoteSubTab = 'cadastro' | 'calculadora';
type QuoteViewMode = 'grid' | 'list';

const VIEW_MODE_KEY = 'cotacoes-view-mode';

@Component({
  selector: 'app-quotes-page',
  standalone: true,
  imports: [CommonModule, QuoteFormComponent, QuoteCardComponent, CommissionCalculatorComponent],
  templateUrl: './quotes-page.component.html'
})
export class QuotesPageComponent implements OnChanges, OnInit {
  formOpen = false;
  viewMode = signal<QuoteViewMode>('grid');

  @Input() activeSubTab: QuoteSubTab = 'cadastro';
  @Input() exchangeRate = 0;
  @Input() isSavingQuote = false;
  @Input() prefilledQuoteData: Partial<Quote> | null = null;
  @Input() duplicateFromQuote: Quote | null = null;
  @Input() quotes: Quote[] = [];

  @Output() activeSubTabChange = new EventEmitter<QuoteSubTab>();
  @Output() exchangeRateChange = new EventEmitter<string>();
  @Output() addQuote = new EventEmitter<Omit<Quote, 'id' | 'created_at'>>();
  @Output() editQuote = new EventEmitter<string>();
  @Output() removeQuote = new EventEmitter<string>();
  @Output() duplicateQuote = new EventEmitter<string>();
  @Output() duplicateFilled = new EventEmitter<void>();

  ngOnInit() {
    const saved = localStorage.getItem(VIEW_MODE_KEY) as QuoteViewMode | null;
    if (saved === 'grid' || saved === 'list') {
      this.viewMode.set(saved);
    }
  }

  setViewMode(mode: QuoteViewMode) {
    this.viewMode.set(mode);
    localStorage.setItem(VIEW_MODE_KEY, mode);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['duplicateFromQuote'] && this.duplicateFromQuote) {
      this.formOpen = true;
      document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  selectSubTab(tab: QuoteSubTab) {
    this.activeSubTabChange.emit(tab);
  }
}

