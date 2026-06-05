import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, OnDestroy, ViewChild, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { StripeElements, StripePaymentElement, loadStripe, Stripe } from '@stripe/stripe-js';
import { environment } from '../../../environments/environment';
import { CheckoutPaymentMethod, SubscriptionService } from '../../services/subscription.service';
import { PaymentStatusCardComponent } from './components/payment-status-card.component';

type PixCheckoutState = {
  asaasPaymentId: string;
  qrCodeDataUrl: string;
  pixCopyPaste: string;
  amount: number;
  dueDate: string | null;
  invoiceUrl: string | null;
  status: string;
};

type DebitCheckoutState = {
  asaasPaymentId: string;
  amount: number;
  dueDate: string | null;
  invoiceUrl: string | null;
  status: string;
};

@Component({
  selector: 'app-subscription',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    PaymentStatusCardComponent
  ],
  templateUrl: './subscription.html',
  styleUrls: ['./subscription.css']
})
export class SubscriptionComponent implements AfterViewInit, OnDestroy {
  @ViewChild('paymentElementHost') paymentElementHost?: ElementRef<HTMLDivElement>;

  private subscriptionService = inject(SubscriptionService);
  private stripeInstance: Stripe | null = null;
  private stripeElements: StripeElements | null = null;
  private paymentElement: StripePaymentElement | null = null;
  private paymentPollingInterval: ReturnType<typeof setInterval> | null = null;
  private pixCopyFeedbackTimeout: ReturnType<typeof setTimeout> | null = null;
  private successMessageTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly successFlashStorageKey = 'clube-turismo-flow:subscription-success-flash';

  companyStatus = signal<any>(null);
  subscriptionManagement = this.subscriptionService.subscriptionManagement;
  invoices = this.subscriptionService.invoices;
  visibleInvoices = computed(() =>
    this.invoices().filter((invoice) => Number(invoice.value || 0) > 0)
  );

  isLoading = signal(false);
  isInitializing = signal(true);
  errorMessage = signal('');
  successMessage = signal('');
  infoMessage = signal('');
  showPaymentConfirmedPopup = signal(false);
  selectedMethod = signal<CheckoutPaymentMethod>('credit_card');

  isPreparingStripe = signal(false);
  isSubmittingStripe = signal(false);
  stripeReady = signal(false);
  stripeSetupIntentId = signal('');

  isPreparingPix = signal(false);
  pixPayment = signal<PixCheckoutState | null>(null);
  pixCopySuccess = signal(false);

  isPreparingDebit = signal(false);
  debitCheckout = signal<DebitCheckoutState | null>(null);

  isManagingSubscription = signal(false);
  showInvoiceHistory = signal(true);
  showPaymentEditor = signal(false);
  currentStep = signal<1 | 2 | 3>(1);

  fieldErrors = signal<Record<string, string>>({});

  companyName = '';
  taxId = '';
  postalCode = '';
  email = '';
  phone = '';

  readonly monthlyPrice = environment.monthlyPrice || 370;

  constructor() {
    effect(() => {
      const message = this.successMessage();
      this.clearSuccessMessageTimeout();

      if (!message) {
        return;
      }

      this.successMessageTimeout = setTimeout(() => {
        this.successMessage.set('');
        this.successMessageTimeout = null;
      }, 5000);
    });

    void this.initializePage();
  }

  ngAfterViewInit() {
    void this.tryMountPaymentElement();
  }

  ngOnDestroy() {
    this.destroyStripePaymentElement();
    this.clearPaymentPolling();
    this.clearPixCopyFeedbackTimeout();
    this.clearSuccessMessageTimeout();
  }

  dismissEmbeddedCheckoutForNavigation() {
    this.destroyStripePaymentElement();
  }

  private async initializePage() {
    this.isInitializing.set(true);

    try {
      this.restoreSuccessFlash();
      await this.subscriptionService.preloadSubscriptionData();
      await this.loadStatus();
      await this.loadManagementData();
    } finally {
      this.isInitializing.set(false);
    }
  }

  async loadStatus(force = false) {
    const status = await this.subscriptionService.getCompanyStatus({ force });

    if (!status) {
      return;
    }

    this.companyStatus.set(status);
    this.companyName = status.name || this.companyName;
    this.email = status.billing_email || this.email;
    this.postalCode = status.billing_postal_code || this.postalCode;
    this.taxId = status.tax_id ? this.applyCpfCnpjMask(status.tax_id) : this.taxId;
    this.validateForm();
  }

  async loadManagementData(force = false) {
    try {
      await Promise.all([
        this.subscriptionService.loadInvoices({ force, limit: 8 }),
        this.subscriptionService.getSubscriptionManagement({ force })
      ]);
    } catch {
      // Assinaturas Asaas ou empresas sem assinatura Stripe podem nao ter gerenciamento para carregar.
    }
  }

  selectPaymentMethod(method: CheckoutPaymentMethod) {
    this.selectedMethod.set(method);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.infoMessage.set('');

    if (method !== 'credit_card') {
      this.destroyStripePaymentElement();
    }
  }

  openPaymentEditor() {
    this.showPaymentEditor.set(true);
    this.currentStep.set(1);
    this.errorMessage.set('');
    this.infoMessage.set('');
  }

  closePaymentEditor() {
    this.showPaymentEditor.set(false);
    this.currentStep.set(1);
    this.destroyStripePaymentElement();
    this.pixPayment.set(null);
    this.pixCopySuccess.set(false);
    this.clearPixCopyFeedbackTimeout();
    this.clearPaymentPolling();
  }

  preparePaymentFlow() {
    this.validateForm();

    if (!this.isFormValid()) {
      this.errorMessage.set('Preencha nome, e-mail e CPF ou CNPJ antes de pagar.');
      return;
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.infoMessage.set('');
  }

  validateForm(): boolean {
    const errors: Record<string, string> = {};

    if (!this.companyName || this.companyName.trim().length < 3) {
      errors['companyName'] = 'Informe o nome da empresa.';
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!this.email || !emailRegex.test(this.email)) {
      errors['email'] = 'Informe um e-mail valido.';
    }

    const taxNumeric = this.taxId.replace(/\D/g, '');
    if (taxNumeric.length !== 11 && taxNumeric.length !== 14) {
      errors['taxId'] = 'Informe um CPF ou CNPJ valido.';
    }

    this.fieldErrors.set(errors);
    return Object.keys(errors).length === 0;
  }

  isFormValid() {
    return !!this.companyName && !!this.email && !!this.taxId && Object.keys(this.fieldErrors()).length === 0;
  }

  formatName(value: string) {
    this.companyName = value.toUpperCase();
    this.validateForm();
  }

  formatEmail(value: string) {
    this.email = value.toLowerCase().trim();
    this.validateForm();
  }

  formatTaxId(value: string) {
    this.taxId = this.applyCpfCnpjMask(value);
    this.validateForm();
  }

  formatPostalCode(value: string) {
    const numeric = value.replace(/\D/g, '').substring(0, 8);
    this.postalCode =
      numeric.length >= 6
        ? `${numeric.substring(0, 5)}-${numeric.substring(5, 8)}`
        : numeric;
  }

  formatPhone(value: string) {
    const numeric = value.replace(/\D/g, '').substring(0, 11);

    if (numeric.length <= 2) {
      this.phone = numeric;
      return;
    }

    if (numeric.length <= 7) {
      this.phone = `(${numeric.substring(0, 2)}) ${numeric.substring(2)}`;
      return;
    }

    if (numeric.length <= 10) {
      this.phone = `(${numeric.substring(0, 2)}) ${numeric.substring(2, 6)}-${numeric.substring(6)}`;
      return;
    }

    this.phone = `(${numeric.substring(0, 2)}) ${numeric.substring(2, 7)}-${numeric.substring(7)}`;
  }

  async submitPaymentFlow() {
    this.preparePaymentFlow();

    if (!this.isFormValid()) {
      return;
    }

    await this.startSelectedPaymentMethod();
  }

  private async getOrCreateStripeInstance() {
    if (this.stripeInstance) {
      return this.stripeInstance;
    }

    const publishableKey = environment.stripePublishableKey;
    if (!publishableKey) {
      throw new Error('Falta a STRIPE_PUBLISHABLE_KEY para carregar o checkout da Stripe.');
    }

    const stripe = await loadStripe(publishableKey);
    if (!stripe) {
      throw new Error('Nao foi possivel carregar o Stripe.js.');
    }

    this.stripeInstance = stripe;
    return stripe;
  }

  private async startStripePaymentElementCheckout() {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.infoMessage.set('');
    this.pixPayment.set(null);
    this.debitCheckout.set(null);
    this.clearPaymentPolling();
    this.isPreparingStripe.set(true);
    this.isSubmittingStripe.set(false);
    this.stripeSetupIntentId.set('');

    try {
      const result = await this.subscriptionService.createPaymentElementSession({
        companyName: this.companyName,
        email: this.email,
        taxId: this.taxId.replace(/\D/g, ''),
        postalCode: this.postalCode,
        plan: 'monthly'
      });

      if (!result.clientSecret || !result.setupIntentId) {
        throw new Error('A Stripe nao retornou os dados para carregar o checkout personalizado.');
      }

      await this.mountStripePaymentElement(result.clientSecret);
      this.stripeSetupIntentId.set(result.setupIntentId);
      this.infoMessage.set('Formulario de cartao carregado. Confirme o pagamento para ativar a assinatura.');
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Falha ao iniciar o checkout personalizado da Stripe.');
    } finally {
      this.isPreparingStripe.set(false);
    }
  }

  private async mountStripePaymentElement(clientSecret: string) {
    this.destroyStripePaymentElement();
    const stripe = await this.getOrCreateStripeInstance();
    this.stripeElements = stripe.elements({
      clientSecret,
      locale: 'pt-BR',
      appearance: {
        theme: 'stripe',
        variables: {
          colorPrimary: '#ff8a00',
          colorBackground: '#ffffff',
          colorText: '#0f172a',
          colorDanger: '#dc2626',
          colorTextSecondary: '#64748b',
          colorSuccess: '#16a34a',
          borderRadius: '18px',
          spacingUnit: '6px'
        },
        rules: {
          '.Block': {
            backgroundColor: '#ffffff',
            border: '1px solid rgba(15, 23, 42, 0.08)',
            boxShadow: '0 8px 24px rgba(15, 23, 42, 0.06)'
          },
          '.Input': {
            backgroundColor: '#ffffff',
            border: '1px solid rgba(15, 23, 42, 0.08)',
            boxShadow: 'none'
          },
          '.Label': {
            color: '#334155'
          }
        }
      }
    });
    this.paymentElement = this.stripeElements.create('payment');

    this.stripeReady.set(true);
    await this.tryMountPaymentElement();
  }

  private destroyStripePaymentElement() {
    try {
      this.paymentElement?.unmount();
      this.paymentElement?.destroy();
    } catch {
      // Elemento pode ja ter sido desmontado.
    }

    this.paymentElement = null;
    this.stripeElements = null;
    this.stripeReady.set(false);
    this.isSubmittingStripe.set(false);
  }

  private async tryMountPaymentElement() {
    if (!this.paymentElement || !this.stripeReady()) {
      return;
    }

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const host = this.paymentElementHost?.nativeElement;
      if (host) {
        host.innerHTML = '';
        this.paymentElement.mount(host);
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  private async startPixCheckout() {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.infoMessage.set('');
    this.destroyStripePaymentElement();
    this.debitCheckout.set(null);
    this.clearPaymentPolling();
    this.pixCopySuccess.set(false);
    this.clearPixCopyFeedbackTimeout();
    this.isPreparingPix.set(true);

    try {
      const result = await this.subscriptionService.createPixPayment({
        companyName: this.companyName,
        email: this.email,
        cpfCnpj: this.taxId.replace(/\D/g, ''),
        postalCode: this.postalCode,
        value: this.monthlyPrice,
        plan: 'monthly'
      });

      const qrCodeDataUrl = result.pixQrCode
        ? `data:image/png;base64,${result.pixQrCode}`
        : '';

      this.pixPayment.set({
        asaasPaymentId: result.asaasPaymentId,
        qrCodeDataUrl,
        pixCopyPaste: result.pixCopyPaste || '',
        amount: Number(result.value || this.monthlyPrice),
        dueDate: result.dueDate || null,
        invoiceUrl: result.invoiceUrl || null,
        status: result.status || 'PENDING'
      });

      this.infoMessage.set('Pix gerado com sucesso. Agora e so escanear o QR Code ou copiar o codigo abaixo.');
      this.startPaymentPolling('pix', result.asaasPaymentId);
      await this.loadStatus(true);
      await this.loadManagementData(true);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Falha ao gerar a cobranca Pix.');
    } finally {
      this.isPreparingPix.set(false);
    }
  }

  private async startDebitCheckout() {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.infoMessage.set('');
    this.destroyStripePaymentElement();
    this.pixPayment.set(null);
    this.pixCopySuccess.set(false);
    this.clearPixCopyFeedbackTimeout();
    this.clearPaymentPolling();
    this.isPreparingDebit.set(true);

    try {
      const result = await this.subscriptionService.createDebitCheckout({
        companyName: this.companyName,
        email: this.email,
        cpfCnpj: this.taxId.replace(/\D/g, ''),
        postalCode: this.postalCode,
        value: this.monthlyPrice,
        plan: 'monthly'
      });

      this.debitCheckout.set({
        asaasPaymentId: result.asaasPaymentId,
        amount: Number(result.value || this.monthlyPrice),
        dueDate: result.dueDate || null,
        invoiceUrl: result.invoiceUrl || result.checkoutUrl || null,
        status: result.status || 'PENDING'
      });

      this.infoMessage.set('Pagamento por debito preparado. O usuario so sai da pagina se clicar para continuar.');
      this.startPaymentPolling('debit_card', result.asaasPaymentId);
      await this.loadStatus(true);
      await this.loadManagementData(true);
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Falha ao preparar o checkout de debito.');
    } finally {
      this.isPreparingDebit.set(false);
    }
  }

  private startPaymentPolling(method: CheckoutPaymentMethod, asaasPaymentId: string) {
    this.clearPaymentPolling();
    this.paymentPollingInterval = setInterval(() => {
      void this.refreshAsaasPaymentStatus(method, asaasPaymentId, false);
    }, 6000);
  }

  private clearPaymentPolling() {
    if (this.paymentPollingInterval) {
      clearInterval(this.paymentPollingInterval);
      this.paymentPollingInterval = null;
    }
  }

  async refreshAsaasPaymentStatus(
    method: CheckoutPaymentMethod,
    paymentId?: string,
    showFeedback = true
  ) {
    const currentPaymentId =
      paymentId ||
      (method === 'pix' ? this.pixPayment()?.asaasPaymentId : this.debitCheckout()?.asaasPaymentId) ||
      '';

    if (!currentPaymentId) {
      return;
    }

    try {
      const result = await this.subscriptionService.getAsaasPaymentStatus({
        asaasPaymentId: currentPaymentId,
        paymentMethod: method
      });

      if (method === 'pix') {
        this.pixPayment.update((current) =>
          current
            ? {
                ...current,
                status: result.status || current.status,
                invoiceUrl: result.invoiceUrl || current.invoiceUrl,
                qrCodeDataUrl: result.pixQrCode ? `data:image/png;base64,${result.pixQrCode}` : current.qrCodeDataUrl,
                pixCopyPaste: result.pixCopyPaste || current.pixCopyPaste
              }
            : current
        );
      } else {
        this.debitCheckout.update((current) =>
          current
            ? {
                ...current,
                status: result.status || current.status,
                invoiceUrl: result.invoiceUrl || current.invoiceUrl
              }
            : current
        );
      }

      await this.loadStatus(true);
      await this.loadManagementData(true);

      if (['RECEIVED', 'CONFIRMED'].includes(String(result.status || '').toUpperCase())) {
        this.clearPaymentPolling();
        this.successMessage.set('Pagamento confirmado. O acesso da empresa ja foi atualizado.');
        if (method === 'pix') {
          this.showPaymentConfirmedPopup.set(true);
        }
      } else if (showFeedback) {
        this.infoMessage.set('Status atualizado com sucesso.');
      }
    } catch (error: any) {
      if (showFeedback) {
        this.errorMessage.set(error.message || 'Nao foi possivel consultar o status do pagamento.');
      }
    }
  }

  async copyPixCode() {
    const pixCode = this.pixPayment()?.pixCopyPaste || '';
    if (!pixCode) {
      return;
    }

    await navigator.clipboard.writeText(pixCode);
    this.pixCopySuccess.set(true);
    this.clearPixCopyFeedbackTimeout();
    this.pixCopyFeedbackTimeout = setTimeout(() => {
      this.pixCopySuccess.set(false);
      this.pixCopyFeedbackTimeout = null;
    }, 2500);
    this.successMessage.set('Codigo Pix copiado com sucesso.');
  }

  private clearPixCopyFeedbackTimeout() {
    if (this.pixCopyFeedbackTimeout) {
      clearTimeout(this.pixCopyFeedbackTimeout);
      this.pixCopyFeedbackTimeout = null;
    }
  }

  private clearSuccessMessageTimeout() {
    if (this.successMessageTimeout) {
      clearTimeout(this.successMessageTimeout);
      this.successMessageTimeout = null;
    }
  }

  dismissSuccessMessage() {
    this.clearSuccessMessageTimeout();
    this.successMessage.set('');
  }

  dismissPaymentConfirmedPopup() {
    this.showPaymentConfirmedPopup.set(false);
  }

  goBackToDashboard() {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  private persistSuccessFlash(message: string) {
    this.successMessage.set(message);

    try {
      sessionStorage.setItem(this.successFlashStorageKey, message);
    } catch {
      // Seguimos mesmo sem storage.
    }
  }

  private restoreSuccessFlash() {
    try {
      const flash = sessionStorage.getItem(this.successFlashStorageKey);
      if (!flash) {
        return;
      }

      this.successMessage.set(flash);
      sessionStorage.removeItem(this.successFlashStorageKey);
    } catch {
      // Seguimos mesmo sem storage.
    }
  }

  continueDebitInCurrentTab() {
    const invoiceUrl = this.debitCheckout()?.invoiceUrl;
    if (!invoiceUrl) {
      return;
    }

    window.location.href = invoiceUrl;
  }

  openDebitInNewTab() {
    const invoiceUrl = this.debitCheckout()?.invoiceUrl;
    if (!invoiceUrl) {
      return;
    }

    window.open(invoiceUrl, '_blank', 'noopener,noreferrer');
  }

  async openSubscriptionPortal() {
    try {
      this.isManagingSubscription.set(true);
      const result = await this.subscriptionService.openCustomerPortal();
      if (result.portalUrl) {
        window.location.href = result.portalUrl;
      }
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Nao foi possivel abrir o portal da Stripe.');
    } finally {
      this.isManagingSubscription.set(false);
    }
  }

  async cancelSubscription() {
    try {
      this.isManagingSubscription.set(true);
      await this.subscriptionService.cancelSubscriptionAtPeriodEnd();
      await this.loadStatus(true);
      await this.loadManagementData(true);
      this.successMessage.set('Cancelamento programado com sucesso para o fim do ciclo atual.');
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Nao foi possivel cancelar a assinatura.');
    } finally {
      this.isManagingSubscription.set(false);
    }
  }

  async reactivateSubscription() {
    try {
      this.isManagingSubscription.set(true);
      await this.subscriptionService.reactivateSubscription();
      await this.loadStatus(true);
      await this.loadManagementData(true);
      this.successMessage.set('Renovacao automatica reativada com sucesso.');
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Nao foi possivel reativar a assinatura.');
    } finally {
      this.isManagingSubscription.set(false);
    }
  }

  async refreshAllData() {
    try {
      this.isManagingSubscription.set(true);
      await this.loadStatus(true);
      await this.loadManagementData(true);
      this.successMessage.set('Status sincronizado com sucesso.');
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Nao foi possivel atualizar os dados.');
    } finally {
      this.isManagingSubscription.set(false);
    }
  }

  toggleInvoiceHistory() {
    this.showInvoiceHistory.update((value) => !value);
  }

  goToStep(step: 1 | 2 | 3) {
    if (step === 1) {
      this.currentStep.set(1);
      return;
    }

    this.validateForm();
    if (!this.isFormValid()) {
      this.errorMessage.set('Preencha nome, e-mail e CPF ou CNPJ antes de continuar.');
      return;
    }

    this.errorMessage.set('');
    this.currentStep.set(step);

    if (step === 3) {
      queueMicrotask(() => {
        void this.ensureStepThreePaymentReady();
      });
    }
  }

  goToNextStep() {
    if (this.currentStep() === 1) {
      this.goToStep(2);
      return;
    }

    if (this.currentStep() === 2) {
      this.goToStep(3);
    }
  }

  goToPreviousStep() {
    if (this.currentStep() === 3) {
      this.currentStep.set(2);
      return;
    }

    if (this.currentStep() === 2) {
      this.currentStep.set(1);
    }
  }

  private async ensureStepThreePaymentReady() {
    switch (this.selectedMethod()) {
      case 'credit_card':
        if (this.stripeReady() || this.isPreparingStripe()) {
          return;
        }
        break;
      case 'pix':
        if (this.pixPayment() || this.isPreparingPix()) {
          return;
        }
        break;
      case 'debit_card':
        if (this.debitCheckout() || this.isPreparingDebit()) {
          return;
        }
        break;
    }

    await this.submitPaymentFlow();
  }

  isAccessGrantedStatus(status: string | null | undefined) {
    return status === 'active' || status === 'trial';
  }

  shouldShowPaymentFlow() {
    return !this.isAccessGrantedStatus(this.companyStatus()?.subscription_status) || this.showPaymentEditor();
  }

  getActiveStatusTone() {
    return this.companyStatus()?.payment_status === 'failed' ? 'warning' : 'success';
  }

  getActiveStatusTitle() {
    if (this.companyStatus()?.payment_provider === 'stripe') {
      return 'Assinatura mensal ativa pela Stripe';
    }

    return 'Acesso ativo liberado pelo pagamento Asaas';
  }

  getActiveStatusDescription() {
    const validUntil = this.companyStatus()?.subscription_expires_at || this.companyStatus()?.next_due_date || null;
    const validUntilLabel = validUntil ? this.formatDate(validUntil) : 'a data ainda esta sendo sincronizada';

    if (this.companyStatus()?.payment_provider === 'stripe') {
      return `Seu acesso esta liberado ate ${validUntilLabel}. Se nao houver novo pagamento ou renovacao apos esse prazo, o sistema bloqueia novamente.`;
    }

    return `Seu acesso atual vai ate ${validUntilLabel}. Depois disso, sera necessario pagar novamente para continuar usando o sistema.`;
  }

  getStatusMeta() {
    const status = this.companyStatus();
    return [
      {
        label: 'Provedor',
        value: status?.payment_provider === 'stripe' ? 'Stripe' : status?.payment_provider === 'asaas' ? 'Asaas' : 'Nao definido'
      },
      {
        label: 'Metodo',
        value:
          status?.payment_method === 'credit_card'
            ? 'Cartao de credito'
            : status?.payment_method === 'pix'
              ? 'Pix'
              : status?.payment_method === 'debit_card'
                ? 'Cartao de debito'
                : 'Nao definido'
      },
      {
        label: 'Valido ate',
        value: status?.subscription_expires_at ? this.formatDate(status.subscription_expires_at) : 'Nao informado'
      },
      {
        label: 'Proximo vencimento',
        value: status?.next_due_date ? this.formatDate(status.next_due_date) : 'Nao informado'
      }
    ];
  }

  getCurrentMethodHeadline() {
    switch (this.selectedMethod()) {
      case 'credit_card':
        return 'Pagar com cartao de credito';
      case 'pix':
        return 'Pagar com Pix';
      case 'debit_card':
        return 'Pagar com cartao de debito';
    }
  }

  getCurrentMethodDescription() {
    switch (this.selectedMethod()) {
      case 'credit_card':
        return 'Use o checkout personalizado com cartao para deixar a cobranca mensal automatica direto na sua pagina.';
      case 'pix':
        return 'O sistema gera o Pix e mostra QR Code e codigo para copiar sem tirar voce da pagina.';
      case 'debit_card':
        return 'O sistema prepara o pagamento no Asaas e voce escolhe se continua na mesma aba ou em uma nova.';
    }
  }

  getCurrentMethodActionLabel() {
    switch (this.selectedMethod()) {
      case 'credit_card':
        return this.isPreparingStripe() ? 'Abrindo checkout...' : 'Abrir pagamento com cartao';
      case 'pix':
        return this.isPreparingPix() ? 'Gerando Pix...' : 'Gerar Pix agora';
      case 'debit_card':
        return this.isPreparingDebit() ? 'Preparando...' : 'Continuar com debito';
    }
  }

  isCurrentMethodBusy() {
    switch (this.selectedMethod()) {
      case 'credit_card':
        return this.isPreparingStripe() || this.isSubmittingStripe();
      case 'pix':
        return this.isPreparingPix();
      case 'debit_card':
        return this.isPreparingDebit();
    }
  }

  async startSelectedPaymentMethod() {
    switch (this.selectedMethod()) {
      case 'credit_card':
        await this.startStripePaymentElementCheckout();
        break;
      case 'pix':
        await this.startPixCheckout();
        break;
      case 'debit_card':
        await this.startDebitCheckout();
        break;
    }
  }

  async confirmStripePaymentAndCreateSubscription() {
    if (!this.stripeElements || !this.paymentElement) {
      this.errorMessage.set('Formulario de cartao ainda nao foi carregado.');
      return;
    }

    const setupIntentId = this.stripeSetupIntentId();
    if (!setupIntentId) {
      this.errorMessage.set('Nao encontramos o setupIntent da Stripe para concluir o pagamento.');
      return;
    }

    try {
      this.isSubmittingStripe.set(true);
      this.errorMessage.set('');
      this.infoMessage.set('Validando os dados do cartao...');

      const submitResult = await this.stripeElements.submit();
      if (submitResult.error) {
        throw new Error(submitResult.error.message || 'Revise os dados do cartao e tente novamente.');
      }

      const stripe = await this.getOrCreateStripeInstance();
      const confirmationResult = await stripe.confirmSetup({
        elements: this.stripeElements,
        redirect: 'if_required'
      });

      if (confirmationResult.error) {
        throw new Error(confirmationResult.error.message || 'Falha ao confirmar o cartao com a Stripe.');
      }

      if (confirmationResult.setupIntent?.status !== 'succeeded') {
        throw new Error('A Stripe ainda nao confirmou o cartao. Tente novamente em alguns segundos.');
      }

      this.infoMessage.set('Cartao confirmado. Criando assinatura mensal...');
      await this.subscriptionService.createStripeSubscription({
        companyName: this.companyName,
        email: this.email,
        taxId: this.taxId.replace(/\D/g, ''),
        setupIntentId: confirmationResult.setupIntent?.id || setupIntentId
      });

      await this.loadStatus(true);
      await this.loadManagementData(true);
      this.persistSuccessFlash('Pagamento confirmado com sucesso. A assinatura mensal da Stripe ja esta ativa.');
      this.destroyStripePaymentElement();
      this.showPaymentEditor.set(false);
      this.currentStep.set(1);
      this.infoMessage.set('');
    } catch (error: any) {
      this.errorMessage.set(error.message || 'Nao foi possivel concluir o pagamento com cartao.');
    } finally {
      this.isSubmittingStripe.set(false);
    }
  }

  getPixStatusLabel() {
    const status = this.pixPayment()?.status || 'PENDING';
    return this.mapGatewayStatus(status);
  }

  getDebitStatusLabel() {
    const status = this.debitCheckout()?.status || 'PENDING';
    return this.mapGatewayStatus(status);
  }

  private mapGatewayStatus(status: string) {
    switch (String(status || '').toUpperCase()) {
      case 'RECEIVED':
      case 'CONFIRMED':
        return 'Pago';
      case 'OVERDUE':
        return 'Vencido';
      case 'CANCELED':
        return 'Cancelado';
      default:
        return 'Aguardando pagamento';
    }
  }

  formatDate(value: string | null | undefined) {
    if (!value) {
      return 'Nao informado';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Nao informado';
    }

    return date.toLocaleDateString('pt-BR');
  }

  formatCurrency(value: number | null | undefined) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(Number(value || 0));
  }

  getInvoiceStatusLabel(status: string | null | undefined) {
    switch (status) {
      case 'RECEIVED':
        return 'Pago';
      case 'PENDING':
        return 'Pendente';
      case 'OVERDUE':
        return 'Em atraso';
      case 'CANCELED':
        return 'Cancelado';
      default:
        return status || 'Sem status';
    }
  }

  hasStripeSubscriptionManagement() {
    return Boolean(this.companyStatus()?.stripe_subscription_id);
  }

  isCreditCardPaymentStage() {
    return this.shouldShowPaymentFlow() && this.currentStep() === 3 && this.selectedMethod() === 'credit_card';
  }

  shouldUseCheckoutFocusLayout() {
    return this.isCreditCardPaymentStage();
  }

  private applyCpfCnpjMask(value: string): string {
    let numeric = value.replace(/\D/g, '').substring(0, 14);

    if (numeric.length <= 11) {
      numeric = numeric.replace(/(\d{3})(\d)/, '$1.$2');
      numeric = numeric.replace(/(\d{3})(\d)/, '$1.$2');
      numeric = numeric.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
      return numeric;
    }

    numeric = numeric.replace(/^(\d{2})(\d)/, '$1.$2');
    numeric = numeric.replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3');
    numeric = numeric.replace(/\.(\d{3})(\d)/, '.$1/$2');
    numeric = numeric.replace(/(\d{4})(\d{1,2})$/, '$1-$2');
    return numeric;
  }
}
