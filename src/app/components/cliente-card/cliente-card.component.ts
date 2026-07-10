import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, computed } from '@angular/core';
import { Cliente } from '../../models/cliente';

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #14a07a, #0a8466)',
  'linear-gradient(135deg, #2966e0, #1a4cb3)',
  'linear-gradient(135deg, #6b46e0, #4f30b3)',
  'linear-gradient(135deg, #d68008, #a8620a)',
  'linear-gradient(135deg, #3eba8c, #14a07a)',
  'linear-gradient(135deg, #c05fa8, #8a2d68)'
];

function hashString(value: string): number {
  let sum = 0;
  for (let i = 0; i < value.length; i++) sum += value.charCodeAt(i);
  return sum;
}

function pillClassForTag(tag: string): string {
  if (tag === 'VIP' || tag === 'Premium') return 'ct-pill-warn';
  if (tag === 'Corporativo') return 'ct-pill-info';
  return 'ct-pill-brand';
}

@Component({
  selector: 'app-cliente-card',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './cliente-card.component.html'
})
export class ClienteCardComponent {
  @Input({ required: true }) cliente!: Cliente;
  @Input() displayMode: 'grid' | 'list' = 'grid';

  @Output() view = new EventEmitter<string>();
  @Output() edit = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();

  get isVip(): boolean {
    return this.cliente.tags.includes('VIP');
  }

  get totalSpent(): number {
    return (this.cliente.trips || []).reduce((sum, t) => sum + t.amount, 0);
  }

  get lastTrip() {
    return (this.cliente.trips || [])[0] || null;
  }

  get initials(): string {
    const parts = this.cliente.full_name.trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(p => p[0]).join('').toUpperCase();
  }

  get avatarGradient(): string {
    return AVATAR_GRADIENTS[hashString(this.cliente.id) % AVATAR_GRADIENTS.length];
  }

  get emailDisplay(): string {
    return this.cliente.email || 'E-mail não informado';
  }

  get whatsappDisplay(): string {
    return this.cliente.whatsapp_number || 'WhatsApp não informado';
  }

  get customerSinceYear(): string {
    const value = this.cliente.customer_since;
    if (!value) return '—';
    const dateMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
    if (dateMatch) return dateMatch[3];
    const yearMatch = /(\d{4})/.exec(value);
    return yearMatch ? yearMatch[1] : value;
  }

  pillClass(tag: string): string {
    return pillClassForTag(tag);
  }

  formatCurrency(value: number): string {
    return 'R$ ' + value.toLocaleString('pt-BR', { minimumFractionDigits: 0 });
  }
}
