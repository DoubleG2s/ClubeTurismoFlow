const {
  asaasRequest,
  createSupabaseAdmin,
  getCompanyByAsaasPaymentId,
  tryRecordWebhookEvent,
  updateCompanyFromAsaasPayment,
  updateCompanySubscription,
  upsertAsaasInvoiceRecord,
  validateAsaasWebhookToken
} = require('./_lib');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    if (!validateAsaasWebhookToken(req)) {
      return res.status(401).json({ error: 'Webhook Asaas sem token valido.' });
    }

    const supabase = createSupabaseAdmin();
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventId = event.id || `${event.event || 'event'}:${event.payment?.id || event.payment?.object || Date.now()}`;

    const wasRecorded = await tryRecordWebhookEvent(supabase, {
      id: eventId,
      provider: 'asaas',
      eventType: event.event || 'unknown',
      companyId: null,
      payload: event
    });

    if (!wasRecorded) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    if (!event?.payment?.id) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const company = await getCompanyByAsaasPaymentId(supabase, event.payment.id);

    if (!company) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const payment = await asaasRequest(`/v3/payments/${event.payment.id}`);

    await updateCompanyFromAsaasPayment(supabase, company, payment);
    await upsertAsaasInvoiceRecord(supabase, company.id, payment);

    if (event.event === 'PAYMENT_DELETED' || event.event === 'PAYMENT_CANCELED') {
      await updateCompanySubscription(supabase, company.id, {
        payment_provider: 'asaas',
        payment_status: 'canceled'
      });
    }

    // Estrutura pronta para Pix Automatico:
    // se o Asaas enviar o identificador da autorizacao em eventos futuros,
    // salvamos no cadastro da empresa para reaproveitar nos proximos ciclos.
    if (event.pixTransaction?.automaticPixAuthorization?.id) {
      await updateCompanySubscription(supabase, company.id, {
        pix_automatic_authorization_id: event.pixTransaction.automaticPixAuthorization.id
      });
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Asaas] Falha no webhook:', error);
    return res.status(400).json({
      error: 'Falha ao processar webhook do Asaas.',
      details: String(error.message || error)
    });
  }
}
