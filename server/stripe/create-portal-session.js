const {
  addCors,
  createStripeClient,
  createSupabaseAdmin,
  ensureStripeCustomerForCompany,
  ensurePortalConfiguration,
  getBaseUrl,
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
    const stripe = createStripeClient();
    const supabase = createSupabaseAdmin();
    const { companyId: requestedCompanyId } = req.body || {};
    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);

    const company = await getCompanyById(supabase, companyId);

    const customer = await ensureStripeCustomerForCompany(stripe, supabase, company);
    const configuration = await ensurePortalConfiguration(stripe, `${getBaseUrl(req)}/?tab=assinatura`);
    const portal = await stripe.billingPortal.sessions.create({
      customer: customer.id,
      configuration: configuration.id,
      return_url: `${getBaseUrl(req)}/?tab=assinatura`
    });

    return res.status(200).json({
      success: true,
      portalUrl: portal.url
    });
  } catch (error) {
    console.error('[Stripe] Erro ao abrir portal:', error);
    const details = String(error.message || error);
    const statusCode =
      details.includes('No such customer') || details.includes('resource_missing') ? 400 : 500;

    const message =
      statusCode === 400
        ? 'O cliente Stripe salvo para esta empresa Ã© invÃ¡lido ou nÃ£o existe mais.'
        : 'Falha ao abrir o portal da Stripe.';

    return res.status(statusCode).json({
      error: message,
      details
    });
  }
}

