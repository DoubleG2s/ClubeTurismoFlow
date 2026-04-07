const {
  addCors,
  createStripeClient,
  createSupabaseAdmin,
  getCompanyById,
  resolveAuthorizedCompanyContext,
  upsertInvoiceRecord
} = require('./_lib');

function isPayableInvoice(invoice) {
  return ['open', 'draft', 'uncollectible'].includes(invoice?.status);
}

async function resolvePayableInvoice(stripe, subscriptionId) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['latest_invoice']
  });

  const latestInvoice =
    typeof subscription.latest_invoice === 'string' ? null : subscription.latest_invoice;

  if (latestInvoice && isPayableInvoice(latestInvoice)) {
    return latestInvoice;
  }

  const invoices = await stripe.invoices.list({
    subscription: subscriptionId,
    limit: 10
  });

  return invoices.data.find(isPayableInvoice) || null;
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
    const { companyId: requestedCompanyId } = req.body || {};
    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    const company = await getCompanyById(supabase, companyId);
    const subscriptionId = company.stripe_subscription_id || company.asaas_subscription_id;

    if (!subscriptionId) {
      return res.status(409).json({
        error: 'Esta empresa ainda nao possui assinatura Stripe vinculada.'
      });
    }

    const invoice = await resolvePayableInvoice(stripe, subscriptionId);

    if (!invoice) {
      return res.status(409).json({
        error: 'No momento nao existe uma cobranca pendente ou em atraso para gerar boleto.'
      });
    }

    // para nao criar uma segunda cobranca paralela, o boleto so e habilitado
    // sobre a propria fatura aberta/pendente da assinatura mensal.
    let preparedInvoice = await stripe.invoices.update(invoice.id, {
      payment_settings: {
        payment_method_types: ['boleto']
      }
    });

    if (preparedInvoice.status === 'draft') {
      preparedInvoice = await stripe.invoices.finalizeInvoice(preparedInvoice.id);
    }

    if (!preparedInvoice.hosted_invoice_url) {
      preparedInvoice = await stripe.invoices.retrieve(preparedInvoice.id);
    }

    await upsertInvoiceRecord(supabase, companyId, preparedInvoice);

    return res.status(200).json({
      success: true,
      boleto: {
        invoiceId: preparedInvoice.id,
        hostedInvoiceUrl: preparedInvoice.hosted_invoice_url || null,
        status: preparedInvoice.status,
        dueDate: preparedInvoice.due_date || null,
        amountDue: typeof preparedInvoice.amount_due === 'number' ? preparedInvoice.amount_due / 100 : null
      }
    });
  } catch (error) {
    console.error('[Stripe] Erro ao gerar boleto da assinatura:', error);
    return res.status(400).json({
      error: 'Falha ao preparar o boleto da cobranca atual.',
      details: String(error.message || error)
    });
  }
}
