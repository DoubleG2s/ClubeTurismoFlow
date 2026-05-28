import { Component, OnInit, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { CommissionCalculationService } from '../../services/commission-calculation.service';
import { CommissionCalculatorEngine, CommissionCalculationResult } from '../../services/commission-calculator.engine';
import { CommissionCalculation } from '../../models/commission-calculation';
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
  
  private calcService = inject(CommissionCalculationService);
  private authService = inject(AuthService);
  private fb = inject(FormBuilder);

  // States
  currentResult = signal<CommissionCalculationResult | null>(null);
  simulationName = signal('');
  isSaving = signal(false);

  // Expose signal from service
  calculations = this.calcService.calculations;

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

      this.metaForm.valueChanges.subscribe(val => {
        this.updateSimulationName(val);
      });
    } else {
      this.metaForm.reset({ adultos: 2, criancas: 0 });
    }
  }

  updateSimulationName(val: any) {
    const hosp = val.hospedagem ? val.hospedagem.trim() : '';
    const ida = this.formatDate(val.dataIda);
    const volta = this.formatDate(val.dataVolta);
    const adt = val.adultos || 0;
    const chd = val.criancas || 0;
    const nome = val.nome ? val.nome.trim() : '';

    let parts = [];
    if (nome) parts.push(nome);
    if (hosp) parts.push(hosp);
    
    let hospPart = parts.join(' - ');

    let dates = '';
    if (ida && volta) dates = `${ida} a ${volta}`;
    else if (ida) dates = ida;
    else if (volta) dates = volta;
    
    let finalParts = [];
    if (hospPart) finalParts.push(hospPart);
    if (dates) finalParts.push(dates);

    let title = finalParts.join(', ');

    let pax = '';
    if (adt > 0) pax += `${adt} ADT`;
    if (chd > 0) pax += (pax ? ' / ' : '') + `${chd} CHD`;
    
    if (pax) {
      if (title) title += ' - ' + pax;
      else title = pax;
    }

    if (title) {
       this.simulationName.set(title);
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
      calculation_data: this.calcForm.value
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
    this.simulationName.set(calc.title);
    this.recalculate(calc.calculation_data);
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

  getPacoteComRav(data: any): string {
    const res = CommissionCalculatorEngine.calculate(data);
    return this.formatBRL(res.totalComDesconto + res.ravCheia);
  }
}
