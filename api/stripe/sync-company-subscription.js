const {
  addCors,
  createStripeClient,
  createSupabaseAdmin,
  getCompanyById,
  resolveAuthorizedCompanyContext,
  syncCompanyFromSubscription,
  toDateOnly,
  toIsoFromUnix,
  upsertInvoiceRecord
} = require('./_lib');

async function syncInvoiceHistory(stripe, supabase, companyId, customerId, subscriptionId) {
  const invoices = await stripe.invoices.list({
    customer: customerId || undefined,
    subscription: subscriptionId || undefined,
    limit: 12
  });

  for (const invoice of invoices.data) {
    await upsertInvoiceRecord(supabase, companyId, {
      stripe_payment_id: invoice.payment_intent || invoice.id,
      stripe_subscription_id:
        typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null,
      payment_provider: 'stripe',
      payment_method: 'credit_card',
      value: typeof invoice.amount_due === 'number' ? invoice.amount_due / 100 : 0,
      status:
        invoice.status === 'paid'
          ? 'RECEIVED'
          : invoice.status === 'open' || invoice.status === 'draft'
            ? 'PENDING'
            : invoice.status === 'void'
              ? 'CANCELED'
              : 'OVERDUE',
      due_date: invoice.due_date ? toDateOnly(toIsoFromUnix(invoice.due_date)) : new Date().toISOString().slice(0, 10),
      payment_url: invoice.hosted_invoice_url || invoice.invoice_pdf || null,
      paid_at: invoice.status_transitions?.paid_at ? toIsoFromUnix(invoice.status_transitions.paid_at) : null
    });
  }
}

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
    const { companyId: requestedCompanyId, sessionId } = req.body || {};
    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    const company = await getCompanyById(supabase, companyId);

    let subscriptionId = company.stripe_subscription_id || null;
    let customerId = company.stripe_customer_id || null;

    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['subscription', 'customer']
      });

      if (session.metadata?.companyId !== companyId) {
        return res.status(400).json({ error: 'A sessao de checkout nao pertence a esta empresa.' });
      }

      subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || subscriptionId;
      customerId =
        typeof session.customer === 'string' ? session.customer : session.customer?.id || customerId;
    }

    if (!subscriptionId) {
      return res.status(404).json({
        error: 'Nenhuma assinatura Stripe foi encontrada para esta empresa.'
      });
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['latest_invoice', 'latest_invoice.lines']
    });

    customerId =
      customerId ||
      (typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null);

    await syncCompanyFromSubscription(supabase, companyId, subscription, customerId);
    await syncInvoiceHistory(stripe, supabase, companyId, customerId, subscription.id);

    return res.status(200).json({
      success: true,
      subscriptionId: subscription.id,
      customerId,
      status: subscription.status
    });
  } catch (error) {
    console.error('[Stripe] Erro ao sincronizar assinatura:', error);
    return res.status(500).json({
      error: 'Falha ao sincronizar a assinatura com a Stripe.',
      details: String(error.message || error)
    });
  }
}
