import { Component, Input, Output, EventEmitter, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QuoteAiParserService, QuoteParseResult, ParsedQuoteData } from '../../services/quote-ai-parser.service';

export interface AiFillApplyEvent {
  optionIndex: number;
  data: ParsedQuoteData;
  filledFields: string[];
  missingFields: string[];
}

@Component({
  selector: 'app-quote-ai-fill',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './quote-ai-fill.component.html',
})
export class QuoteAiFillComponent {
  @Input() optionIndex = 0;
  @Input() hasExistingData = false;
  @Output() apply = new EventEmitter<AiFillApplyEvent>();
  @Output() close = new EventEmitter<void>();

  private parserService = inject(QuoteAiParserService);

  step = signal<1 | 2>(1);
  isAnalyzing = signal(false);
  parseResult = signal<QuoteParseResult | null>(null);
  errorMessage = signal<string | null>(null);
  rawText = '';

  get charCount() { return this.rawText.length; }

  async onAnalyze() {
    if (!this.rawText.trim()) return;
    this.isAnalyzing.set(true);
    this.errorMessage.set(null);
    try {
      const result = await this.parserService.parseRawText(this.rawText);
      this.parseResult.set(result);
      this.step.set(2);
    } catch {
      this.errorMessage.set('Erro ao conectar com a IA. Verifique sua conexão e tente novamente.');
    } finally {
      this.isAnalyzing.set(false);
    }
  }

  onApply() {
    const result = this.parseResult();
    if (!result) return;
    this.apply.emit({
      optionIndex: this.optionIndex,
      data: result.data,
      filledFields: result.filledFields,
      missingFields: result.missingFields,
    });
  }

  onBack() {
    this.step.set(1);
    this.parseResult.set(null);
    this.errorMessage.set(null);
  }

  onClose() {
    this.close.emit();
  }
}
