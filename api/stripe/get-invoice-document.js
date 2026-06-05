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
    const invoiceId = req.body?.invoiceId || null;

    if (!invoiceId) {
      return res.status(400).json({ error: 'Falta o invoiceId para abrir o comprovante.' });
    }

    const companyCustomerId = company.stripe_customer_id || company.asaas_customer_id || null;
    const companySubscriptionId = company.stripe_subscription_id || company.asaas_subscription_id || null;
    const invoice = await stripe.invoices.retrieve(invoiceId);

    const invoiceCustomerId =
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null;
    const invoiceSubscriptionId =
      typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null;

    if (
      companyCustomerId &&
      invoiceCustomerId &&
      companyCustomerId !== invoiceCustomerId &&
      companySubscriptionId !== invoiceSubscriptionId
    ) {
      return res.status(403).json({ error: 'Esta fatura nao pertence a empresa autenticada.' });
    }

    // Nota humana:
    // a tela embutida funciona melhor com PDF do que com a hosted invoice page.
    // Quando houver PDF, priorizamos ele para o modal.
    return res.status(200).json({
      invoice: {
        id: invoice.id,
        hostedInvoiceUrl: invoice.hosted_invoice_url || null,
        invoicePdfUrl: invoice.invoice_pdf || null,
        embedUrl: invoice.invoice_pdf || invoice.hosted_invoice_url || null,
        canEmbed: Boolean(invoice.invoice_pdf)
      }
    });
  } catch (error) {
    console.error('[Stripe] Erro ao carregar documento da fatura:', error);
    return res.status(400).json({
      error: 'Falha ao carregar o comprovante da Stripe.',
      details: String(error.message || error)
    });
  }
}

