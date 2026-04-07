const {
  addCors,
  assertNoBlockingSubscription,
  createStripeClient,
  createSupabaseAdmin,
  ensureStripeCustomerForCompany,
  getBaseUrl,
  getCompanyById,
  normalizePostalCode,
  normalizeTaxId,
  resolveAuthorizedCompanyContext
} = require('./_lib');

function getStripeMonthlyPriceId() {
  return process.env.STRIPE_MONTHLY_PRICE_ID || process.env.STRIPE_PRICE_ID || '';
}

export default async function handler(req, res) {
  addCors(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const priceId = getStripeMonthlyPriceId();

  if (!priceId) {
    return res.status(500).json({
      error: 'Falta a variavel STRIPE_MONTHLY_PRICE_ID.'
    });
  }

  try {
    const stripe = createStripeClient();
    const supabase = createSupabaseAdmin();
    const { companyId: requestedCompanyId, companyName, email, taxId, postalCode, plan } = req.body || {};

    if (!companyName || !email || !taxId) {
      return res.status(400).json({ error: 'Faltam dados obrigatorios para iniciar o checkout.' });
    }

    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    const company = await getCompanyById(supabase, companyId);

    await assertNoBlockingSubscription(stripe, supabase, company);

    const customer = await ensureStripeCustomerForCompany(stripe, supabase, company, {
      email,
      companyName,
      taxId: normalizeTaxId(taxId),
      postalCode: normalizePostalCode(postalCode)
    });

    const baseUrl = getBaseUrl(req);
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customer.id,
      success_url: `${baseUrl}/?tab=assinatura&checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/?tab=assinatura&checkout=cancel`,
      billing_address_collection: 'required',
      tax_id_collection: {
        enabled: true
      },
      customer_update: {
        name: 'auto',
        address: 'auto'
      },
      payment_method_types: ['card'],
      allow_promotion_codes: true,
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      metadata: {
        companyId,
        taxId: normalizeTaxId(taxId),
        plan: plan || 'monthly',
        paymentProvider: 'stripe',
        paymentMethod: 'credit_card'
      },
      subscription_data: {
        metadata: {
          companyId,
          taxId: normalizeTaxId(taxId),
          plan: plan || 'monthly',
          paymentProvider: 'stripe',
          paymentMethod: 'credit_card'
        }
      }
    });

    return res.status(200).json({
      success: true,
      checkoutUrl: session.url
    });
  } catch (error) {
    console.error('[Stripe] Erro ao criar checkout externo:', error);

    if (error.code === 'SUBSCRIPTION_ALREADY_EXISTS') {
      return res.status(409).json({
        error: error.message,
        subscriptionId: error.subscription?.id || null,
        status: error.subscription?.status || null
      });
    }

    return res.status(500).json({
      error: 'Falha ao iniciar o checkout externo da Stripe.',
      details: String(error.message || error)
    });
  }
}
