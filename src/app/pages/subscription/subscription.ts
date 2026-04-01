import { Component, inject, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SubscriptionService } from '../../../services/subscription.service';

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './subscription.html',
  styleUrls: ['./subscription.css']
})
export class SubscriptionComponent {
  private subscriptionService = inject(SubscriptionService);

  // Status da Empresa
  companyStatus = signal<any>(null);

  // Controle de Tela
  isLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');
  showCancelModal = signal(false);
  
  // Mapa de erros de campo em tempo real
  fieldErrors = signal<Record<string, string>>({});

  // Detalhes da Agência
  companyName = '';
  taxId = ''; // CNPJ/CPF
  postalCode = '';
  email = '';

  // Detalhes do Cartão de Crédito
  ccHolderName = '';
  ccNumber = '';
  ccExpiry = ''; // MM/AA
  ccCvv = '';

  constructor() {
    this.loadStatus();
  }

  async loadStatus() {
    this.isLoading.set(true);
    const status = await this.subscriptionService.getCompanyStatus();
    if (status) {
       this.companyStatus.set(status);
       // Preenche form se houver dados antigos
       if (status.tax_id) this.taxId = this.applyCpfCnpjMask(status.tax_id);
    }
    this.isLoading.set(false);
  }

  // ==========================================
  // 📏 Máscaras e Formatações em Tempo Real
  // ==========================================

  formatName(value: string) {
    this.companyName = value.toUpperCase();
    this.validateForm();
  }

  formatEmail(value: string) {
    this.email = value.toLowerCase().trim();
    this.validateForm();
  }

  formatCardccHolderName(value: string) {
    // Apenas letras e espaços, caixa alta
    this.ccHolderName = value.replace(/[^a-zA-ZÀ-ÿ\s]/g, '').toUpperCase();
    this.validateForm();
  }

  formatCardNumber(value: string) {
    let numeric = value.replace(/\D/g, '').substring(0, 16);
    let formatted = numeric.match(/.{1,4}/g)?.join(' ') || numeric;
    this.ccNumber = formatted;
    this.validateForm();
  }

  formatExpiration(value: string) {
    let numeric = value.replace(/\D/g, '').substring(0, 4);
    if (numeric.length >= 3) {
      this.ccExpiry = `${numeric.substring(0, 2)}/${numeric.substring(2, 4)}`;
    } else {
      this.ccExpiry = numeric;
    }
    this.validateForm();
  }

  formatCvv(value: string) {
    this.ccCvv = value.replace(/\D/g, '').substring(0, 4);
    this.validateForm();
  }

  formatTaxId(value: string) {
    this.taxId = this.applyCpfCnpjMask(value);
    this.validateForm();
  }

  formatPostalCode(value: string) {
    let numeric = value.replace(/\D/g, '').substring(0, 8);
    if (numeric.length >= 6) {
      this.postalCode = `${numeric.substring(0, 5)}-${numeric.substring(5, 8)}`;
    } else {
      this.postalCode = numeric;
    }
    this.validateForm();
  }

  private applyCpfCnpjMask(value: string): string {
    let numeric = value.replace(/\D/g, '').substring(0, 14);
    if (numeric.length <= 11) {
      // CPF
      numeric = numeric.replace(/(\d{3})(\d)/, '$1.$2');
      numeric = numeric.replace(/(\d{3})(\d)/, '$1.$2');
      numeric = numeric.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      return numeric;
    } else {
      // CNPJ
      numeric = numeric.replace(/^(\d{2})(\d)/, '$1.$2');
      numeric = numeric.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
      numeric = numeric.replace(/\.(\d{3})(\d)/, '.$1/$2');
      numeric = numeric.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
      return numeric;
    }
  }

  // ==========================================
  // 🛡 Validações e Submissão
  // ==========================================

  validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!this.companyName || this.companyName.length < 3) errors['companyName'] = 'Nome muito curto.';
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.email || !emailRegex.test(this.email)) errors['email'] = 'E-mail inválido.';

    const taxNumeric = this.taxId.replace(/\D/g, '');
    if (taxNumeric.length !== 11 && taxNumeric.length !== 14) errors['taxId'] = 'CPF/CNPJ inválido.';

    const ccNumeric = this.ccNumber.replace(/\D/g, '');
    if (ccNumeric.length < 13) errors['ccNumber'] = 'Cartão incompleto.';

    if (!this.ccHolderName || this.ccHolderName.split(' ').length < 2) errors['ccHolderName'] = 'Insira o nome completo como no cartão.';

    if (this.ccExpiry.length !== 5) {
      errors['ccExpiry'] = 'Formato MM/AA requerido.';
    } else {
      const [monthStr, yearStr] = this.ccExpiry.split('/');
      const month = parseInt(monthStr, 10);
      const year = parseInt(yearStr, 10) + 2000;
      
      if (month < 1 || month > 12) {
         errors['ccExpiry'] = 'Mês inválido.';
      } else {
         const now = new Date();
         const isExpired = year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1);
         if (isExpired) errors['ccExpiry'] = 'Cartão expirado.';
      }
    }

    if (this.ccCvv.length < 3) errors['ccCvv'] = 'CVV inválido.';

    this.fieldErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  isFormValid(): boolean {
    // Garante que campos não estejam em branco e que nao existam keys no fieldErrors
    if (!this.companyName || !this.email || !this.taxId || !this.ccNumber || !this.ccHolderName || !this.ccExpiry || !this.ccCvv) return false;
    return Object.keys(this.fieldErrors()).length === 0;
  }

  async processSubscription() {
    if (!this.isFormValid()) {
      this.errorMessage.set('Corrija os campos destacados antes de enviar.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set('');

    try {
      const result = await this.subscriptionService.subscribeCompany({
        companyName: this.companyName,
        email: this.email,
        taxId: this.taxId.replace(/\D/g, ''),
        postalCode: this.postalCode.replace(/\D/g, ''),
        creditCard: {
            holderName: this.ccHolderName,
            number: this.ccNumber.replace(/\D/g, ''),
            expiryMonth: this.ccExpiry.split('/')[0],
            expiryYear: this.ccExpiry.split('/')[1],
            ccv: this.ccCvv
        }
      });

      this.successMessage.set(result.message || 'Acesso validado e estabelecido! Recarregando plataforma em 3 segundos...');
      setTimeout(() => window.location.reload(), 3000);
      
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Ocorreu um erro ao gerar a assinatura.');
    } finally {
      this.isLoading.set(false);
    }
  }

  // ==========================================
  // 🛑 Cancelamento
  // ==========================================

  requestCancellation() {
    this.showCancelModal.set(true);
  }

  closeModal() {
    this.showCancelModal.set(false);
  }

  async confirmCancellation() {
    const activeSubId = this.companyStatus()?.asaas_subscription_id;
    if (!activeSubId) {
       this.errorMessage.set('Nenhuma assinatura Asaas encontrada no registro dessa empresa.');
       this.closeModal();
       return;
    }

    this.isLoading.set(true);
    this.closeModal();

    try {
      await this.subscriptionService.cancelSubscription(activeSubId);
      this.successMessage.set('Sua assinatura foi cancelada. Recarregando...');
      setTimeout(() => window.location.reload(), 3000);
    } catch (error: any) {
       this.errorMessage.set(error.message || 'Falha ao processar cancelamento. Contate o suporte.');
    } finally {
       this.isLoading.set(false);
    }
  }
}
