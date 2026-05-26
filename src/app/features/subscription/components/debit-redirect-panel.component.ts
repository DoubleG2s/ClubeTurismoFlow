import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-debit-redirect-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rounded-[28px] border border-white/10 bg-neutral-900/70 p-5 sm:p-6">
      <div class="flex flex-wrap items-center gap-3">
        <span class="rounded-full border border-sky-400/30 bg-sky-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-300">
          Debito Asaas
        </span>
        <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
          {{ statusLabel }}
        </span>
      </div>

      <h3 class="mt-4 text-2xl font-black text-white">Pagamento seguro com debito</h3>
      <p class="mt-3 max-w-3xl text-sm leading-6 text-neutral-300">
        O sistema prepara tudo aqui. Depois voce escolhe se quer abrir o ambiente seguro agora ou em uma nova aba.
      </p>

      <div class="mt-5 grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <p class="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Valor</p>
          <p class="mt-2 text-lg font-bold text-white">{{ amount }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <p class="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Vencimento</p>
          <p class="mt-2 text-lg font-bold text-white">{{ dueDate }}</p>
        </div>
        <div class="rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
          <p class="text-[10px] uppercase tracking-[0.22em] text-neutral-500">Pagamento</p>
          <p class="mt-2 text-sm font-bold text-white">{{ paymentId }}</p>
        </div>
      </div>

      <div class="mt-5 rounded-3xl border border-white/10 bg-black/20 p-4">
        <p class="text-sm leading-6 text-neutral-300">
          Depois de pagar no Asaas, volte para o sistema. O status atualiza sozinho e voce tambem pode conferir manualmente.
        </p>

        <div class="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            (click)="continueInCurrentTab.emit()"
            class="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-neutral-950 transition hover:bg-amber-400"
          >
            Continuar para pagamento seguro
          </button>
          <button
            type="button"
            (click)="openInNewTab.emit()"
            class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
          >
            Abrir em nova aba
          </button>
          <button
            type="button"
            (click)="refresh.emit()"
            class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
          >
            Atualizar status
          </button>
        </div>
      </div>
    </section>
  `
})
export class DebitRedirectPanelComponent {
  @Input() amount = '';
  @Input() dueDate = '';
  @Input() paymentId = '';
  @Input() statusLabel = 'Aguardando pagamento';

  @Output() continueInCurrentTab = new EventEmitter<void>();
  @Output() openInNewTab = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();
}
