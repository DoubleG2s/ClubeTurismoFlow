const {
  addCors,
  createStripeClient,
  createSupabaseAdmin,
  getCompanyById,
  resolveAuthorizedCompanyContext,
  upsertInvoiceRecord
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
    const { companyId: requestedCompanyId, limit = 8 } = req.body || {};
    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    const company = await getCompanyById(supabase, companyId);
    const customerId = company.stripe_customer_id || company.asaas_customer_id || null;
    const subscriptionId = company.stripe_subscription_id || company.asaas_subscription_id || null;

    if (!customerId && !subscriptionId) {
      return res.status(200).json({ invoices: [] });
    }

    const invoices = await stripe.invoices.list({
      customer: customerId || undefined,
      subscription: subscriptionId || undefined,
      limit: Math.min(Math.max(Number(limit) || 8, 1), 20)
    });

    for (const invoice of invoices.data) {
      await upsertInvoiceRecord(supabase, companyId, invoice);
    }

    return res.status(200).json({
      invoices: invoices.data.map((invoice) => ({
        id: invoice.id,
        value: typeof invoice.amount_due === 'number' ? invoice.amount_due / 100 : 0,
        status: invoice.status === 'paid' ? 'RECEIVED' : invoice.status === 'open' ? 'PENDING' : 'OVERDUE',
        due_date: invoice.due_date
          ? new Date(invoice.due_date * 1000).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        payment_url: invoice.hosted_invoice_url || invoice.invoice_pdf || null,
        stripe_payment_id: invoice.id,
        stripe_subscription_id:
          typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null,
        created_at: invoice.created
          ? new Date(invoice.created * 1000).toISOString()
          : new Date().toISOString(),
        updated_at: new Date().toISOString()
      }))
    });
  } catch (error) {
    console.error('[Stripe] Erro ao sincronizar historico de faturas:', error);
    return res.status(400).json({
      error: 'Falha ao sincronizar o historico de cobrancas com a Stripe.',
      details: String(error.message || error)
    });
  }
}
