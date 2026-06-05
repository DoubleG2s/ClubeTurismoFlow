const {
  addCors,
  asaasRequest,
  createSupabaseAdmin,
  getCompanyByAsaasPaymentId,
  mapAsaasStatusToPaymentStatus,
  tryRecordWebhookEvent,
  updateCompanyFromAsaasPayment,
  updateCompanySubscription,
  upsertAsaasInvoiceRecord,
  validateAsaasWebhookToken
} = require('./_lib');

function buildAsaasEventId(event) {
  if (event?.id) {
    return event.id;
  }

  const paymentId = event?.payment?.id || event?.payment?.object || 'sem-pagamento';
  const eventType = event?.event || 'unknown';
  const status = event?.payment?.status || 'sem-status';

  return `${eventType}:${paymentId}:${status}`;
}

async function resolveLatestPayment(event) {
  const paymentId = event?.payment?.id;

  if (!paymentId) {
    return event?.payment || null;
  }

  try {
    return await asaasRequest(`/v3/payments/${paymentId}`);
  } catch (error) {
    if (event?.payment) {
      return event.payment;
    }

    throw error;
  }
}

function shouldMarkCompanyCanceled(eventName, payment) {
  const status = String(payment?.status || '').toUpperCase();

  return [
    'PAYMENT_DELETED',
    'PAYMENT_CANCELED',
    'PAYMENT_REFUNDED',
    'PAYMENT_REFUND_REQUESTED',
    'PAYMENT_CREDIT_CARD_CAPTURE_REFUSED'
  ].includes(eventName) || [
    'CANCELED',
    'REFUNDED',
    'REFUND_REQUESTED'
  ].includes(status);
}

function shouldMarkCompanyPastDue(eventName, payment) {
  const status = String(payment?.status || '').toUpperCase();

  return eventName === 'PAYMENT_OVERDUE' || status === 'OVERDUE';
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
    if (!validateAsaasWebhookToken(req)) {
      return res.status(401).json({ error: 'Webhook Asaas sem token valido.' });
    }

    const supabase = createSupabaseAdmin();
    const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const eventName = event.event || 'unknown';
    const eventId = buildAsaasEventId(event);

    const wasRecorded = await tryRecordWebhookEvent(supabase, {
      id: eventId,
      provider: 'asaas',
      eventType: eventName,
      companyId: null,
      payload: event
    });

    if (!wasRecorded) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    if (!event?.payment?.id) {
      return res.status(200).json({ received: true, ignored: true });
    }

    const payment = await resolveLatestPayment(event);
    const paymentId = payment?.id || event.payment.id;
    const company = await getCompanyByAsaasPaymentId(supabase, paymentId);

    if (!company) {
      return res.status(200).json({ received: true, ignored: true });
    }

    await updateCompanyFromAsaasPayment(supabase, company, payment);
    await upsertAsaasInvoiceRecord(supabase, company.id, payment);

    if (shouldMarkCompanyCanceled(eventName, payment)) {
      await updateCompanySubscription(supabase, company.id, {
        payment_provider: 'asaas',
        payment_status: 'canceled',
        subscription_status: company.payment_status === 'paid' ? company.subscription_status : 'inactive',
        external_checkout_url: null
      });
    } else if (shouldMarkCompanyPastDue(eventName, payment)) {
      await updateCompanySubscription(supabase, company.id, {
        payment_provider: 'asaas',
        payment_status: mapAsaasStatusToPaymentStatus(payment.status),
        subscription_status: 'past_due'
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

