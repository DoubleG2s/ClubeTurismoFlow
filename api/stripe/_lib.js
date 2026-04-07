const Stripe = require('stripe');
const { createClient } = require('@supabase/supabase-js');

const STRIPE_API_VERSION = '2026-02-25.clover';
const COMPANY_SELECT =
  'id, name, slug, billing_email, billing_postal_code, tax_id, subscription_status, subscription_plan, subscription_expires_at, payment_provider, payment_method, payment_status, stripe_customer_id, stripe_subscription_id, asaas_customer_id, asaas_payment_id, asaas_subscription_id, pix_automatic_authorization_id, paid_at, next_due_date, external_checkout_url';

function createStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Falta a variavel STRIPE_SECRET_KEY.');
  }

  return new Stripe(secretKey, {
    apiVersion: STRIPE_API_VERSION
  });
}

function createSupabaseAdmin() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    throw new Error('Falta a variavel SUPABASE_URL.');
  }

  if (!supabaseKey) {
    throw new Error('Falta a variavel SUPABASE_SERVICE_ROLE_KEY.');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function createSupabaseAuthClient() {
  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error('Faltam variaveis do Supabase para validar a sessao autenticada.');
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

function addCors(res, methods = 'OPTIONS,POST') {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', methods);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, Stripe-Signature, Authorization, asaas-access-token'
  );
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;

  if (!header || !String(header).startsWith('Bearer ')) {
    return null;
  }

  return String(header).slice('Bearer '.length).trim();
}

async function resolveAuthorizedCompanyContext(req, supabaseAdmin, requestedCompanyId = null) {
  const accessToken = getBearerToken(req);

  if (!accessToken) {
    throw new Error('Sessao ausente. Envie o token Bearer do usuario autenticado.');
  }

  const supabaseAuth = createSupabaseAuthClient();
  const { data: authData, error: authError } = await supabaseAuth.auth.getUser(accessToken);

  if (authError || !authData?.user) {
    throw new Error('Sessao invalida ou expirada. Faca login novamente.');
  }

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('id, role, company_id')
    .eq('id', authData.user.id)
    .single();

  if (profileError || !profile) {
    throw new Error('Perfil do usuario nao foi encontrado para validar a empresa.');
  }

  if (profile.role === 'admin') {
    const adminCompanyId = requestedCompanyId || profile.company_id || null;

    if (!adminCompanyId) {
      throw new Error('Usuario admin precisa informar a empresa alvo para operar pagamentos.');
    }

    return {
      user: authData.user,
      profile,
      companyId: adminCompanyId
    };
  }

  if (!profile.company_id) {
    throw new Error('Usuario sem empresa vinculada nao pode operar pagamentos.');
  }

  if (requestedCompanyId && requestedCompanyId !== profile.company_id) {
    throw new Error('A empresa informada nao pertence ao usuario autenticado.');
  }

  return {
    user: authData.user,
    profile,
    companyId: profile.company_id
  };
}

function normalizeTaxId(value) {
  return String(value || '').replace(/\D/g, '');
}

function normalizePostalCode(value) {
  return String(value || '').replace(/\D/g, '').slice(0, 8);
}

function getBaseUrl(req) {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const host = forwardedHost || req.headers.host || process.env.VERCEL_URL;
  const protocol = forwardedProto || (host && host.includes('localhost') ? 'http' : 'https');

  if (!host) {
    return 'http://localhost:3000';
  }

  return `${protocol}://${host}`;
}

function addDaysToIso(dateValue, days) {
  const baseDate = dateValue ? new Date(dateValue) : new Date();

  if (Number.isNaN(baseDate.getTime())) {
    return null;
  }

  baseDate.setDate(baseDate.getDate() + days);
  return baseDate.toISOString();
}

function toIsoFromUnix(timestamp) {
  if (!timestamp) {
    return null;
  }

  return new Date(timestamp * 1000).toISOString();
}

function toDateOnly(dateValue) {
  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeCompanyRecord(record) {
  if (!record) {
    return null;
  }

  return {
    ...record,
    stripe_customer_id: record.stripe_customer_id || null,
    stripe_subscription_id: record.stripe_subscription_id || null,
    asaas_customer_id: record.asaas_customer_id || null,
    asaas_payment_id: record.asaas_payment_id || null,
    asaas_subscription_id: record.asaas_subscription_id || null,
    payment_provider: record.payment_provider || null,
    payment_method: record.payment_method || null,
    payment_status: record.payment_status || null,
    subscription_plan: record.subscription_plan || null,
    paid_at: record.paid_at || null,
    next_due_date: record.next_due_date || null,
    external_checkout_url: record.external_checkout_url || null,
    pix_automatic_authorization_id: record.pix_automatic_authorization_id || null
  };
}

async function getCompanyById(supabase, companyId) {
  const { data, error } = await supabase
    .from('companies')
    .select(COMPANY_SELECT)
    .eq('id', companyId)
    .single();

  if (error) {
    throw new Error(`Empresa nao encontrada: ${error.message}`);
  }

  return normalizeCompanyRecord(data);
}

async function getCompanyBySubscriptionId(supabase, subscriptionId) {
  const { data, error } = await supabase
    .from('companies')
    .select(COMPANY_SELECT)
    .or(`stripe_subscription_id.eq.${subscriptionId},asaas_subscription_id.eq.${subscriptionId}`)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao localizar assinatura: ${error.message}`);
  }

  return normalizeCompanyRecord(data);
}

async function getCompanyByCustomerId(supabase, customerId) {
  const { data, error } = await supabase
    .from('companies')
    .select(COMPANY_SELECT)
    .or(`stripe_customer_id.eq.${customerId},asaas_customer_id.eq.${customerId}`)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao localizar cliente: ${error.message}`);
  }

  return normalizeCompanyRecord(data);
}

async function getCompanyByAsaasPaymentId(supabase, paymentId) {
  const { data, error } = await supabase
    .from('companies')
    .select(COMPANY_SELECT)
    .eq('asaas_payment_id', paymentId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao localizar pagamento Asaas: ${error.message}`);
  }

  return normalizeCompanyRecord(data);
}

async function updateCompanySubscription(supabase, companyId, values) {
  const payload = {
    updated_at: new Date().toISOString(),
    ...values
  };

  const { error } = await supabase
    .from('companies')
    .update(payload)
    .eq('id', companyId);

  if (error) {
    throw new Error(`Erro ao atualizar pagamento da empresa: ${error.message}`);
  }
}

async function upsertInvoiceRecord(supabase, companyId, invoicePayload) {
  const payload = {
    company_id: companyId,
    stripe_payment_id: invoicePayload.stripe_payment_id || null,
    stripe_subscription_id: invoicePayload.stripe_subscription_id || null,
    asaas_payment_id: invoicePayload.asaas_payment_id || null,
    asaas_subscription_id: invoicePayload.asaas_subscription_id || null,
    payment_provider: invoicePayload.payment_provider || null,
    payment_method: invoicePayload.payment_method || null,
    value: invoicePayload.value || 0,
    status: invoicePayload.status || 'PENDING',
    due_date: invoicePayload.due_date || new Date().toISOString().slice(0, 10),
    payment_url: invoicePayload.payment_url || null,
    external_checkout_url: invoicePayload.external_checkout_url || null,
    pix_encoded: invoicePayload.pix_encoded || null,
    paid_at: invoicePayload.paid_at || null,
    updated_at: new Date().toISOString()
  };

  const lookupColumn = payload.stripe_payment_id ? 'stripe_payment_id' : payload.asaas_payment_id ? 'asaas_payment_id' : null;

  if (!lookupColumn) {
    const { error } = await supabase
      .from('saas_invoices')
      .insert(payload);

    if (error) {
      throw new Error(`Erro ao sincronizar fatura: ${error.message}`);
    }

    return;
  }

  const lookupValue = payload[lookupColumn];

  const { data: existingInvoice, error: lookupError } = await supabase
    .from('saas_invoices')
    .select('id')
    .eq(lookupColumn, lookupValue)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Erro ao localizar fatura existente: ${lookupError.message}`);
  }

  if (existingInvoice?.id) {
    const { error } = await supabase
      .from('saas_invoices')
      .update(payload)
      .eq('id', existingInvoice.id);

    if (error) {
      throw new Error(`Erro ao sincronizar fatura: ${error.message}`);
    }

    return;
  }

  const { error } = await supabase
    .from('saas_invoices')
    .insert(payload);

  if (error) {
    throw new Error(`Erro ao sincronizar fatura: ${error.message}`);
  }
}

async function ensureStripeCustomerForCompany(stripe, supabase, company, overrides = {}) {
  const companyId = company.id;
  const companyName = overrides.companyName || company.name || 'Empresa';
  const taxId = normalizeTaxId(overrides.taxId || company.tax_id);
  const email = overrides.email || company.billing_email || null;
  const postalCode = normalizePostalCode(overrides.postalCode || company.billing_postal_code);

  let customer = null;
  let customerId = company.stripe_customer_id || null;

  if (customerId) {
    try {
      customer = await stripe.customers.retrieve(customerId);
      if (customer.deleted) {
        customer = null;
        customerId = null;
      }
    } catch {
      customer = null;
      customerId = null;
    }
  }

  if (customerId && customer) {
    customer = await stripe.customers.update(customerId, {
      name: companyName,
      email: email || undefined,
      address: postalCode
        ? {
            country: 'BR',
            postal_code: postalCode
          }
        : undefined,
      metadata: {
        companyId,
        taxId
      }
    });

    return customer;
  }

  customer = await stripe.customers.create({
    name: companyName,
    email: email || undefined,
    address: postalCode
      ? {
          country: 'BR',
          postal_code: postalCode
        }
      : undefined,
    metadata: {
      companyId,
      taxId
    }
  });

  await updateCompanySubscription(supabase, companyId, {
    stripe_customer_id: customer.id,
    billing_email: email || null,
    billing_postal_code: postalCode || null,
    tax_id: taxId || null
  });

  return customer;
}

function mapStripeStatus(status) {
  switch (status) {
    case 'trialing':
      return 'trial';
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    case 'paused':
      return 'inactive';
    case 'incomplete':
    default:
      return 'inactive';
  }
}

function getLatestInvoiceStatus(subscription, fallbackInvoice = null) {
  if (fallbackInvoice?.status) {
    return fallbackInvoice.status;
  }

  const latestInvoice = subscription?.latest_invoice;

  if (!latestInvoice || typeof latestInvoice === 'string') {
    return null;
  }

  return latestInvoice.status || null;
}

function getStripePaidAt(subscription, invoice = null) {
  const latestInvoice = invoice || (typeof subscription?.latest_invoice === 'object' ? subscription.latest_invoice : null);

  if (latestInvoice?.status_transitions?.paid_at) {
    return toIsoFromUnix(latestInvoice.status_transitions.paid_at);
  }

  if (latestInvoice?.created) {
    return toIsoFromUnix(latestInvoice.created);
  }

  if (subscription?.created) {
    return toIsoFromUnix(subscription.created);
  }

  return null;
}

function getEffectiveCompanyStatusFromSubscription(subscription, invoice = null) {
  const mappedStatus = mapStripeStatus(subscription.status);
  const invoiceStatus = getLatestInvoiceStatus(subscription, invoice);

  if (mappedStatus === 'inactive' && invoiceStatus === 'paid') {
    return 'active';
  }

  return mappedStatus;
}

function getNextRenewalAt(subscription, invoice = null) {
  if (subscription?.current_period_end) {
    return toIsoFromUnix(subscription.current_period_end);
  }

  const invoiceLinePeriodEnd = invoice?.lines?.data?.[0]?.period?.end;
  if (invoiceLinePeriodEnd) {
    return toIsoFromUnix(invoiceLinePeriodEnd);
  }

  if (invoice?.period_end) {
    return toIsoFromUnix(invoice.period_end);
  }

  const paidAt = getStripePaidAt(subscription, invoice);
  if (paidAt) {
    return addDaysToIso(paidAt, 30);
  }

  return null;
}

async function syncCompanyFromSubscription(supabase, companyId, subscription, customerId, invoice = null) {
  const mappedStatus = getEffectiveCompanyStatusFromSubscription(subscription, invoice);
  const latestInvoice = invoice || (typeof subscription.latest_invoice === 'object' ? subscription.latest_invoice : null);
  const paidAt = getStripePaidAt(subscription, latestInvoice);
  const renewalAt = getNextRenewalAt(subscription, latestInvoice);

  await updateCompanySubscription(supabase, companyId, {
    stripe_customer_id: customerId || (typeof subscription.customer === 'string' ? subscription.customer : null),
    stripe_subscription_id: subscription.id,
    subscription_status: mappedStatus,
    subscription_plan: 'monthly',
    subscription_expires_at: mappedStatus === 'active' || mappedStatus === 'trial' ? renewalAt : null,
    payment_provider: 'stripe',
    payment_method: 'credit_card',
    payment_status: latestInvoice?.status === 'paid' ? 'paid' : mappedStatus === 'past_due' ? 'failed' : 'pending',
    paid_at: paidAt,
    next_due_date: renewalAt,
    external_checkout_url: null
  });
}

const BLOCKED_SUBSCRIPTION_STATUSES = [
  'trialing',
  'active',
  'past_due',
  'unpaid',
  'paused',
  'incomplete'
];

function canBlockNewSubscription(status) {
  return BLOCKED_SUBSCRIPTION_STATUSES.includes(String(status || '').toLowerCase());
}

function buildExistingSubscriptionMessage(subscription) {
  const status = String(subscription?.status || '').toLowerCase();

  if (status === 'trialing') {
    return 'Esta agencia ja possui uma assinatura em periodo de teste.';
  }

  if (status === 'active') {
    return 'Esta agencia ja possui uma assinatura mensal ativa.';
  }

  if (status === 'past_due' || status === 'unpaid') {
    return 'Esta agencia ja possui uma assinatura mensal com pagamento pendente.';
  }

  if (status === 'incomplete') {
    return 'Ja existe uma assinatura mensal em processamento para esta agencia.';
  }

  if (status === 'paused') {
    return 'Esta agencia ja possui uma assinatura mensal pausada.';
  }

  return 'Esta agencia ja possui uma assinatura mensal em vigor.';
}

async function findBlockingSubscriptionForCompany(stripe, company) {
  const storedSubscriptionId = company.stripe_subscription_id || null;
  const customerId = company.stripe_customer_id || null;

  if (storedSubscriptionId) {
    try {
      const storedSubscription = await stripe.subscriptions.retrieve(storedSubscriptionId);
      if (storedSubscription && canBlockNewSubscription(storedSubscription.status)) {
        return storedSubscription;
      }
    } catch {
      // Se a assinatura salva nao existir mais, seguimos e usamos a busca por customer.
    }
  }

  if (!customerId) {
    return null;
  }

  for (const status of BLOCKED_SUBSCRIPTION_STATUSES) {
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status,
      limit: 3
    });

    const match = subscriptions.data.find((subscription) => canBlockNewSubscription(subscription.status));
    if (match) {
      return match;
    }
  }

  return null;
}

async function assertNoBlockingSubscription(stripe, supabase, company) {
  const existingSubscription = await findBlockingSubscriptionForCompany(stripe, company);

  if (!existingSubscription) {
    return null;
  }

  await syncCompanyFromSubscription(
    supabase,
    company.id,
    existingSubscription,
    typeof existingSubscription.customer === 'string'
      ? existingSubscription.customer
      : existingSubscription.customer?.id || null
  );

  const error = new Error(buildExistingSubscriptionMessage(existingSubscription));
  error.code = 'SUBSCRIPTION_ALREADY_EXISTS';
  error.subscription = existingSubscription;
  throw error;
}

async function ensurePortalConfiguration(stripe, defaultReturnUrl) {
  const configurations = await stripe.billingPortal.configurations.list({ limit: 1, active: true });

  if (configurations.data.length > 0) {
    return configurations.data[0];
  }

  return stripe.billingPortal.configurations.create({
    business_profile: {
      headline: 'Gerencie sua assinatura do Clube Turismo Flow'
    },
    default_return_url: defaultReturnUrl,
    features: {
      customer_update: {
        allowed_updates: ['email', 'address', 'name'],
        enabled: true
      },
      invoice_history: {
        enabled: true
      },
      payment_method_update: {
        enabled: true
      },
      subscription_cancel: {
        enabled: true,
        mode: 'at_period_end',
        cancellation_reason: {
          enabled: true,
          options: ['too_expensive', 'missing_features', 'switched_service', 'unused', 'other']
        }
      }
    }
  });
}

async function readRawBody(req) {
  if (typeof req.body === 'string') {
    return req.body;
  }

  if (Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0) {
    return Buffer.from(JSON.stringify(req.body));
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
}

async function tryRecordWebhookEvent(supabase, { id, provider, eventType, companyId = null, payload = null }) {
  if (!id || !provider || !eventType) {
    return true;
  }

  const insertPayload = {
    id,
    provider,
    event_type: eventType,
    company_id: companyId,
    payload,
    processed_at: new Date().toISOString(),
    created_at: new Date().toISOString()
  };

  const { error } = await supabase
    .from('payment_webhook_events')
    .insert(insertPayload);

  if (!error) {
    return true;
  }

  if (error.code === '23505') {
    return false;
  }

  throw new Error(`Erro ao registrar evento de webhook: ${error.message}`);
}

module.exports = {
  STRIPE_API_VERSION,
  addCors,
  addDaysToIso,
  assertNoBlockingSubscription,
  createStripeClient,
  createSupabaseAdmin,
  ensurePortalConfiguration,
  ensureStripeCustomerForCompany,
  getBaseUrl,
  getCompanyByAsaasPaymentId,
  getCompanyByCustomerId,
  getCompanyById,
  getCompanyBySubscriptionId,
  getEffectiveCompanyStatusFromSubscription,
  getNextRenewalAt,
  normalizePostalCode,
  normalizeTaxId,
  readRawBody,
  resolveAuthorizedCompanyContext,
  syncCompanyFromSubscription,
  toDateOnly,
  toIsoFromUnix,
  tryRecordWebhookEvent,
  updateCompanySubscription,
  upsertInvoiceRecord
};
