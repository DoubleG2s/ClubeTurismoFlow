import { Injectable, signal, computed, inject } from '@angular/core';
import { supabase } from './supabase';
import { TenantService } from './tenant.service';
import { AuthService } from './auth.service';
import { SaasInvoice } from '../models/saas-invoice';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private tenantService = inject(TenantService);
  private authService = inject(AuthService);

  private invoicesSignal = signal<SaasInvoice[]>([]);
  private loadingSignal = signal<boolean>(false);

  readonly invoices = computed(() => this.invoicesSignal());
  readonly isLoading = computed(() => this.loadingSignal());

  // Atualiza também os dados da companhia ativa (já que a Auth/Tenant service as carregou, mas queremos dados frescos)
  async getCompanyStatus() {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) return null;

    const { data, error } = await supabase
      .from('companies')
      .select('subscription_status, subscription_expires_at, tax_id, asaas_customer_id, asaas_subscription_id')
      .eq('id', companyId)
      .single();

    if (error) {
      console.error('Erro ao buscar status de assinatura da empresa:', error);
      return null;
    }
    return data;
  }

  async loadInvoices() {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) return;

    this.loadingSignal.set(true);
    try {
      const { data, error } = await supabase
        .from('saas_invoices')
        .select('*')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) this.invoicesSignal.set(data as SaasInvoice[]);
    } catch (error) {
      console.error('Erro ao carregar faturas:', error);
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async cancelSubscription(subscriptionId: string) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponível. Efetue login na sua agência.');
    
    this.loadingSignal.set(true);
    try {
      const url = window.location.hostname === 'localhost' 
          ? 'http://localhost:3000/api/asaas/cancel-subscription' 
          : '/api/asaas/cancel-subscription';
          
      const response = await fetch(url, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            companyId,
            subscriptionId
         })
      });

      const result = await response.json();
      if (!response.ok) {
         throw new Error(result.error || 'Erro ao cancelar assinatura.');
      }

      return result;
    } catch (error) {
       console.error('Subscription Cancel Error:', error);
       throw error;
    } finally {
       this.loadingSignal.set(false);
    }
  }

  async subscribeCompany(payload: { 
    companyName: string; 
    email?: string;
    taxId: string; 
    postalCode: string;
    creditCard: {
      holderName: string;
      number: string;
      expiryMonth: string;
      expiryYear: string;
      ccv: string;
    }
  }) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponível. Efetue login na sua agência.');

    try {
      // Chama a nossa Vercel Function
      const url = window.location.hostname === 'localhost' 
          ? 'http://localhost:3000/api/asaas/subscribe' 
          : '/api/asaas/subscribe';
          
      const response = await fetch(url, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
            companyId,
            companyName: payload.companyName,
            email: payload.email,
            taxId: payload.taxId,
            postalCode: payload.postalCode,
            creditCard: payload.creditCard,
            value: 99.90 // Valor da Mensalidade B2B
         })
      });

      const result = await response.json();
      if (!response.ok) {
         throw new Error(result.error || 'Erro ao comunicar com a API de geração de assinatura.');
      }

      return result; // Retorna o ID da subscription do Asaas e possivelmente os dados do Boleto/Pix
    } catch (error) {
       console.error('Subscription Creation Error:', error);
       throw error;
    }
  }
}
