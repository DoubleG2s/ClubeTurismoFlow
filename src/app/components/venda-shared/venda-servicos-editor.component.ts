import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

export interface VendaServicoItem {
  nome: string;
  detalhe: string;
}

export const SERVICOS_COMUNS = ['Aéreo', 'Hotel', 'Traslados', 'Seguro viagem', 'Passeios', 'Carro', 'Ingresso', 'Cruzeiro'];

export function parseServicos(servicos: VendaServicoItem[], servicosInclusos: string): VendaServicoItem[] {
  if (Array.isArray(servicos) && servicos.length) return servicos;
  return (servicosInclusos || '').split(',').map(s => s.trim()).filter(Boolean).map(nome => ({ nome, detalhe: '' }));
}

/** Editor de serviços inclusos: cada serviço selecionado/adicionado vira uma linha com detalhamento próprio. */
@Component({
  selector: 'app-venda-servicos-editor',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './venda-servicos-editor.component.html'
})
export class VendaServicosEditorComponent {
  @Input() servicos: VendaServicoItem[] = [];
  @Input() servicosInclusos = '';
  /** Nomes de serviços comuns a ocultar do seletor rápido (ex: "Hotel" quando o produto é só Voo). */
  @Input() ocultar: string[] = [];
  /** Nomes de serviços que devem permanecer sempre marcados e não podem ser desmarcados/removidos. */
  @Input() obrigatorios: string[] = [];
  @Output() commit = new EventEmitter<{ servicos: VendaServicoItem[]; nomes: string }>();

  get comuns(): string[] {
    const ocultos = this.ocultar.map(o => o.toLowerCase());
    return SERVICOS_COMUNS.filter(s => !ocultos.includes(s.toLowerCase()));
  }

  isObrigatorio(nome: string): boolean {
    return this.obrigatorios.some(o => o.toLowerCase() === nome.toLowerCase());
  }

  get list(): VendaServicoItem[] {
    return parseServicos(this.servicos, this.servicosInclusos);
  }

  isOn(nome: string): boolean {
    return this.list.some(s => s.nome.toLowerCase() === nome.toLowerCase());
  }

  private setAll(next: VendaServicoItem[]) {
    this.commit.emit({ servicos: next, nomes: next.map(s => s.nome).filter(Boolean).join(', ') });
  }

  toggleComum(nome: string) {
    if (this.isObrigatorio(nome)) return;
    if (this.isOn(nome)) this.setAll(this.list.filter(s => s.nome.toLowerCase() !== nome.toLowerCase()));
    else this.setAll([...this.list, { nome, detalhe: '' }]);
  }

  setNome(i: number, val: string) {
    this.setAll(this.list.map((s, idx) => idx === i ? { ...s, nome: val } : s));
  }

  setDetalhe(i: number, val: string) {
    this.setAll(this.list.map((s, idx) => idx === i ? { ...s, detalhe: val } : s));
  }

  remove(i: number) {
    const item = this.list[i];
    if (item && this.isObrigatorio(item.nome)) return;
    this.setAll(this.list.filter((_, idx) => idx !== i));
  }

  addPersonalizado() {
    this.setAll([...this.list, { nome: '', detalhe: '' }]);
  }
}
