import { CommonModule } from '@angular/common';
import { Component, Input } from '@angular/core';

@Component({
  selector: 'app-payment-status-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <article
      class="rounded-3xl border px-4 py-4 sm:px-5"
      [ngClass]="{
        'border-emerald-500/30 bg-emerald-500/10': tone === 'success',
        'border-amber-500/30 bg-amber-500/10': tone === 'warning',
        'border-red-500/30 bg-red-500/10': tone === 'danger',
        'border-white/10 bg-white/5': tone === 'neutral'
      }"
    >
      <p class="text-[11px] font-bold uppercase tracking-[0.3em] text-neutral-400">{{ eyebrow }}</p>
      <h3 class="mt-3 text-xl font-black text-white">{{ title }}</h3>
      <p class="mt-2 text-sm leading-6 text-neutral-300">{{ description }}</p>
      <div *ngIf="meta?.length" class="mt-4 grid gap-2 sm:grid-cols-2">
        <div *ngFor="let item of meta" class="rounded-2xl border border-white/10 bg-black/20 px-3 py-3">
          <p class="text-[10px] uppercase tracking-[0.24em] text-neutral-500">{{ item.label }}</p>
          <p class="mt-2 text-sm font-semibold text-white">{{ item.value }}</p>
        </div>
      </div>
    </article>
  `
})
export class PaymentStatusCardComponent {
  @Input() eyebrow = 'Status';
  @Input() title = '';
  @Input() description = '';
  @Input() tone: 'success' | 'warning' | 'danger' | 'neutral' = 'neutral';
  @Input() meta: Array<{ label: string; value: string }> = [];
}
