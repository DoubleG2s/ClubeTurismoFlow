const {
  addCors,
  assertNoBlockingSubscription,
  createStripeClient,
  createSupabaseAdmin,
  ensureStripeCustomerForCompany,
  getCompanyById,
  normalizeTaxId,
  resolveAuthorizedCompanyContext,
  updateCompanySubscription,
  upsertInvoiceRecord
} = require('./_lib');

const DAYS_UNTIL_DUE = 3;

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
    const { companyId: requestedCompanyId, companyName, email, taxId } = req.body || {};

    if (!companyName || !email || !taxId) {
      return res.status(400).json({ error: 'Faltam dados obrigatorios para iniciar a assinatura via boleto.' });
    }

    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    const company = await getCompanyById(supabase, companyId);

    await assertNoBlockingSubscription(stripe, supabase, company);

    const cleanTaxId = normalizeTaxId(taxId);
    const customer = await ensureStripeCustomerForCompany(stripe, supabase, company, {
      email,
      companyName,
      taxId: cleanTaxId
    });

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      collection_method: 'send_invoice',
      days_until_due: DAYS_UNTIL_DUE,
      items: [
        {
          price: priceId
        }
      ],
      payment_settings: {
        payment_method_types: ['boleto']
      },
      metadata: {
        companyId,
        taxId: cleanTaxId,
        paymentFlow: 'boleto'
      },
      expand: ['latest_invoice']
    });

    let latestInvoice =
      subscription.latest_invoice && typeof subscription.latest_invoice !== 'string'
        ? subscription.latest_invoice
        : null;

    if (latestInvoice?.status === 'draft') {
      latestInvoice = await stripe.invoices.finalizeInvoice(latestInvoice.id);
    }

    await updateCompanySubscription(supabase, companyId, {
      stripe_customer_id: customer.id,
      stripe_subscription_id: subscription.id,
      asaas_customer_id: customer.id,
      asaas_subscription_id: subscription.id,
      subscription_status: 'inactive',
      subscription_expires_at: null,
      tax_id: cleanTaxId || company.tax_id || null
    });

    if (latestInvoice) {
      await upsertInvoiceRecord(supabase, companyId, latestInvoice);
    }

    return res.status(200).json({
      success: true,
      boleto: {
        subscriptionId: subscription.id,
        invoiceId: latestInvoice?.id || null,
        hostedInvoiceUrl: latestInvoice?.hosted_invoice_url || null,
        status: latestInvoice?.status || null,
        dueDate: latestInvoice?.due_date || null,
        amountDue: typeof latestInvoice?.amount_due === 'number' ? latestInvoice.amount_due / 100 : null
      }
    });
  } catch (error) {
    console.error('[Stripe] Erro ao criar assinatura via boleto:', error);
    if (error.code === 'SUBSCRIPTION_ALREADY_EXISTS') {
      return res.status(409).json({
        error: error.message,
        subscriptionId: error.subscription?.id || null,
        status: error.subscription?.status || null
      });
    }

    return res.status(500).json({
      error: 'Falha ao iniciar a assinatura via boleto.',
      details: String(error.message || error)
    });
  }
}
