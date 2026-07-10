import { Component, OnInit, signal, computed, inject, effect, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommissionCalculationService } from '../../services/commission-calculation.service';
import { CommissionCalculatorEngine, CommissionCalculationResult } from '../../services/commission-calculator.engine';
import { CommissionCalculation, CommissionCalculationData } from '../../models/commission-calculation';
import { animateMini } from 'motion';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-commission-calculator',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './commission-calculator.component.html'
})
export class CommissionCalculatorComponent implements OnInit {
  calcForm!: FormGroup;
  metaForm!: FormGroup;

  @ViewChild('gridEl') gridEl?: ElementRef<HTMLElement>;

  private calcService = inject(CommissionCalculationService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  constructor() {
    effect(() => {
      this.filteredCalculations(); // rastreia o signal
      setTimeout(() => this.animateCards(), 0);
    });
  }

  // States
  currentResult = signal<CommissionCalculationResult | null>(null);
  simulationName = signal('');
  isSaving = signal(false);

  // Expose signal from service
  calculations = this.calcService.calculations;

  // Filtros do histórico
  filterSearch = signal('');

  hasActiveFilters = computed(() => !!this.filterSearch());

  filteredCalculations = computed(() => {
    const search = this.filterSearch().toLowerCase().trim();
    if (!search) return this.calculations();
    return this.calculations().filter(calc => {
      const title = calc.title.toLowerCase();
      const hotel = (calc.calculation_data.hospedagem || '').toLowerCase();
      const nome = (calc.calculation_data.nome || '').toLowerCase();
      return title.includes(search) || hotel.includes(search) || nome.includes(search);
    });
  });


  ngOnInit() {
    this.initForm();
    
    // Assinar as mudanças do form para calcular em tempo real
    this.calcForm.valueChanges.subscribe(values => {
      this.recalculate(values);
    });

    // Cálculo inicial
    this.recalculate(this.calcForm.value);
  }

  private initForm(data = CommissionCalculatorEngine.getInitialData()) {
    if (this.calcForm) {
      this.calcForm.setValue({
        pacote: data.pacote,
        desconto: data.desconto,
        comissao: data.comissao,
        descontoComissao: data.descontoComissao,
        traslado: data.traslado,
        comissaoTraslado: data.comissaoTraslado,
        seguro: data.seguro,
        comissaoSeguro: data.comissaoSeguro,
        encargos: data.encargos,
        taxas: data.taxas
      });
    } else {
      this.calcForm = this.fb.group({
        pacote: [data.pacote],
        desconto: [data.desconto],
        comissao: [data.comissao],
        descontoComissao: [data.descontoComissao],
        traslado: [data.traslado],
        comissaoTraslado: [data.comissaoTraslado],
        seguro: [data.seguro],
        comissaoSeguro: [data.comissaoSeguro],
        encargos: [data.encargos],
        taxas: [data.taxas]
      });
    }

    if (!this.metaForm) {
      this.metaForm = this.fb.group({
        hospedagem: [''],
        dataIda: [''],
        dataVolta: [''],
        nome: [''],
        adultos: [2, [Validators.min(1)]],
        criancas: [0, [Validators.min(0)]]
      });

    } else {
      this.metaForm.reset({ adultos: 2, criancas: 0 });
    }
  }

  private formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
  }

  private recalculate(values: any) {
    const result = CommissionCalculatorEngine.calculate(values);
    this.currentResult.set(result);
  }

  formatBRL(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  // Máscara monetária customizada simples para o input de valor
  onMoneyInput(event: Event, controlName: string) {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, ''); // Remove não-números
    
    if (value === '') {
      this.calcForm.get(controlName)?.setValue('', { emitEvent: true });
      return;
    }

    const numberValue = parseInt(value, 10) / 100;
    
    // Formata o valor localmente para visualização
    const formatted = new Intl.NumberFormat('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(numberValue);

    input.value = formatted;
    // O setValue disparamos com a string, o Engine vai converter usando toNumber
    this.calcForm.get(controlName)?.setValue(formatted, { emitEvent: true });
  }

  handleReset() {
    this.initForm();
    this.simulationName.set('');
    this.recalculate(this.calcForm.value);
  }

  async saveSimulation() {
    const title = this.simulationName().trim();
    if (!title) {
      alert('Digite um nome para a simulação.');
      return;
    }

    this.isSaving.set(true);
    const success = await this.calcService.addCalculation({
      title: title,
      calculation_data: { ...this.calcForm.value, ...this.metaForm.value }
    });

    if (success) {
      this.metaForm.reset({ adultos: 2, criancas: 0 }, { emitEvent: false });
      this.simulationName.set('');
    } else {
      alert('Erro ao salvar a simulação.');
    }
    this.isSaving.set(false);
  }

  simulationToDelete = signal<string | null>(null);

  loadSimulation(calc: CommissionCalculation) {
    this.initForm(calc.calculation_data);
    const d = calc.calculation_data;
    if (d.hospedagem !== undefined || d.nome !== undefined || d.dataIda !== undefined || d.dataVolta !== undefined || d.adultos !== undefined) {
      this.metaForm.patchValue({
        hospedagem: d.hospedagem ?? '',
        dataIda: d.dataIda ?? '',
        dataVolta: d.dataVolta ?? '',
        nome: d.nome ?? '',
        adultos: d.adultos ?? 2,
        criancas: d.criancas ?? 0
      }, { emitEvent: false });
    }
    this.simulationName.set(calc.title);
    this.recalculate(calc.calculation_data);
  }

  formatCardDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return '';
  }

  formatCardDates(data: CommissionCalculationData): string {
    const ida = this.formatCardDate(data.dataIda || '');
    const volta = this.formatCardDate(data.dataVolta || '');
    if (ida && volta) return `${ida} → ${volta}`;
    return ida || volta;
  }

  confirmDelete(id: string) {
    this.simulationToDelete.set(id);
  }

  cancelDelete() {
    this.simulationToDelete.set(null);
  }

  async executeDelete() {
    const id = this.simulationToDelete();
    if (id) {
      await this.calcService.deleteCalculation(id);
      this.simulationToDelete.set(null);
    }
  }

  clearFilters() {
    this.filterSearch.set('');
  }

  private animateCards() {
    const grid = this.gridEl?.nativeElement;
    if (!grid) return;
    const cards = grid.querySelectorAll('.sim-card');
    if (!cards.length) return;
    cards.forEach((card, i) => {
      animateMini(
        card,
        { opacity: [0, 1], transform: ['translateY(16px)', 'translateY(0)'] },
        { duration: 0.35, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] as const }
      );
    });
  }

  getPacoteComRav(data: any): string {
    const res = CommissionCalculatorEngine.calculate(data);
    return this.formatBRL(res.totalComDesconto + res.ravCheia);
  }

}
