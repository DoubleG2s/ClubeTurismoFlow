const {
  addCors,
  asaasRequest,
  createSupabaseAdmin,
  fetchPixQrCode,
  getCompanyByAsaasPaymentId,
  getCompanyById,
  resolveAuthorizedCompanyContext,
  updateCompanyFromAsaasPayment,
  upsertAsaasInvoiceRecord
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
    const supabase = createSupabaseAdmin();
    const { companyId: requestedCompanyId, asaasPaymentId, paymentMethod } = req.body || {};

    if (!asaasPaymentId) {
      return res.status(400).json({ error: 'Informe o asaasPaymentId para consultar o status.' });
    }

    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    const company = (await getCompanyById(supabase, companyId)) || (await getCompanyByAsaasPaymentId(supabase, asaasPaymentId));

    if (!company || company.id !== companyId) {
      return res.status(404).json({ error: 'Pagamento Asaas nao encontrado para esta empresa.' });
    }

    const payment = await asaasRequest(`/v3/payments/${asaasPaymentId}`);
    const pixData =
      String(paymentMethod || payment.billingType || '').toUpperCase() === 'PIX'
        ? await fetchPixQrCode(asaasPaymentId).catch(() => null)
        : null;

    await updateCompanyFromAsaasPayment(supabase, company, payment, {
      paymentMethod: paymentMethod || null
    });

    await upsertAsaasInvoiceRecord(supabase, companyId, payment, {
      paymentMethod: paymentMethod || null,
      pixCopyPaste: pixData?.payload || null
    });

    return res.status(200).json({
      success: true,
      asaasPaymentId: payment.id,
      status: payment.status,
      invoiceUrl: payment.invoiceUrl || null,
      dueDate: payment.dueDate || null,
      paidAt: payment.clientPaymentDate || payment.paymentDate || null,
      value: payment.value,
      pixQrCode: pixData?.encodedImage || null,
      pixCopyPaste: pixData?.payload || null
    });
  } catch (error) {
    console.error('[Asaas] Erro ao consultar status do pagamento:', error);
    return res.status(500).json({
      error: 'Falha ao consultar o status do pagamento no Asaas.',
      details: String(error.message || error)
    });
  }
}
