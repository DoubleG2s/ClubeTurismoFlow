const {
  addCors,
  assertMatchingStripeKeyModes,
  createStripeClient,
  createSupabaseAdmin,
  ensureStripeCustomerForCompany,
  getCompanyById,
  getStripePublishableKey,
  getStripeSecretKey,
  hasBlockingCompanyAccess,
  normalizeTaxId,
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

  const secretKey = getStripeSecretKey();
  const publishableKey = getStripePublishableKey();

  if (!publishableKey) {
    return res.status(500).json({
      error: 'Falta a variavel STRIPE_PUBLISHABLE_KEY para renderizar o formulario da Stripe.'
    });
  }

  try {
    assertMatchingStripeKeyModes(secretKey, publishableKey);
  } catch (error) {
    return res.status(500).json({
      error: 'Configuracao da Stripe inconsistente.',
      details: String(error.message || error)
    });
  }

  try {
    const stripe = createStripeClient();
    const supabase = createSupabaseAdmin();
    const { companyId: requestedCompanyId, companyName, email, taxId } = req.body || {};

    if (!companyName || !email || !taxId) {
      return res.status(400).json({ error: 'Faltam dados obrigatorios da empresa.' });
    }

    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    const company = await getCompanyById(supabase, companyId);

    if (hasBlockingCompanyAccess(company)) {
      return res.status(400).json({
        error: 'Esta agencia ja possui uma assinatura em vigor. Use o portal para gerenciar.'
      });
    }

    const cleanTaxId = normalizeTaxId(taxId);
    const customer = await ensureStripeCustomerForCompany(stripe, supabase, company, {
      email,
      companyName,
      taxId: cleanTaxId
    });
    
    // Aqui usamos SetupIntent para coletar e salvar o metodo de pagamento no formulario embutido.
    // A assinatura em si e criada depois, quando o frontend confirma o SetupIntent com sucesso.
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      usage: 'off_session',
      payment_method_types: ['card'],
      metadata: {
        companyId,
        taxId: cleanTaxId
      }
    });

    return res.status(200).json({
      success: true,
      clientSecret: setupIntent.client_secret,
      setupIntentId: setupIntent.id,
      customerId: customer.id,
      publishableKey
    });
  } catch (error) {
    console.error('[Stripe] Erro ao preparar Payment Element:', error);
    const details = String(error.message || error);
    const statusCode =
      details.includes('Sessao') ||
      details.includes('Perfil do usuario') ||
      details.includes('Usuario sem empresa') ||
      details.includes('empresa informada')
        ? 403
        : details.toLowerCase().includes('permission') ||
            details.toLowerCase().includes('api key') ||
            details.toLowerCase().includes('no such price') ||
            details.toLowerCase().includes('no such customer')
          ? 502
          : 500;

    return res.status(statusCode).json({
      error: 'Falha ao preparar o formulario de pagamento da Stripe.',
      details
    });
  }
}

