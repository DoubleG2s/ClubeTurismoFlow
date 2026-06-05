const {
  addCors,
  createStripeClient,
  createSupabaseAdmin,
  getCompanyById,
  resolveAuthorizedCompanyContext
} = require('./_lib');

module.exports = async function handler(req, res) {
  addCors(res, 'OPTIONS,POST');

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

    if (!invoice.invoice_pdf) {
      return res.status(404).json({ error: 'Esta fatura nao possui PDF disponivel para visualizacao embutida.' });
    }

    const pdfResponse = await fetch(invoice.invoice_pdf);
    if (!pdfResponse.ok) {
      return res.status(400).json({ error: 'Nao foi possivel baixar o PDF da fatura na Stripe.' });
    }

    const arrayBuffer = await pdfResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${invoice.id}.pdf"`);
    res.setHeader('Cache-Control', 'private, max-age=60');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error('[Stripe] Erro ao carregar PDF da fatura:', error);
    return res.status(400).json({
      error: 'Falha ao carregar o PDF da fatura.',
      details: String(error.message || error)
    });
  }
}

