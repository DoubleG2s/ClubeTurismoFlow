import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import { VendaCliente } from '../../models/venda';
import { VendaService } from '../../services/venda.service';

function maskCPF(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 11);
  let o = d.slice(0, 3);
  if (d.length > 3) o += '.' + d.slice(3, 6);
  if (d.length > 6) o += '.' + d.slice(6, 9);
  if (d.length > 9) o += '-' + d.slice(9, 11);
  return o;
}

function maskDate(v: string): string {
  const d = (v || '').replace(/\D/g, '').slice(0, 8);
  let o = d.slice(0, 2);
  if (d.length > 2) o += '/' + d.slice(2, 4);
  if (d.length > 4) o += '/' + d.slice(4, 8);
  return o;
}

/** Autocomplete de Pagante/Passageiro — busca na base mockada de clientes de Vendas e permite criar um novo inline. */
@Component({
  selector: 'app-venda-cliente-autocomplete',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './venda-cliente-autocomplete.component.html'
})
export class VendaClienteAutocompleteComponent implements OnChanges {
  private vendaService = inject(VendaService);

  @Input() value: VendaCliente | null = null;
  @Input() placeholder = 'Buscar cliente por nome ou CPF…';
  @Input() initialName = '';
  @Output() valueChange = new EventEmitter<VendaCliente | null>();

  query = signal('');
  open = signal(false);
  creating = signal(false);
  novoNome = signal('');
  novoCpf = signal('');
  novoNascimento = signal('');

  clientes = this.vendaService.clientesMini;

  matches = computed(() => {
    const term = this.query().trim().toLowerCase();
    const list = this.clientes();
    if (!term) return list.slice(0, 6);
    return list.filter(c => c.nome.toLowerCase().includes(term) || c.cpf.includes(term)).slice(0, 6);
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['initialName'] && this.initialName && !this.value) {
      this.query.set(this.initialName);
      this.novoNome.set(this.initialName);
      this.open.set(true);
    }
  }

  onQueryInput(event: Event) {
    this.query.set((event.target as HTMLInputElement).value);
    this.open.set(true);
  }

  pick(c: VendaCliente) {
    this.valueChange.emit(c);
    this.open.set(false);
    this.query.set('');
    this.creating.set(false);
  }

  clear() {
    this.valueChange.emit(null);
  }

  startCreating() {
    this.creating.set(true);
  }

  onNovoCpfInput(event: Event) {
    this.novoCpf.set(maskCPF((event.target as HTMLInputElement).value));
  }

  onNovoNascimentoInput(event: Event) {
    this.novoNascimento.set(maskDate((event.target as HTMLInputElement).value));
  }

  salvarNovo() {
    if (!this.novoNome().trim()) return;
    const created = this.vendaService.createCliente({
      nome: this.novoNome(),
      cpf: this.novoCpf(),
      nascimento: this.novoNascimento(),
    });
    this.pick(created);
    this.novoNome.set('');
    this.novoCpf.set('');
    this.novoNascimento.set('');
  }
}
