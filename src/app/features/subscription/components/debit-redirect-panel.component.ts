import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-debit-redirect-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div class="flex flex-wrap items-center gap-3">
        <span class="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-sky-700">
          Debito Asaas
        </span>
        <span class="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
          {{ statusLabel }}
        </span>
      </div>

      <h3 class="mt-4 text-2xl font-black text-slate-900">Pagamento seguro com debito</h3>
      <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        O sistema prepara tudo aqui. Depois voce escolhe se quer abrir o ambiente seguro agora ou em uma nova aba.
      </p>

      <div class="mt-5 grid gap-3 sm:grid-cols-3">
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p class="text-[10px] uppercase tracking-[0.22em] text-slate-500">Valor</p>
          <p class="mt-2 text-lg font-bold text-slate-900">{{ amount }}</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p class="text-[10px] uppercase tracking-[0.22em] text-slate-500">Vencimento</p>
          <p class="mt-2 text-lg font-bold text-slate-900">{{ dueDate }}</p>
        </div>
        <div class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p class="text-[10px] uppercase tracking-[0.22em] text-slate-500">Pagamento</p>
          <p class="mt-2 text-sm font-bold text-slate-900">{{ paymentId }}</p>
        </div>
      </div>

      <div class="mt-5 rounded-3xl border border-slate-200 bg-slate-50 p-4">
        <p class="text-sm leading-6 text-slate-600">
          Depois de pagar no Asaas, volte para o sistema. O status atualiza sozinho e voce tambem pode conferir manualmente.
        </p>

        <div class="mt-4 flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            (click)="continueInCurrentTab.emit()"
            class="rounded-2xl bg-amber-500 px-4 py-3 text-sm font-black uppercase tracking-[0.18em] text-slate-950 transition hover:bg-amber-400"
          >
            Continuar para pagamento seguro
          </button>
          <button
            type="button"
            (click)="openInNewTab.emit()"
            class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50"
          >
            Abrir em nova aba
          </button>
          <button
            type="button"
            (click)="refresh.emit()"
            class="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-50"
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
