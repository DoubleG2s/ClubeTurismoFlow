const {
  addCors,
  asaasRequest,
  createSupabaseAdmin,
  getCompanyById,
  resolveAuthorizedCompanyContext,
  updateCompanySubscription
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
    const supabase = createSupabaseAdmin();
    const { companyId: requestedCompanyId, asaasPaymentId } = req.body || {};

    if (!asaasPaymentId) {
      return res.status(400).json({ error: 'Informe o pagamento Asaas que deve ser cancelado.' });
    }

    const { companyId } = await resolveAuthorizedCompanyContext(req, supabase, requestedCompanyId);
    const company = await getCompanyById(supabase, companyId);

    if (company.asaas_payment_id && company.asaas_payment_id !== asaasPaymentId) {
      return res.status(403).json({ error: 'Este pagamento nao pertence a empresa autenticada.' });
    }

    await asaasRequest(`/v3/payments/${asaasPaymentId}`, {
      method: 'DELETE'
    });

    await updateCompanySubscription(supabase, companyId, {
      asaas_payment_id: null,
      payment_status: 'canceled',
      subscription_status: company.payment_status === 'paid' ? company.subscription_status : 'inactive',
      external_checkout_url: null
    });

    const { error: invoiceError } = await supabase
      .from('saas_invoices')
      .update({
        status: 'CANCELED',
        updated_at: new Date().toISOString()
      })
      .eq('company_id', companyId)
      .eq('asaas_payment_id', asaasPaymentId);

    if (invoiceError) {
      throw new Error(`Pagamento cancelado, mas nao foi possivel atualizar a fatura: ${invoiceError.message}`);
    }

    return res.status(200).json({
      success: true,
      status: 'CANCELED',
      message: 'Pagamento Pix cancelado com sucesso.'
    });
  } catch (error) {
    console.error('[Asaas] Erro ao cancelar pagamento:', error);
    return res.status(500).json({
      error: 'Falha ao cancelar o pagamento Pix.',
      details: String(error.message || error)
    });
  }
}

