const {
  addCors,
  asaasRequest,
  createSupabaseAdmin,
  ensureAsaasCustomerForCompany,
  fetchPixQrCode,
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

function resolvePixAmount(value) {
  const amount = Number(value || getMonthlyAmount());
  return Math.max(Number.isFinite(amount) ? amount : 0, 5);
}

function buildDueDate() {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 1);
  return dueDate.toISOString().slice(0, 10);
}

function normalizeErrorText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

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
      return res.status(400).json({ error: 'Faltam dados obrigatorios para gerar o Pix.' });
    }

    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    const company = await getCompanyById(supabase, companyId);
    const customer = await ensureAsaasCustomerForCompany(company, {
      companyName,
      email,
      cpfCnpj,
      postalCode
    });

    const payment = await asaasRequest('/v3/payments', {
      method: 'POST',
      body: {
        customer: customer.id,
        billingType: 'PIX',
        value: resolvePixAmount(value),
        dueDate: buildDueDate(),
        description: 'Clube Turismo Flow - Acesso mensal via Pix',
        externalReference: companyId
      }
    });

    if (String(payment.billingType || '').toUpperCase() !== 'PIX') {
      throw new Error('A cobranca foi criada no Asaas, mas nao voltou habilitada para Pix. Confira se a conta Asaas esta liberada para receber Pix neste ambiente.');
    }

    const pixData = await fetchPixQrCode(payment.id);

    await updateCompanyFromAsaasPayment(supabase, company, payment, {
      paymentMethod: 'pix',
      plan: plan || 'monthly',
      email,
      postalCode: normalizePostalCode(postalCode),
      cpfCnpj: normalizeTaxId(cpfCnpj)
    });

    await upsertAsaasInvoiceRecord(supabase, companyId, payment, {
      paymentMethod: 'pix',
      pixCopyPaste: pixData.payload
    });

    return res.status(200).json({
      success: true,
      asaasCustomerId: customer.id,
      asaasPaymentId: payment.id,
      invoiceUrl: payment.invoiceUrl || null,
      pixQrCode: pixData.encodedImage || null,
      pixCopyPaste: pixData.payload || null,
      dueDate: payment.dueDate || null,
      value: payment.value,
      status: payment.status
    });
  } catch (error) {
    console.error('[Asaas] Erro ao criar cobranca Pix:', error);
    const details = String(error.message || error);
    const normalizedDetails = normalizeErrorText(details);
    const statusCode =
      normalizedDetails.includes('nao pertence a este ambiente')
        ? 400
        : normalizedDetails.includes('nao permite pagamentos via pix') ||
            normalizedDetails.includes('nao voltou habilitada para pix') ||
            normalizedDetails.includes('nao esta habilitada para gerar pix')
          ? 409
          : 500;

    const message =
      statusCode === 400
        ? 'A chave do Asaas nao pertence ao ambiente configurado.'
        : statusCode === 409
          ? 'A conta Asaas atual nao esta habilitada para receber Pix neste ambiente. Ative Pix na conta Asaas ou use outro metodo de pagamento.'
          : 'Falha ao criar a cobranca Pix no Asaas.';

    return res.status(statusCode).json({
      error: message,
      details
    });
  }
}

