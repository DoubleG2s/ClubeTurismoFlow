import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, signal } from '@angular/core';

function parseBR(str: string): number {
  if (!str) return 0;
  let s = str.replace(/[R$\s]/g, '').trim();
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}

function formatBR(n: number): string {
  if (!n && n !== 0) return '';
  return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Campo de valor monetário: exibe formatado em BRL fora de foco, aceita colagem "4.781,34". */
@Component({
  selector: 'app-venda-currency-input',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './venda-currency-input.component.html'
})
export class VendaCurrencyInputComponent {
  @Input() value = 0;
  @Input() placeholder = 'R$ 0,00';
  @Input() disabled = false;
  @Output() valueChange = new EventEmitter<number>();

  focused = signal(false);
  display = signal('');

  get shown(): string {
    return this.focused() ? this.display() : (this.value ? formatBR(this.value) : '');
  }

  onFocus() {
    this.focused.set(true);
    this.display.set(this.value ? formatBR(this.value) : '');
  }

  onBlur() {
    this.focused.set(false);
    this.valueChange.emit(parseBR(this.display()));
  }

  onInput(event: Event) {
    this.display.set((event.target as HTMLInputElement).value);
  }

  onPaste(event: ClipboardEvent) {
    const pasted = event.clipboardData?.getData('text');
    if (pasted) {
      event.preventDefault();
      const parsed = parseBR(pasted);
      this.display.set(formatBR(parsed));
      this.valueChange.emit(parsed);
    }
  }
}
