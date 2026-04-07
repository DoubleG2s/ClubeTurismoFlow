const {
  addCors,
  asaasRequest,
  createSupabaseAdmin,
  ensureAsaasCustomerForCompany,
  getCompanyById,
  normalizePostalCode,
  normalizeTaxId,
  resolveAuthorizedCompanyContext,
  updateCompanyFromAsaasPayment,
  upsertAsaasInvoiceRecord
} = require('./_lib');

function getMonthlyAmount() {
  return Number(process.env.ASAAS_MONTHLY_AMOUNT || process.env.STRIPE_ONE_TIME_AMOUNT_CENTS / 100 || 370);
}

function buildDueDate() {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);
  return dueDate.toISOString().slice(0, 10);
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
    const supabase = createSupabaseAdmin();
    const {
      companyId: requestedCompanyId,
      companyName,
      email,
      cpfCnpj,
      postalCode,
      value,
      plan
    } = req.body || {};

    if (!companyName || !email || !cpfCnpj) {
      return res.status(400).json({ error: 'Faltam dados obrigatorios para preparar o checkout de debito.' });
    }

    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    const company = await getCompanyById(supabase, companyId);
    const customer = await ensureAsaasCustomerForCompany(company, {
      companyName,
      email,
      cpfCnpj,
      postalCode
    });

    // O Asaas hospeda o formulario seguro na invoiceUrl.
    // Mantemos o usuario no sistema ate ele escolher abrir esse ambiente externo.
    const payment = await asaasRequest('/v3/payments', {
      method: 'POST',
      body: {
        customer: customer.id,
        billingType: 'UNDEFINED',
        value: Number(value || getMonthlyAmount()),
        dueDate: buildDueDate(),
        description: 'Clube Turismo Flow - Checkout seguro Asaas',
        externalReference: companyId
      }
    });

    await updateCompanyFromAsaasPayment(supabase, company, payment, {
      paymentMethod: 'debit_card',
      plan: plan || 'monthly',
      email,
      postalCode: normalizePostalCode(postalCode),
      cpfCnpj: normalizeTaxId(cpfCnpj)
    });

    await upsertAsaasInvoiceRecord(supabase, companyId, payment, {
      paymentMethod: 'debit_card'
    });

    return res.status(200).json({
      success: true,
      asaasCustomerId: customer.id,
      asaasPaymentId: payment.id,
      invoiceUrl: payment.invoiceUrl || null,
      checkoutUrl: payment.invoiceUrl || null,
      value: payment.value,
      dueDate: payment.dueDate || null,
      status: payment.status
    });
  } catch (error) {
    console.error('[Asaas] Erro ao criar checkout de debito:', error);
    return res.status(500).json({
      error: 'Falha ao criar o checkout seguro do Asaas.',
      details: String(error.message || error)
    });
  }
}
