const {
  addCors,
  createStripeClient,
  createSupabaseAdmin,
  getCompanyById,
  resolveAuthorizedCompanyContext
} = require('./_lib');

module.exports = async function handler(req, res) {
  addCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const supabase = createSupabaseAdmin();
    const stripe = createStripeClient();
    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, req.body?.companyId || null);
    const company = await getCompanyById(supabase, companyId);

    const subscriptionId = company.stripe_subscription_id;
    if (!subscriptionId) {
      return res.status(200).json({ subscription: null });
    }

    let subscription = null;

    try {
      subscription = await stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      const details = String(error?.message || error);

      if (details.includes('No such subscription') || details.includes('resource_missing')) {
        return res.status(200).json({ subscription: null });
      }

      throw error;
    }

    return res.status(200).json({
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        cancelAt: subscription.cancel_at || null,
        canceledAt: subscription.canceled_at || null,
        currentPeriodEnd: subscription.current_period_end || null,
        customer: typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null,
        priceId: subscription.items.data[0]?.price?.id || null
      }
    });
  } catch (error) {
    console.error('[Stripe] Erro ao consultar gerenciamento da assinatura:', error);
    return res.status(400).json({
      error: 'Falha ao carregar os dados de gerenciamento da assinatura.',
      details: String(error.message || error)
    });
  }
}

