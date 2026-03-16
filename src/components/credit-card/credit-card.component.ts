import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Credit, getCreditStatusAndDays, CreditStatus } from '../../models/credit';

@Component({
  selector: 'app-credit-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="group relative bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col h-full hover:-translate-y-1">
      
      <!-- Colored Top Border Indicator based on Status -->
      <div class="absolute top-0 left-0 w-full h-1.5 transition-colors" [ngClass]="getTopBorderColor()"></div>

      <div class="p-5 flex-grow flex flex-col pt-6">
        
        <!-- Header: Client & Warning Badge -->
        <div class="flex justify-between items-start mb-4">
          <div class="pr-2">
            <h3 class="text-base font-bold text-slate-800 leading-tight group-hover:text-amber-600 transition-colors">
              {{ credit.client_name }}
            </h3>
            @if (credit.reservation_number) {
            <p class="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1 flex items-center gap-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
              </svg>
              {{ credit.reservation_number }}
            </p>
            }
          </div>
          
          <!-- Dynamic Status Badge -->
          <div class="shrink-0 flex flex-col items-end gap-1">
            <span class="px-2.5 py-1 text-[10px] uppercase tracking-wider font-bold rounded-full border shadow-sm flex items-center gap-1.5" [ngClass]="getStatusBadgeClasses()">
              <span class="w-1.5 h-1.5 rounded-full" [ngClass]="getStatusDotClasses()"></span>
              {{ computedStatus.status }}
            </span>
          </div>
        </div>

        <!-- Value Highlight -->
        <div class="mb-5 bg-amber-50/50 rounded-xl p-3 border border-amber-100/50 flex items-center justify-between">
            <span class="text-xs font-bold text-amber-900/40 uppercase tracking-wider">Crédito Gerado</span>
            <span class="text-lg font-black text-amber-600 tracking-tight">
               R$ {{ formatCurrency(credit.value) }}
            </span>
        </div>

        <!-- Dates Grid -->
        <div class="grid grid-cols-2 gap-3 mb-5 pl-1">
          <div>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Criado em</span>
            <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {{ formatDateBR(credit.credit_date) }}
            </span>
          </div>
          <div>
            <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-0.5">Vencimento</span>
            <span class="text-xs font-bold flex items-center gap-1.5" [ngClass]="isExpired() ? 'text-red-600' : 'text-slate-700'">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" [ngClass]="isExpired() ? 'text-red-500' : 'text-slate-400'" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ formatDateBR(credit.expiration_date) }}
            </span>
          </div>
        </div>

        <!-- Progress Bar for Time Remaining -->
        <div class="mt-auto pt-4 border-t border-slate-100">
           <div class="flex justify-between items-end mb-1.5">
             <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tempo Restante</span>
             
             @if (isExpired()) {
               <span class="text-[10px] font-bold text-red-600 uppercase">Expirado a {{ Math.abs(computedStatus.daysRemaining) }} dias</span>
             } @else {
               <span class="text-xs font-bold text-slate-700">{{ computedStatus.daysRemaining }} dias</span>
             }
           </div>
           
           <div class="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div class="h-full rounded-full transition-all duration-1000" 
                   [ngClass]="getProgressBarColor()"
                   [style.width.%]="getProgressBarWidth()">
              </div>
           </div>
        </div>

        <!-- Optional Observations -->
        @if (credit.observations) {
        <div class="mt-4 pt-3 border-t border-slate-100">
          <p class="text-xs text-slate-500 italic line-clamp-2">"{{ credit.observations }}"</p>
        </div>
        }
      </div>

      <!-- Action Buttons -->
      <div class="bg-slate-50/80 px-4 py-3 border-t border-slate-100 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity">
        <div class="flex items-center gap-2">
            <button (click)="onEdit()" class="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Editar Crédito">
              <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
        </div>
        
        <button (click)="onRemove()" class="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Deletar permanentemente">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

    </div>
  `,
  // Needed to expose Math to template
  styles: [`:host { display: block; height: 100%; }`]
})
export class CreditCardComponent {
  Math = Math;
  @Input({ required: true }) credit!: Credit;
  @Output() edit = new EventEmitter<string>();
  @Output() remove = new EventEmitter<string>();

  get computedStatus() {
    return getCreditStatusAndDays(this.credit.expiration_date);
  }

  isExpired(): boolean {
    return this.computedStatus.daysRemaining < 0;
  }

  // --- Visual Computed Props for Status ---

  getTopBorderColor(): string {
    const status = this.computedStatus.status;
    if (status === 'Vencido') return 'bg-red-500';
    if (status === 'Vence esse mês' || status === 'Próximo do vencimento') return 'bg-amber-400';
    return 'bg-emerald-500'; // Dentro do prazo
  }

  getStatusBadgeClasses(): string {
    const status = this.computedStatus.status;
    if (status === 'Vencido') return 'bg-red-50 text-red-700 border-red-100';
    if (status === 'Vence esse mês') return 'bg-orange-50 text-orange-700 border-orange-200';
    if (status === 'Próximo do vencimento') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-emerald-50 text-emerald-700 border-emerald-100'; // Dentro do prazo
  }
  
  getStatusDotClasses(): string {
    const status = this.computedStatus.status;
    if (status === 'Vencido') return 'bg-red-500 animate-pulse';
    if (status === 'Vence esse mês') return 'bg-orange-500 animate-pulse';
    if (status === 'Próximo do vencimento') return 'bg-amber-400';
    return 'bg-emerald-500'; 
  }

  getProgressBarColor(): string {
    const status = this.computedStatus.status;
    if (status === 'Vencido') return 'bg-red-500';
    if (status === 'Vence esse mês' || status === 'Próximo do vencimento') return 'bg-amber-500';
    return 'bg-emerald-500';
  }

  getProgressBarWidth(): number {
    if (this.isExpired()) return 100; // Full bar if expired (or 0 depending on design preference, going 100 to show "time is up")
    
    // Total days is 365 (1 year)
    const totalDays = 365;
    const daysRemaining = this.computedStatus.daysRemaining;
    const daysPassed = totalDays - daysRemaining;
    
    // Percentage passed
    let pct = (daysPassed / totalDays) * 100;
    return Math.max(0, Math.min(100, pct)); // Clamp between 0 and 100
  }

  // --- Formatters ---

  formatCurrency(value: number): string {
    return value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  formatDateBR(dateString: string): string {
    if (!dateString) return '';
    try {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return dateString;
    } catch {
      return dateString;
    }
  }

  // --- Events ---

  onEdit() {
    this.edit.emit(this.credit.id);
  }

  onRemove() {
    this.remove.emit(this.credit.id);
  }
}
