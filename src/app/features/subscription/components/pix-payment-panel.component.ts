import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pix-payment-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rounded-[28px] border border-amber-200 bg-gradient-to-br from-white via-amber-50/40 to-white p-5 shadow-sm sm:p-6">
      <div class="flex flex-col gap-5 lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <div class="rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm">
          <img *ngIf="qrCodeDataUrl" [src]="qrCodeDataUrl" alt="QR Code Pix" class="mx-auto w-full max-w-[220px]" />
          <div *ngIf="!qrCodeDataUrl" class="flex h-[220px] items-center justify-center text-center text-sm text-slate-500">
            O QR Code aparece aqui assim que a cobranca Pix for criada.
          </div>
        </div>

        <div>
          <div class="flex flex-wrap items-center gap-3">
            <span class="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-700">
              Pix Asaas
            </span>
            <span class="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-700">
              {{ statusLabel }}
            </span>
          </div>

          <h3 class="mt-4 text-2xl font-black text-slate-900">Escaneie e pague</h3>
          <p class="mt-3 text-sm leading-6 text-slate-600">
            Aponte a camera do banco para o QR Code ou copie o codigo Pix. Quando o pagamento entrar, o sistema atualiza sozinho.
          </p>

          <div class="mt-5 grid gap-3 sm:grid-cols-3">
            <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p class="text-[10px] uppercase tracking-[0.22em] text-slate-500">Valor</p>
              <p class="mt-2 text-lg font-bold text-slate-900">{{ amount }}</p>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p class="text-[10px] uppercase tracking-[0.22em] text-slate-500">Vencimento</p>
              <p class="mt-2 text-lg font-bold text-slate-900">{{ dueDate }}</p>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p class="text-[10px] uppercase tracking-[0.22em] text-slate-500">Pagamento</p>
              <p class="mt-2 text-sm font-bold text-slate-900">{{ paymentId }}</p>
            </div>
          </div>

          <div class="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <p class="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-500">Codigo Pix</p>
            <p class="mt-3 break-all font-mono text-sm leading-6 text-slate-900">{{ copyPaste || 'O codigo copia e cola aparecera aqui.' }}</p>
            <div class="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                (click)="copy.emit()"
                class="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition"
                [ngClass]="copySuccess ? 'bg-emerald-500 text-white hover:bg-emerald-600' : 'bg-amber-500 text-slate-950 hover:bg-amber-400'"
              >
                <svg *ngIf="copySuccess" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
                </svg>
                {{ copySuccess ? 'Codigo copiado' : 'Copiar codigo Pix' }}
              </button>
              <button
                type="button"
                (click)="refresh.emit()"
                class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-100"
              >
                Atualizar status
              </button>
              <a
                *ngIf="invoiceUrl"
                [href]="invoiceUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-slate-700 transition hover:bg-slate-100"
              >
                Abrir cobranca em nova aba
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  `
})
export class PixPaymentPanelComponent {
  @Input() qrCodeDataUrl = '';
  @Input() copyPaste = '';
  @Input() amount = '';
  @Input() dueDate = '';
  @Input() paymentId = '';
  @Input() invoiceUrl = '';
  @Input() statusLabel = 'Aguardando pagamento';
  @Input() copySuccess = false;

  @Output() copy = new EventEmitter<void>();
  @Output() refresh = new EventEmitter<void>();
}
