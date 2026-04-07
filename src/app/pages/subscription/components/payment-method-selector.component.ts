import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CheckoutPaymentMethod } from '../../../../services/subscription.service';

type PaymentOption = {
  id: CheckoutPaymentMethod;
  title: string;
  helper: string;
  subtitle: string;
  badge: string;
  icon: 'credit_card' | 'pix';
};

@Component({
  selector: 'app-payment-method-selector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid gap-3">
      <button
        *ngFor="let option of options"
        type="button"
        (click)="select.emit(option.id)"
        [class.ring-2]="selected === option.id"
        [class.ring-amber-400]="selected === option.id"
        class="rounded-[22px] border border-white/10 bg-neutral-900/70 px-4 py-4 text-left transition hover:border-amber-400/40 hover:bg-neutral-900"
      >
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div class="flex items-center gap-3">
            <span class="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-amber-300">
              <svg *ngIf="option.icon === 'credit_card'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <rect x="3" y="5" width="18" height="14" rx="2"></rect>
                <path d="M3 10h18"></path>
                <path d="M7 15h3"></path>
              </svg>
              <svg *ngIf="option.icon === 'pix'" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <g transform="translate(1.5 1.5) scale(0.42)">
                  <path fill="currentColor" stroke="none" d="M25,0.03906c-2.16,0 -4.20047,0.84109 -5.73047,2.37109l-9.58984,9.58984h3.25c1.6,0 3.11023,0.61977 4.24023,1.75977l6.76953,6.76953c0.58,0.58 1.54109,0.58023 2.12109,-0.00977l6.76953,-6.75976c1.13,-1.14 2.64023,-1.75977 4.24023,-1.75977h3.25l-9.58984,-9.58984c-1.53,-1.53 -3.57047,-2.37109 -5.73047,-2.37109zM7.67969,14l-5.26953,5.26953c-3.16,3.16 -3.16,8.30094 0,11.46094l5.26953,5.26953h5.25c1.07,0 2.07008,-0.41992 2.83008,-1.16992l6.76953,-6.76953c1.36,-1.36 3.58141,-1.36 4.94141,0l6.76953,6.76953c0.76,0.75 1.76008,1.16992 2.83008,1.16992h5.25l5.26953,-5.26953c3.16,-3.16 3.16,-8.30094 0,-11.46094l-5.26953,-5.26953h-5.25c-1.07,0 -2.07008,0.41992 -2.83008,1.16992l-6.76953,6.76953c-0.68,0.68 -1.5707,1.02148 -2.4707,1.02148c-0.9,0 -1.7907,-0.34148 -2.4707,-1.02148l-6.76953,-6.76953c-0.76,-0.75 -1.76008,-1.16992 -2.83008,-1.16992zM25,29.03711c-0.385,0.00125 -0.77055,0.14836 -1.06055,0.44336l-6.76953,6.75977c-1.13,1.14 -2.64024,1.75977 -4.24023,1.75977h-3.25l9.58984,9.58984c1.53,1.53 3.57047,2.37109 5.73047,2.37109c2.16,0 4.20047,-0.84109 5.73047,-2.37109l9.58984,-9.58984h-3.25c-1.6,0 -3.11023,-0.61977 -4.24023,-1.75977l-6.76953,-6.76953c-0.29,-0.29 -0.67555,-0.43484 -1.06055,-0.43359z"></path>
                </g>
              </svg>
            </span>
            <div>
              <span class="block text-base font-black uppercase tracking-[0.08em] text-white">{{ option.title }}</span>
              <span class="mt-1 block text-xs font-medium uppercase tracking-[0.18em] text-neutral-500">{{ option.helper }}</span>
            </div>
          </div>
          <span class="shrink-0 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300">
            {{ option.badge }}
          </span>
        </div>
        <p class="mt-3 text-sm leading-6 text-neutral-400">{{ option.subtitle }}</p>
      </button>
    </div>
  `
})
export class PaymentMethodSelectorComponent {
  @Input() selected: CheckoutPaymentMethod = 'credit_card';
  @Output() select = new EventEmitter<CheckoutPaymentMethod>();

  readonly options: PaymentOption[] = [
    {
      id: 'credit_card',
      title: 'Cartao de credito',
      helper: 'Cobranca mensal',
      subtitle: 'Melhor para quem quer pagar todo mes de forma automatica.',
      badge: 'Recorrente',
      icon: 'credit_card'
    },
    {
      id: 'pix',
      title: 'Pix',
      helper: 'Paga na hora',
      subtitle: 'Melhor para quem quer pagar agora com QR Code ou codigo para copiar.',
      badge: 'Rapido',
      icon: 'pix'
    }
  ];
}
