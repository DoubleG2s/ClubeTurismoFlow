const {
  addCors,
  addDaysToIso,
  createSupabaseAdmin,
  getCompanyByAsaasPaymentId,
  getCompanyById,
  normalizePostalCode,
  normalizeTaxId,
  resolveAuthorizedCompanyContext,
  toDateOnly,
  tryRecordWebhookEvent,
  updateCompanySubscription,
  upsertInvoiceRecord
} = require('../stripe/_lib');

function getAsaasBaseUrl() {
  const rawBaseUrl = process.env.ASAAS_BASE_URL || 'https://sandbox.asaas.com/api';
  return rawBaseUrl.replace(/\/$/, '');
}

function getAsaasHeaders(extraHeaders = {}) {
  const apiKey = process.env.ASAAS_API_KEY;

  if (!apiKey) {
    throw new Error('Falta a variavel ASAAS_API_KEY.');
  }

  return {
    accept: 'application/json',
    'content-type': 'application/json',
    access_token: apiKey,
    ...extraHeaders
  };
}

async function asaasRequest(path, options = {}) {
  const response = await fetch(`${getAsaasBaseUrl()}${path}`, {
    method: options.method || 'GET',
    headers: getAsaasHeaders(options.headers),
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      data?.errors?.[0]?.description ||
      data?.message ||
      `Erro na API do Asaas (${response.status}).`
    );
  }

  return data;
}

async function ensureAsaasCustomerForCompany(company, overrides = {}) {
  const companyName = overrides.companyName || company.name || 'Empresa';
  const email = overrides.email || company.billing_email || null;
  const cpfCnpj = normalizeTaxId(overrides.cpfCnpj || company.tax_id);
  const postalCode = normalizePostalCode(overrides.postalCode || company.billing_postal_code);

  if (company.asaas_customer_id) {
    try {
      const existing = await asaasRequest(`/v3/customers/${company.asaas_customer_id}`);
      if (existing?.id) {
        return existing;
      }
    } catch {
      // Se o ID salvo nao existir no Asaas, criamos outro cliente logo abaixo.
    }
  }

  return asaasRequest('/v3/customers', {
    method: 'POST',
    body: {
      name: companyName,
      email: email || undefined,
      cpfCnpj: cpfCnpj || undefined,
      postalCode: postalCode || undefined,
      externalReference: company.id,
      notificationDisabled: false
    }
  });
}

function mapAsaasBillingTypeToPaymentMethod(billingType, fallbackMethod = null) {
  if (fallbackMethod) {
    return fallbackMethod;
  }

  switch (String(billingType || '').toUpperCase()) {
    case 'PIX':
      return 'pix';
    case 'CREDIT_CARD':
    case 'UNDEFINED':
      return 'debit_card';
    default:
      return 'other';
  }
}

function mapAsaasStatusToInvoiceStatus(status) {
  switch (String(status || '').toUpperCase()) {
    case 'RECEIVED':
    case 'CONFIRMED':
    case 'RECEIVED_IN_CASH':
      return 'RECEIVED';
    case 'PENDING':
    case 'AWAITING_RISK_ANALYSIS':
      return 'PENDING';
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
    case 'CHARGEBACK_DISPUTE':
    case 'CHARGEBACK_REQUESTED':
    case 'CHARGEBACK_RECEIVED':
    case 'CANCELED':
      return 'CANCELED';
    default:
      return 'OVERDUE';
  }
}

function mapAsaasStatusToPaymentStatus(status) {
  switch (String(status || '').toUpperCase()) {
    case 'RECEIVED':
    case 'CONFIRMED':
    case 'RECEIVED_IN_CASH':
      return 'paid';
    case 'PENDING':
    case 'AWAITING_RISK_ANALYSIS':
      return 'pending';
    case 'CANCELED':
    case 'REFUNDED':
    case 'REFUND_REQUESTED':
      return 'canceled';
    default:
      return 'failed';
  }
}

function isAsaasPaidStatus(status) {
  return ['RECEIVED', 'CONFIRMED', 'RECEIVED_IN_CASH'].includes(String(status || '').toUpperCase());
}

function isAsaasTerminalStatus(status) {
  return ['OVERDUE', 'CANCELED', 'REFUNDED', 'REFUND_REQUESTED'].includes(String(status || '').toUpperCase());
}

async function updateCompanyFromAsaasPayment(supabase, company, payment, options = {}) {
  const nowIso = new Date().toISOString();
  const paymentStatus = mapAsaasStatusToPaymentStatus(payment.status);
  const paymentMethod = mapAsaasBillingTypeToPaymentMethod(payment.billingType, options.paymentMethod);
  const dueDate = payment.dueDate ? new Date(`${payment.dueDate}T12:00:00.000Z`).toISOString() : null;
  const paidAt =
    payment.clientPaymentDate || payment.paymentDate
      ? new Date(`${payment.clientPaymentDate || payment.paymentDate}T12:00:00.000Z`).toISOString()
      : null;
  const nextDueDate = isAsaasPaidStatus(payment.status) ? addDaysToIso(paidAt || nowIso, 30) : dueDate;

  await updateCompanySubscription(supabase, company.id, {
    asaas_customer_id: payment.customer || company.asaas_customer_id || null,
    asaas_payment_id: payment.id,
    asaas_subscription_id: payment.subscription || company.asaas_subscription_id || null,
    subscription_status: isAsaasPaidStatus(payment.status)
      ? 'active'
      : isAsaasTerminalStatus(payment.status)
        ? 'past_due'
        : company.subscription_status === 'active'
          ? 'active'
          : 'inactive',
    subscription_plan: options.plan || company.subscription_plan || 'monthly',
    subscription_expires_at: isAsaasPaidStatus(payment.status) ? addDaysToIso(paidAt || nowIso, 30) : company.subscription_expires_at,
    payment_provider: 'asaas',
    payment_method: paymentMethod,
    payment_status: paymentStatus,
    paid_at: isAsaasPaidStatus(payment.status) ? (paidAt || nowIso) : company.paid_at,
    next_due_date: nextDueDate,
    external_checkout_url: payment.invoiceUrl || company.external_checkout_url || null,
    billing_email: options.email || company.billing_email || null,
    billing_postal_code: options.postalCode || company.billing_postal_code || null,
    tax_id: options.cpfCnpj || company.tax_id || null
  });
}

async function upsertAsaasInvoiceRecord(supabase, companyId, payment, options = {}) {
  await upsertInvoiceRecord(supabase, companyId, {
    asaas_payment_id: payment.id,
    asaas_subscription_id: payment.subscription || null,
    payment_provider: 'asaas',
    payment_method: mapAsaasBillingTypeToPaymentMethod(payment.billingType, options.paymentMethod),
    value: Number(payment.value || 0),
    status: mapAsaasStatusToInvoiceStatus(payment.status),
    due_date: payment.dueDate || new Date().toISOString().slice(0, 10),
    payment_url: payment.invoiceUrl || null,
    external_checkout_url: payment.invoiceUrl || null,
    pix_encoded: options.pixCopyPaste || null,
    paid_at:
      payment.clientPaymentDate || payment.paymentDate
        ? new Date(`${payment.clientPaymentDate || payment.paymentDate}T12:00:00.000Z`).toISOString()
        : null
  });
}

async function fetchPixQrCode(paymentId) {
  const pixData = await asaasRequest(`/v3/payments/${paymentId}/pixQrCode`);

  return {
    encodedImage: pixData.encodedImage || null,
    payload: pixData.payload || pixData.pixCopyAndPaste || null,
    expirationDate: pixData.expirationDate || null
  };
}

function validateAsaasWebhookToken(req) {
  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;

  if (!expectedToken) {
    return true;
  }

  const headerToken =
    req.headers['asaas-access-token'] ||
    req.headers['authorization'] ||
    req.body?.token ||
    req.body?.webhookToken ||
    null;

  if (!headerToken) {
    return false;
  }

  return String(headerToken).replace(/^Bearer\s+/i, '') === expectedToken;
}

module.exports = {
  addCors,
  asaasRequest,
  createSupabaseAdmin,
  ensureAsaasCustomerForCompany,
  fetchPixQrCode,
  getCompanyByAsaasPaymentId,
  getCompanyById,
  isAsaasPaidStatus,
  mapAsaasBillingTypeToPaymentMethod,
  mapAsaasStatusToPaymentStatus,
  normalizePostalCode,
  normalizeTaxId,
  resolveAuthorizedCompanyContext,
  toDateOnly,
  tryRecordWebhookEvent,
  updateCompanyFromAsaasPayment,
  updateCompanySubscription,
  upsertAsaasInvoiceRecord,
  validateAsaasWebhookToken
};

