const {
  addCors,
  createStripeClient,
  createSupabaseAdmin,
  ensureStripeCustomerForCompany,
  getCompanyById,
  resolveAuthorizedCompanyContext
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
    const { companyId: requestedCompanyId, companyName, email, taxId } = req.body || {};
    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    const company = await getCompanyById(supabase, companyId);

    const customer = await ensureStripeCustomerForCompany(stripe, supabase, company, {
      companyName: companyName || company.name,
      email: email || company.billing_email || undefined,
      taxId: taxId || company.tax_id || undefined
    });

    // este SetupIntent serve somente para trocar o cartao salvo da assinatura.
    // O card continua sendo coletado pela Stripe, e depois confirmamos o novo
    // payment method como padrao da empresa e da assinatura recorrente.
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: {
        companyId
      }
    });

    return res.status(200).json({
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      customerId: customer.id
    });
  } catch (error) {
    console.error('[Stripe] Erro ao preparar atualizacao de cartao:', error);
    return res.status(400).json({
      error: 'Falha ao preparar a atualizacao do cartao.',
      details: String(error.message || error)
    });
  }
}
