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
        'border-emerald-200 bg-emerald-50': tone === 'success',
        'border-amber-200 bg-amber-50': tone === 'warning',
        'border-red-200 bg-red-50': tone === 'danger',
        'border-slate-200 bg-white': tone === 'neutral'
      }"
    >
      <p class="text-[11px] font-bold uppercase tracking-[0.3em] text-slate-500">{{ eyebrow }}</p>
      <h3 class="mt-3 text-xl font-black text-slate-900">{{ title }}</h3>
      <p class="mt-2 text-sm leading-6 text-slate-600">{{ description }}</p>
      <div *ngIf="meta?.length" class="mt-4 grid gap-2 sm:grid-cols-2">
        <div *ngFor="let item of meta" class="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p class="text-[10px] uppercase tracking-[0.24em] text-slate-500">{{ item.label }}</p>
          <p class="mt-2 text-sm font-semibold text-slate-900">{{ item.value }}</p>
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
