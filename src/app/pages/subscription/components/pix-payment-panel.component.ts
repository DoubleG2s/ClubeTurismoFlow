import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-pix-payment-panel',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="rounded-[28px] border border-amber-500/30 bg-neutral-900/70 p-5 sm:p-6">
      <div class="flex flex-col gap-5 lg:grid lg:grid-cols-[280px_minmax(0,1fr)]">
        <div class="rounded-[24px] border border-white/10 bg-white p-4">
          <img *ngIf="qrCodeDataUrl" [src]="qrCodeDataUrl" alt="QR Code Pix" class="mx-auto w-full max-w-[220px]" />
          <div *ngIf="!qrCodeDataUrl" class="flex h-[220px] items-center justify-center text-center text-sm text-neutral-500">
            O QR Code aparece aqui assim que a cobranca Pix for criada.
          </div>
        </div>

        <div>
          <div class="flex flex-wrap items-center gap-3">
            <span class="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-amber-300">
              Pix Asaas
            </span>
            <span class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-white">
              {{ statusLabel }}
            </span>
          </div>

          <h3 class="mt-4 text-2xl font-black text-white">Escaneie e pague</h3>
          <p class="mt-3 text-sm leading-6 text-neutral-300">
            Aponte a camera do banco para o QR Code ou copie o codigo Pix. Quando o pagamento entrar, o sistema atualiza sozinho.
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
            <p class="text-[10px] font-bold uppercase tracking-[0.26em] text-neutral-500">Codigo Pix</p>
            <p class="mt-3 break-all font-mono text-sm leading-6 text-white">{{ copyPaste || 'O codigo copia e cola aparecera aqui.' }}</p>
            <div class="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                (click)="copy.emit()"
                class="inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black uppercase tracking-[0.18em] transition"
                [ngClass]="copySuccess ? 'bg-emerald-500 text-neutral-950 hover:bg-emerald-400' : 'bg-amber-500 text-neutral-950 hover:bg-amber-400'"
              >
                <svg *ngIf="copySuccess" class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
                </svg>
                {{ copySuccess ? 'Codigo copiado' : 'Copiar codigo Pix' }}
              </button>
              <button
                type="button"
                (click)="refresh.emit()"
                class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
              >
                Atualizar status
              </button>
              <a
                *ngIf="invoiceUrl"
                [href]="invoiceUrl"
                target="_blank"
                rel="noopener noreferrer"
                class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
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
