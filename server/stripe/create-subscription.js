const {
  addCors,
  createStripeClient,
  createSupabaseAdmin,
  assertNoBlockingSubscription,
  ensureStripeCustomerForCompany,
  getCompanyById,
  hasBlockingCompanyAccess,
  normalizeTaxId,
  resolveAuthorizedCompanyContext,
  syncCompanyFromSubscription
} = require('./_lib');

const DEFAULT_STRIPE_TRIAL_PERIOD_DAYS = 14;

function getStripeTrialPeriodDays() {
  const value = Number(process.env.STRIPE_TRIAL_PERIOD_DAYS || DEFAULT_STRIPE_TRIAL_PERIOD_DAYS);

  return Number.isFinite(value) && value >= 0 ? Math.floor(value) : DEFAULT_STRIPE_TRIAL_PERIOD_DAYS;
}

module.exports = async function handler(req, res) {
  addCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const priceId = process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    return res.status(500).json({ error: 'Falta a variavel STRIPE_PRICE_ID.' });
  }

  try {
    const stripe = createStripeClient();
    const supabase = createSupabaseAdmin();
    const { companyId: requestedCompanyId, companyName, email, taxId, setupIntentId } = req.body || {};

    if (!companyName || !email || !taxId || !setupIntentId) {
      return res.status(400).json({ error: 'Faltam dados obrigatorios para criar a assinatura.' });
    }

    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    const company = await getCompanyById(supabase, companyId);

    if (hasBlockingCompanyAccess(company)) {
      return res.status(409).json({
        error: 'Esta agencia ja possui uma assinatura em vigor. Use o portal para gerenciar.'
      });
    }

    // Nota humana:
    // mesmo no fluxo embutido, a empresa nao pode criar outra recorrencia mensal.
    await assertNoBlockingSubscription(stripe, supabase, company);

    const cleanTaxId = normalizeTaxId(taxId);
    const customer = await ensureStripeCustomerForCompany(stripe, supabase, company, {
      email,
      companyName,
      taxId: cleanTaxId
    });

    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
      expand: ['payment_method']
    });

    if (setupIntent.customer !== customer.id) {
      return res.status(400).json({
        error: 'O metodo de pagamento salvo nao pertence a esta empresa.'
      });
    }

    if (setupIntent.status !== 'succeeded' || !setupIntent.payment_method) {
      return res.status(400).json({
        error: 'O metodo de pagamento ainda nao foi confirmado na Stripe.'
      });
    }

    // A assinatura nasce aqui, usando o payment method salvo pelo SetupIntent.
    // O trial de 14 dias comeca depois da verificacao do cartao.
    // A primeira mensalidade e cobrada pela Stripe no fim do trial, e as proximas seguem o ciclo mensal do price.
    const trialPeriodDays = getStripeTrialPeriodDays();
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price: priceId
        }
      ],
      trial_period_days: trialPeriodDays || undefined,
      default_payment_method:
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method.id,
      payment_settings: {
        save_default_payment_method: 'on_subscription'
      },
      metadata: {
        companyId,
        taxId: cleanTaxId,
        trialPeriodDays: String(trialPeriodDays)
      }
    });

    await syncCompanyFromSubscription(
      supabase,
      companyId,
      subscription,
      customer.id
    );

    return res.status(200).json({
      success: true,
      subscriptionId: subscription.id,
      customerId: customer.id,
      status: subscription.status,
      trialEnd: subscription.trial_end || null,
      trialPeriodDays
    });
  } catch (error) {
    console.error('[Stripe] Erro ao criar assinatura embutida:', error);
    if (error.code === 'SUBSCRIPTION_ALREADY_EXISTS') {
      return res.status(409).json({
        error: error.message,
        subscriptionId: error.subscription?.id || null,
        status: error.subscription?.status || null
      });
    }
    return res.status(500).json({
      error: 'Falha ao criar a assinatura na Stripe.',
      details: String(error.message || error)
    });
  }
}


