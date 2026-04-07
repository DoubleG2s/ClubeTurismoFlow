const {
  addCors,
  createStripeClient,
  createSupabaseAdmin,
  ensureStripeCustomerForCompany,
  getCompanyById,
  resolveAuthorizedCompanyContext,
  syncCompanyFromSubscription
} = require('./_lib');

export default async function handler(req, res) {
  addCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const stripe = createStripeClient();
    const supabase = createSupabaseAdmin();
    const { companyId: requestedCompanyId, setupIntentId } = req.body || {};

    if (!setupIntentId) {
      return res.status(400).json({ error: 'Falta o setupIntentId da atualizacao do cartao.' });
    }

    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    const company = await getCompanyById(supabase, companyId);
    const subscriptionId = company.stripe_subscription_id || company.asaas_subscription_id;

    if (!subscriptionId) {
      return res.status(409).json({
        error: 'Esta empresa ainda nao possui uma assinatura Stripe ativa para atualizar.'
      });
    }

    const customer = await ensureStripeCustomerForCompany(stripe, supabase, company, {
      companyName: company.name,
      email: company.billing_email || undefined,
      taxId: company.tax_id || undefined
    });

    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
      expand: ['payment_method']
    });

    if (setupIntent.customer !== customer.id) {
      return res.status(400).json({
        error: 'O cartao informado nao pertence a esta empresa.'
      });
    }

    if (setupIntent.status !== 'succeeded' || !setupIntent.payment_method) {
      return res.status(400).json({
        error: 'A Stripe ainda nao confirmou o novo cartao.'
      });
    }

    const paymentMethodId =
      typeof setupIntent.payment_method === 'string'
        ? setupIntent.payment_method
        : setupIntent.payment_method.id;

    await stripe.customers.update(customer.id, {
      invoice_settings: {
        default_payment_method: paymentMethodId
      }
    });

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      default_payment_method: paymentMethodId,
      payment_settings: {
        save_default_payment_method: 'on_subscription'
      }
    });

    await syncCompanyFromSubscription(supabase, companyId, subscription, customer.id);

    const paymentMethod =
      typeof setupIntent.payment_method === 'string' ? null : setupIntent.payment_method;

    return res.status(200).json({
      success: true,
      paymentMethod: paymentMethod?.card
        ? {
            brand: paymentMethod.card.brand,
            last4: paymentMethod.card.last4,
            expMonth: paymentMethod.card.exp_month,
            expYear: paymentMethod.card.exp_year
          }
        : null
    });
  } catch (error) {
    console.error('[Stripe] Erro ao atualizar cartao da assinatura:', error);
    return res.status(400).json({
      error: 'Falha ao salvar o novo cartao da assinatura.',
      details: String(error.message || error)
    });
  }
}
