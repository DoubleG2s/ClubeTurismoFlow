import { Injectable, computed, inject, signal } from '@angular/core';
import { supabase } from './supabase';
import { AuthService } from './auth.service';
import { TenantService } from './tenant.service';
import { SaasInvoice } from '../models/saas-invoice';
import { environment } from '../../environments/environment';

export type CheckoutPaymentMethod = 'credit_card' | 'pix' | 'debit_card';

@Injectable({
  providedIn: 'root'
})
export class SubscriptionService {
  private authService = inject(AuthService);
  private tenantService = inject(TenantService);

  private invoicesSignal = signal<SaasInvoice[]>([]);
  private loadingSignal = signal<boolean>(false);
  private companyStatusSignal = signal<any | null>(null);
  private managementSignal = signal<any | null>(null);
  private invoicesLoadedCompanyId: string | null = null;
  private companyStatusLoadedCompanyId: string | null = null;
  private managementLoadedCompanyId: string | null = null;
  private preloadPromise: Promise<void> | null = null;
  private preloadCompanyId: string | null = null;

  readonly invoices = computed(() => this.invoicesSignal());
  readonly isLoading = computed(() => this.loadingSignal());
  readonly companyStatus = computed(() => this.companyStatusSignal());
  readonly subscriptionManagement = computed(() => this.managementSignal());

  private getApiUrl(path: string) {
    const apiBaseUrl = (environment.apiBaseUrl || '').replace(/\/$/, '');
    return apiBaseUrl ? `${apiBaseUrl}${path}` : path;
  }

  private async parseApiResponse(response: Response) {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      return response.json();
    }

    const body = await response.text();
    const looksLikeHtml = body.trimStart().startsWith('<!DOCTYPE') || body.trimStart().startsWith('<html');

    if (looksLikeHtml) {
      throw new Error(
        'A rota da API retornou HTML em vez de JSON. Rode o app com "npm run vercel:dev" ou configure apiBaseUrl para o servidor das functions.'
      );
    }

    throw new Error(body || `Resposta inesperada da API (${response.status}).`);
  }

  private async buildApiHeaders(options?: { allowMissingAuth?: boolean }) {
    const currentSession = this.authService.session();
    const accessTokenFromSignal = currentSession?.access_token || null;
    const { data } = accessTokenFromSignal
      ? { data: { session: currentSession } }
      : await supabase.auth.getSession();
    const accessToken = accessTokenFromSignal || data.session?.access_token || null;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };

    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      return headers;
    }

    if (options?.allowMissingAuth) {
      return headers;
    }

    throw new Error('Sessao invalida ou expirada. Faca login novamente.');
  }

  private isMissingAuthError(error: unknown) {
    return String((error as any)?.message || '').includes('Sessao invalida ou expirada');
  }

  private normalizeStatus(status: string | null | undefined) {
    switch (status) {
      case 'TRIAL':
      case 'trial':
      case 'trialing':
        return 'trial';
      case 'ativo':
        return 'active';
      case 'inativo':
        return 'inactive';
      case 'vencido':
        return 'past_due';
      case 'cancelado':
        return 'canceled';
      default:
        return status;
    }
  }

  private deriveEffectiveStatus(
    status: string | null | undefined,
    subscriptionExpiresAt: string | null | undefined,
    paymentStatus?: string | null | undefined,
    nextDueDate?: string | null | undefined
  ) {
    const normalizedStatus = this.normalizeStatus(status);
    const normalizedPaymentStatus = String(paymentStatus || '').toLowerCase();

    const effectiveExpiryCandidate = subscriptionExpiresAt || nextDueDate || null;

    if (normalizedPaymentStatus === 'paid') {
      if (!effectiveExpiryCandidate) {
        return 'active';
      }

      const effectiveExpiry = new Date(effectiveExpiryCandidate);
      const now = new Date();

      if (!Number.isNaN(effectiveExpiry.getTime()) && effectiveExpiry.getTime() > now.getTime()) {
        return 'active';
      }
    }

    if (normalizedStatus !== 'active' && normalizedStatus !== 'trial') {
      return normalizedStatus;
    }

    if (!effectiveExpiryCandidate) {
      return normalizedStatus;
    }

    const expiresAt = new Date(effectiveExpiryCandidate);
    const now = new Date();

    if (Number.isNaN(expiresAt.getTime())) {
      return normalizedStatus;
    }

    return expiresAt.getTime() <= now.getTime() ? 'past_due' : normalizedStatus;
  }

  private resetManagementCache() {
    this.managementSignal.set(null);
    this.managementLoadedCompanyId = null;
  }

  async getCompanyStatus(options?: { force?: boolean }) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) return null;
    const force = options?.force ?? false;

    if (!force && this.companyStatusLoadedCompanyId === companyId && this.companyStatusSignal()) {
      return this.companyStatusSignal();
    }

    const response = await supabase
      .from('companies')
      .select(`
        name,
        billing_email,
        billing_postal_code,
        tax_id,
        subscription_status,
        subscription_plan,
        subscription_expires_at,
        payment_provider,
        payment_method,
        payment_status,
        stripe_customer_id,
        stripe_subscription_id,
        asaas_customer_id,
        asaas_payment_id,
        asaas_subscription_id,
        pix_automatic_authorization_id,
        paid_at,
        next_due_date,
        external_checkout_url
      `)
      .eq('id', companyId)
      .single();

    if (response.error) {
      console.error('Erro ao buscar status de pagamento da empresa:', response.error);
      return null;
    }

    const data = response.data;
    const derivedStatus = this.deriveEffectiveStatus(
      data.subscription_status,
      data.subscription_expires_at,
      data.payment_status,
      data.next_due_date
    );

    const resolvedStatus = {
      ...data,
      subscription_status: derivedStatus
    };

    this.companyStatusSignal.set(resolvedStatus);
    this.companyStatusLoadedCompanyId = companyId;
    return resolvedStatus;
  }

  async loadInvoices(options?: { force?: boolean; limit?: number }) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) return [];

    const force = options?.force ?? false;
    const limit = options?.limit ?? 10;

    if (!force && this.invoicesLoadedCompanyId === companyId && this.invoicesSignal().length > 0) {
      return this.invoicesSignal();
    }

    this.loadingSignal.set(true);

    try {
      const { data, error } = await supabase
        .from('saas_invoices')
        .select(`
          id,
          company_id,
          stripe_payment_id,
          stripe_subscription_id,
          asaas_payment_id,
          asaas_subscription_id,
          payment_provider,
          payment_method,
          value,
          status,
          due_date,
          payment_url,
          external_checkout_url,
          pix_encoded,
          paid_at,
          created_at,
          updated_at
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      this.invoicesSignal.set((data || []) as SaasInvoice[]);
      this.invoicesLoadedCompanyId = companyId;
      return (data || []) as SaasInvoice[];
    } catch (error) {
      console.error('Erro ao carregar faturas:', error);
      return [];
    } finally {
      this.loadingSignal.set(false);
    }
  }

  async createEmbeddedSubscriptionSession(payload: {
    companyName: string;
    email?: string;
    taxId: string;
    postalCode?: string;
    plan?: string;
  }) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponivel. Efetue login na sua agencia.');

    const response = await fetch(this.getApiUrl('/api/stripe/create-embedded-subscription-session'), {
      method: 'POST',
      headers: await this.buildApiHeaders(),
      body: JSON.stringify({
        companyId,
        companyName: payload.companyName,
        email: payload.email,
        taxId: payload.taxId,
        postalCode: payload.postalCode,
        plan: payload.plan
      })
    });

    const result = await this.parseApiResponse(response);
    if (!response.ok) {
      const error = new Error(result.details || result.error || 'Erro ao criar checkout embutido.') as Error & {
        status?: number;
        code?: string;
      };
      error.status = response.status;
      error.code = response.status === 409 ? 'SUBSCRIPTION_ALREADY_EXISTS' : undefined;
      throw error;
    }

    return result;
  }

  async createPaymentElementSession(payload: {
    companyName: string;
    email?: string;
    taxId: string;
    postalCode?: string;
    plan?: string;
  }) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponivel. Efetue login na sua agencia.');

    const response = await fetch(this.getApiUrl('/api/stripe/create-payment-element-session'), {
      method: 'POST',
      headers: await this.buildApiHeaders(),
      body: JSON.stringify({
        companyId,
        companyName: payload.companyName,
        email: payload.email,
        taxId: payload.taxId,
        postalCode: payload.postalCode,
        plan: payload.plan
      })
    });

    const result = await this.parseApiResponse(response);
    if (!response.ok) {
      const error = new Error(result.details || result.error || 'Erro ao preparar checkout personalizado.') as Error & {
        status?: number;
        code?: string;
      };
      error.status = response.status;
      error.code = response.status === 409 ? 'SUBSCRIPTION_ALREADY_EXISTS' : undefined;
      throw error;
    }

    return result;
  }

  async createStripeSubscription(payload: {
    companyName: string;
    email?: string;
    taxId: string;
    setupIntentId: string;
  }) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponivel. Efetue login na sua agencia.');

    const response = await fetch(this.getApiUrl('/api/stripe/create-subscription'), {
      method: 'POST',
      headers: await this.buildApiHeaders(),
      body: JSON.stringify({
        companyId,
        companyName: payload.companyName,
        email: payload.email,
        taxId: payload.taxId,
        setupIntentId: payload.setupIntentId
      })
    });

    const result = await this.parseApiResponse(response);
    if (!response.ok) {
      const error = new Error(result.details || result.error || 'Erro ao criar assinatura na Stripe.') as Error & {
        status?: number;
        code?: string;
      };
      error.status = response.status;
      error.code = response.status === 409 ? 'SUBSCRIPTION_ALREADY_EXISTS' : undefined;
      throw error;
    }

    return result;
  }

  async createPixPayment(payload: {
    companyName: string;
    email?: string;
    cpfCnpj: string;
    postalCode?: string;
    value?: number;
    plan?: string;
  }) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponivel. Efetue login na sua agencia.');

    const response = await fetch(this.getApiUrl('/api/asaas/create-pix-payment'), {
      method: 'POST',
      headers: await this.buildApiHeaders(),
      body: JSON.stringify({
        companyId,
        companyName: payload.companyName,
        email: payload.email,
        cpfCnpj: payload.cpfCnpj,
        postalCode: payload.postalCode,
        value: payload.value,
        plan: payload.plan
      })
    });

    const result = await this.parseApiResponse(response);
    if (!response.ok) {
      throw new Error(result.error || result.details || 'Erro ao gerar cobranca Pix.');
    }

    return result;
  }

  async createDebitCheckout(payload: {
    companyName: string;
    email?: string;
    cpfCnpj: string;
    postalCode?: string;
    value?: number;
    plan?: string;
  }) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponivel. Efetue login na sua agencia.');

    const response = await fetch(this.getApiUrl('/api/asaas/create-debit-checkout'), {
      method: 'POST',
      headers: await this.buildApiHeaders(),
      body: JSON.stringify({
        companyId,
        companyName: payload.companyName,
        email: payload.email,
        cpfCnpj: payload.cpfCnpj,
        postalCode: payload.postalCode,
        value: payload.value,
        plan: payload.plan
      })
    });

    const result = await this.parseApiResponse(response);
    if (!response.ok) {
      throw new Error(result.details || result.error || 'Erro ao preparar checkout de debito.');
    }

    return result;
  }

  async getAsaasPaymentStatus(payload: {
    asaasPaymentId: string;
    paymentMethod?: CheckoutPaymentMethod;
  }) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponivel. Efetue login na sua agencia.');

    const response = await fetch(this.getApiUrl('/api/asaas/payment-status'), {
      method: 'POST',
      headers: await this.buildApiHeaders(),
      body: JSON.stringify({
        companyId,
        asaasPaymentId: payload.asaasPaymentId,
        paymentMethod: payload.paymentMethod
      })
    });

    const result = await this.parseApiResponse(response);
    if (!response.ok) {
      throw new Error(result.details || result.error || 'Erro ao consultar o status do Asaas.');
    }

    return result;
  }

  async cancelAsaasPayment(payload: {
    asaasPaymentId: string;
  }) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponivel. Efetue login na sua agencia.');

    const response = await fetch(this.getApiUrl('/api/asaas/cancel-payment'), {
      method: 'POST',
      headers: await this.buildApiHeaders(),
      body: JSON.stringify({
        companyId,
        asaasPaymentId: payload.asaasPaymentId
      })
    });

    const result = await this.parseApiResponse(response);
    if (!response.ok) {
      throw new Error(result.details || result.error || 'Erro ao cancelar o pagamento Pix.');
    }

    return result;
  }

  async syncCompanySubscription(sessionId?: string) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponivel. Efetue login na sua agencia.');

    const response = await fetch(this.getApiUrl('/api/stripe/sync-company-subscription'), {
      method: 'POST',
      headers: await this.buildApiHeaders(),
      body: JSON.stringify({ companyId, sessionId })
    });

    const result = await this.parseApiResponse(response);
    if (!response.ok) {
      throw new Error(result.details || result.error || 'Erro ao sincronizar a assinatura.');
    }

    return result;
  }

  async openCustomerPortal() {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponivel. Efetue login na sua agencia.');

    const response = await fetch(this.getApiUrl('/api/stripe/create-portal-session'), {
      method: 'POST',
      headers: await this.buildApiHeaders(),
      body: JSON.stringify({ companyId })
    });

    const result = await this.parseApiResponse(response);
    if (!response.ok) {
      throw new Error(result.error || 'Erro ao abrir o portal da assinatura.');
    }

    return result;
  }

  async getSubscriptionManagement(options?: { force?: boolean }) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponivel. Efetue login na sua agencia.');
    const force = options?.force ?? false;

    if (!force && this.managementLoadedCompanyId === companyId) {
      return this.managementSignal();
    }

    try {
      const response = await fetch(this.getApiUrl('/api/stripe/get-subscription-management'), {
        method: 'POST',
        headers: await this.buildApiHeaders(),
        body: JSON.stringify({ companyId })
      });

      const result = await this.parseApiResponse(response);
      if (!response.ok) {
        throw new Error(result.details || result.error || 'Erro ao carregar gerenciamento da assinatura.');
      }

      const subscription = result.subscription || null;
      this.managementSignal.set(subscription);
      this.managementLoadedCompanyId = companyId;
      return subscription;
    } catch (error) {
      if (this.isMissingAuthError(error)) {
        this.resetManagementCache();
      }
      throw error;
    }
  }

  async cancelSubscriptionAtPeriodEnd() {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponivel. Efetue login na sua agencia.');

    const response = await fetch(this.getApiUrl('/api/stripe/cancel-subscription'), {
      method: 'POST',
      headers: await this.buildApiHeaders(),
      body: JSON.stringify({ companyId })
    });

    const result = await this.parseApiResponse(response);
    if (!response.ok) {
      throw new Error(result.details || result.error || 'Erro ao cancelar assinatura.');
    }

    return result;
  }

  async reactivateSubscription() {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) throw new Error('Company ID indisponivel. Efetue login na sua agencia.');

    const response = await fetch(this.getApiUrl('/api/stripe/reactivate-subscription'), {
      method: 'POST',
      headers: await this.buildApiHeaders(),
      body: JSON.stringify({ companyId })
    });

    const result = await this.parseApiResponse(response);
    if (!response.ok) {
      throw new Error(result.details || result.error || 'Erro ao reativar assinatura.');
    }

    return result;
  }

  async preloadSubscriptionData(options?: { force?: boolean }) {
    const companyId = this.tenantService.getCurrentCompanyId();
    if (!companyId) return;

    const force = options?.force ?? false;

    if (!force && this.preloadPromise && this.preloadCompanyId === companyId) {
      return this.preloadPromise;
    }

    this.preloadCompanyId = companyId;
    this.preloadPromise = (async () => {
      const [statusResult, invoicesResult, managementResult] = await Promise.allSettled([
        this.getCompanyStatus({ force }),
        this.loadInvoices({ force, limit: 8 }),
        this.getSubscriptionManagement({ force })
      ]);

      if (managementResult.status === 'rejected') {
        console.warn('Aviso ao carregar gerenciamento da assinatura:', managementResult.reason);
      }

      if (statusResult.status === 'rejected') {
        throw statusResult.reason;
      }

      if (invoicesResult.status === 'rejected') {
        throw invoicesResult.reason;
      }
    })();

    try {
      await this.preloadPromise;
    } finally {
      this.preloadPromise = null;
    }
  }
}
