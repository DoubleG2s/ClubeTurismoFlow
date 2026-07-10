import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { ClienteFormComponent } from '../cliente-form/cliente-form.component';
import { Cliente, ClienteFormValue } from '../../models/cliente';

type ClienteDrawerMode = 'view' | 'edit';

function pillClassForTag(tag: string): string {
  if (tag === 'VIP' || tag === 'Premium') return 'ct-pill-warn';
  if (tag === 'Corporativo') return 'ct-pill-info';
  return 'ct-pill-brand';
}

@Component({
  selector: 'app-cliente-drawer',
  standalone: true,
  imports: [CommonModule, ClienteFormComponent],
  templateUrl: './cliente-drawer.component.html'
})
export class ClienteDrawerComponent {
  @Input({ required: true }) cliente!: Cliente;
  @Input() mode: ClienteDrawerMode = 'view';
  @Input() existingClientes: Cliente[] = [];
  @Input() isSaving = false;

  @Output() close = new EventEmitter<void>();
  @Output() modeChange = new EventEmitter<ClienteDrawerMode>();
  @Output() save = new EventEmitter<ClienteFormValue>();
  @Output() remove = new EventEmitter<string>();

  get initials(): string {
    const parts = (this.cliente.full_name || '?').trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  get totalSpent(): number {
    return (this.cliente.trips || []).reduce((sum, t) => sum + t.amount, 0);
  }

  pillClass(tag: string): string {
    return pillClassForTag(tag);
  }

  formatCurrency(value: number): string {
    return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
  }

  get addressLine(): string {
    return [this.cliente.address_street, this.cliente.address_number].filter(Boolean).join(', ') || '—';
  }

  get ufZipLine(): string {
    return [this.cliente.address_state, this.cliente.zip_code].filter(Boolean).join(' · ') || '—';
  }

  get customerSinceYear(): string {
    const value = this.cliente.customer_since;
    if (!value) return '—';
    const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    if (dateMatch) return dateMatch[3];
    const yearMatch = /(\d{4})/.exec(value);
    return yearMatch ? yearMatch[1] : value;
  }

  copyToClipboard(value: string | undefined) {
    if (!value) return;
    navigator.clipboard?.writeText(value).catch(() => {});
  }
}
