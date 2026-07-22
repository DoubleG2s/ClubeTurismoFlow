import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Venda, brl, calcReceitaPrevista, calcValorTotal, statusPillClass } from '../../models/venda';

@Component({
  selector: 'app-venda-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './venda-card.component.html'
})
export class VendaCardComponent {
  @Input({ required: true }) venda!: Venda;
  @Input() displayMode: 'grid' | 'list' = 'grid';

  @Output() view = new EventEmitter<number>();
  @Output() edit = new EventEmitter<number>();
  @Output() remove = new EventEmitter<number>();

  get valorTotal(): number {
    return calcValorTotal(this.venda.valores);
  }

  get receitaPrevista(): number {
    return calcReceitaPrevista(this.venda.comissao, this.venda.valores);
  }

  get statusClass(): string {
    return statusPillClass(this.venda.status);
  }

  formatCurrency(value: number): string {
    return brl(value);
  }
}
