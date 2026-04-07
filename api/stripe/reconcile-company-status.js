const {
  addCors,
  createStripeClient,
  createSupabaseAdmin,
  getCompanyById,
  resolveAuthorizedCompanyContext,
  syncCompanyFromSubscription,
  updateCompanySubscription
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
    const { companyId: requestedCompanyId } = req.body || {};
    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    let company = await getCompanyById(supabase, companyId);

    const subscriptionId = company.stripe_subscription_id || company.asaas_subscription_id || null;

    if (subscriptionId) {
      const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
        expand: ['latest_invoice']
      });

      const latestInvoice =
        subscription.latest_invoice && typeof subscription.latest_invoice !== 'string'
          ? subscription.latest_invoice
          : null;

      await syncCompanyFromSubscription(
        supabase,
        companyId,
        subscription,
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null,
        latestInvoice
      );

      company = await getCompanyById(supabase, companyId);
    }

    const expiresAt = company.subscription_expires_at
      ? new Date(company.subscription_expires_at)
      : null;

    const isExpired =
      company.subscription_status === 'active' &&
      expiresAt &&
      !Number.isNaN(expiresAt.getTime()) &&
      expiresAt.getTime() <= Date.now();

    if (isExpired) {
      await updateCompanySubscription(supabase, companyId, {
        subscription_status: 'past_due'
      });
    }

    return res.status(200).json({
      success: true,
      updated: Boolean(isExpired || subscriptionId),
      subscription_status: isExpired ? 'past_due' : company.subscription_status
    });
  } catch (error) {
    console.error('[Stripe] Erro ao reconciliar status:', error);
    return res.status(500).json({
      error: 'Falha ao reconciliar o status da assinatura.',
      details: String(error.message || error)
    });
  }
}
