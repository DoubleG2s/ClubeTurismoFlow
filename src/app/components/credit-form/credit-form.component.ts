import { Component, EventEmitter, Output, Input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Credit } from '../../models/credit';

@Component({
  selector: 'app-credit-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm relative animate-fade-in">
      
      <!-- Top Decorator Line -->
      <div class="absolute top-0 left-0 w-full h-1 bg-amber-500 rounded-t-2xl"></div>

      <div class="flex items-center gap-2 mb-6 border-b border-slate-100 pb-4">
        <div class="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-600">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 class="text-base font-bold text-slate-800 tracking-tight">
          {{ isEditMode() ? 'Editar Crédito' : 'Detalhes do Crédito' }}
        </h3>
      </div>

      <form (ngSubmit)="onSubmit()" class="space-y-5">
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
          <!-- Client Name -->
          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Cliente Responsável <span class="text-amber-500">*</span></label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <input type="text" [(ngModel)]="formData.client_name" name="client_name" required
                class="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium"
                placeholder="Ex: Nome Completo">
            </div>
          </div>

          <!-- Reservation Number -->
          <div>
            <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Nº da Reserva Original</label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                </svg>
              </div>
              <input type="text" [(ngModel)]="formData.reservation_number" name="reservation_number"
                class="w-full pl-10 pr-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all font-medium uppercase"
                placeholder="Referência">
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <!-- Data Original da Viagem -->
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data da Viagem Cancelada</label>
            <input type="date" [(ngModel)]="formData.original_travel_date" name="original_travel_date"
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer">
          </div>

          <!-- Data de Crédito Gerado -->
          <div>
            <label class="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Data em que virou Crédito <span class="text-amber-500">*</span></label>
            <input type="date" [(ngModel)]="formData.credit_date" name="credit_date" required
              class="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all cursor-pointer">
          </div>
          
          <!-- Valor do Crédito -->
          <div>
            <label class="block text-[10px] font-bold text-amber-500 uppercase tracking-wider mb-1.5">Valor do Crédito (R$) <span class="text-amber-500">*</span></label>
            <div class="relative">
              <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <span class="text-slate-500 font-bold text-sm">R$</span>
              </div>
              <input type="text" inputmode="numeric" pattern="[0-9]*" [(ngModel)]="displayValue" (blur)="onValueBlur()" (input)="onValueInput($event)" (keydown)="preventLetters($event)" name="value" required
                class="w-full pl-9 pr-3 py-2 bg-amber-50/30 border border-amber-200 rounded-lg text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all text-right"
                placeholder="0,00">
            </div>
          </div>
        </div>

        <!-- Observações -->
        <div>
          <label class="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-2">Observações Adicionais</label>
          <textarea [(ngModel)]="formData.observations" name="observations" rows="2"
            class="w-full px-3 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all resize-none"
            placeholder="Detalhes sobre a negociação da conversão em crédito..."></textarea>
        </div>

        <!-- Submit Button -->
        <div class="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
          @if (isEditMode()) {
            <button type="button" (click)="onCancel()"
              class="px-5 py-2.5 rounded-xl text-sm font-semibold text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-200 transition-all"
              [disabled]="isLoading">
              Cancelar
            </button>
          }
          <button type="submit"
            class="group relative px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-md shadow-amber-500/20 focus:outline-none transition-all flex items-center gap-2 overflow-hidden"
            [disabled]="isLoading || !isFormValid()">
            @if (isLoading) {
              <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Salvando...</span>
            } @else {
              <span>{{ isEditMode() ? 'Salvar Alterações' : 'Registrar Crédito' }}</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            }
          </button>
        </div>
      </form>
    </div>
  `
})
export class CreditFormComponent {
  @Input() set creditToEdit(credit: Credit | null) {
    if (credit) {
      this.isEditMode.set(true);
      this.formData = { ...credit };
      this.displayValue = credit.value ? credit.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '0,00';
    } else {
      this.resetForm();
    }
  }
  
  @Input() set prefillData(data: Partial<Credit> | null) {
    if (data && !this.isEditMode()) {
      this.formData = { ...this.formData, ...data };
      if (data.value) {
        this.displayValue = data.value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }
    }
  }
  
  @Input() isLoading = false;
  
  @Output() save = new EventEmitter<Omit<Credit, 'id' | 'created_at' | 'expiration_date'>>();
  @Output() update = new EventEmitter<{ id: string, data: Partial<Credit> }>();
  @Output() cancel = new EventEmitter<void>();

  isEditMode = signal(false);
  
  formData: any = {
    client_name: '',
    reservation_number: '',
    original_travel_date: '',
    credit_date: new Date().toISOString().split('T')[0],
    value: 0,
    observations: ''
  };

  displayValue: string = '';

  preventLetters(event: KeyboardEvent) {
    const allowedKeys = ['Backspace', 'Tab', 'ArrowLeft', 'ArrowRight', 'Delete', 'Enter'];
    if (allowedKeys.includes(event.key)) return;
    
    // Prevent default if character is not a digit (blocks letters and negative symbols like -)
    if (!/^[0-9]$/.test(event.key)) {
      event.preventDefault();
    }
  }

  onValueInput(event: Event) {
    const input = event.target as HTMLInputElement;
    let val = input.value.replace(/\D/g, '');
    let numericValue = parseInt(val, 10) / 100;
    
    if (isNaN(numericValue)) numericValue = 0;
    
    this.formData.value = numericValue;
    this.displayValue = numericValue > 0 ? numericValue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '';
  }

  onValueBlur() {
    if (!this.displayValue) {
      this.displayValue = '0,00';
      this.formData.value = 0;
    }
  }

  isFormValid() {
    return this.formData.client_name?.trim() && 
           this.formData.credit_date && 
           this.formData.value > 0;
  }

  onSubmit() {
    if (!this.isFormValid()) return;
    
    // Ensure value is a number
    const submissionData = { ...this.formData };
    
    if (this.isEditMode()) {
      const id = submissionData.id;
      delete submissionData.id;
      delete submissionData.created_at;
      delete submissionData.expiration_date; // Prevent trying to manually update dynamic field
      this.update.emit({ id, data: submissionData });
    } else {
      delete submissionData.id; 
      this.save.emit(submissionData);
      
      // Limpa formulário após registrar um novo crédito
      this.resetForm();
    }
  }

  onCancel() {
    this.cancel.emit();
  }

  resetForm() {
    this.isEditMode.set(false);
    this.formData = {
      client_name: '',
      reservation_number: '',
      original_travel_date: '',
      credit_date: new Date().toISOString().split('T')[0],
      value: 0,
      observations: ''
    };
    this.displayValue = '';
  }
}
