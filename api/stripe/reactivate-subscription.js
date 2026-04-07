const {
  addCors,
  createStripeClient,
  createSupabaseAdmin,
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
    const supabase = createSupabaseAdmin();
    const stripe = createStripeClient();
    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, req.body?.companyId || null);
    const company = await getCompanyById(supabase, companyId);

    const subscriptionId = company.stripe_subscription_id;
    if (!subscriptionId) {
      return res.status(400).json({ error: 'A empresa ainda não possui assinatura Stripe vinculada.' });
    }

    const currentSubscription = await stripe.subscriptions.retrieve(subscriptionId);
    if (currentSubscription.status === 'canceled') {
      return res.status(400).json({
        error: 'Essa assinatura já foi encerrada definitivamente. Crie uma nova assinatura para voltar a cobrar.'
      });
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: false
    });

    await syncCompanyFromSubscription(
      supabase,
      companyId,
      subscription,
      typeof subscription.customer === 'string' ? subscription.customer : null
    );

    return res.status(200).json({
      success: true,
      subscription: {
        id: subscription.id,
        status: subscription.status,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
        currentPeriodEnd: subscription.current_period_end || null
      }
    });
  } catch (error) {
    console.error('[Stripe] Erro ao reativar assinatura:', error);
    return res.status(400).json({
      error: 'Falha ao reativar a assinatura.',
      details: String(error.message || error)
    });
  }
}
