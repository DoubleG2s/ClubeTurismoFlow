import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { Venda, VendaFormValue, brl, calcReceitaPrevista, calcValorTotal, num, pct, saldoInfo, somaPagamentos, statusPillClass } from '../../models/venda';
import { VendaFormComponent } from '../venda-form/venda-form.component';

type VendaDrawerMode = 'view' | 'edit';

@Component({
  selector: 'app-venda-drawer',
  standalone: true,
  imports: [CommonModule, VendaFormComponent],
  templateUrl: './venda-drawer.component.html'
})
export class VendaDrawerComponent {
  @Input({ required: true }) venda!: Venda;
  @Input() mode: VendaDrawerMode = 'view';
  @Input() isSaving = false;

  @Output() close = new EventEmitter<void>();
  @Output() modeChange = new EventEmitter<VendaDrawerMode>();
  @Output() save = new EventEmitter<VendaFormValue>();
  @Output() remove = new EventEmitter<number>();

  get valorTotal(): number {
    return calcValorTotal(this.venda.valores);
  }

  get receita(): number {
    return calcReceitaPrevista(this.venda.comissao, this.venda.valores);
  }

  get somaPag(): number {
    return somaPagamentos(this.venda.pagamentos);
  }

  get saldo() {
    return saldoInfo(this.venda.pagamentos, this.valorTotal);
  }

  get statusClass(): string {
    return statusPillClass(this.venda.status);
  }

  initials(nome: string): string {
    return (nome || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  brl = brl;
  pct = pct;
  num = num;
}
