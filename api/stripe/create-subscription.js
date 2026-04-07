const {
  addCors,
  createStripeClient,
  createSupabaseAdmin,
  assertNoBlockingSubscription,
  ensureStripeCustomerForCompany,
  getCompanyById,
  normalizeTaxId,
  resolveAuthorizedCompanyContext,
  syncCompanyFromSubscription
} = require('./_lib');

const STRIPE_TRIAL_PERIOD_DAYS = 0;

export default async function handler(req, res) {
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
    // Assim a cobranca segue com o Billing da Stripe, mas o formulario continua embutido no app.
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [
        {
          price: priceId
        }
      ],
      default_payment_method:
        typeof setupIntent.payment_method === 'string'
          ? setupIntent.payment_method
          : setupIntent.payment_method.id,
      payment_settings: {
        save_default_payment_method: 'on_subscription'
      },
      metadata: {
        companyId,
        taxId: cleanTaxId
      }
    });

    if (STRIPE_TRIAL_PERIOD_DAYS > 0) {
      subscription.trial_period_days = STRIPE_TRIAL_PERIOD_DAYS;
    }

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
      status: subscription.status
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

