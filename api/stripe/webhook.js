const {
  createStripeClient,
  createSupabaseAdmin,
  getCompanyByCustomerId,
  getCompanyBySubscriptionId,
  readRawBody,
  syncCompanyFromSubscription,
  toDateOnly,
  toIsoFromUnix,
  tryRecordWebhookEvent,
  updateCompanySubscription,
  upsertInvoiceRecord
} = require('./_lib');

export const config = {
  api: {
    bodyParser: false
  }
};

async function buildVerifiedEvent(stripe, req) {
  const signature = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (signature && webhookSecret) {
    const rawBody = await readRawBody(req);
    return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  }

  const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  if (!body?.id) {
    throw new Error('Evento Stripe invalido.');
  }

  return stripe.events.retrieve(body.id);
}

async function persistStripeInvoice(supabase, companyId, invoice, paymentMethod = 'credit_card') {
  await upsertInvoiceRecord(supabase, companyId, {
    stripe_payment_id:
      typeof invoice.payment_intent === 'string' ? invoice.payment_intent : invoice.payment_intent?.id || invoice.id,
    stripe_subscription_id:
      typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id || null,
    payment_provider: 'stripe',
    payment_method: paymentMethod,
    value: typeof invoice.amount_due === 'number' ? invoice.amount_due / 100 : 0,
    status:
      invoice.status === 'paid'
        ? 'RECEIVED'
        : invoice.status === 'open' || invoice.status === 'draft'
          ? 'PENDING'
          : invoice.status === 'void'
            ? 'CANCELED'
            : 'OVERDUE',
    due_date: invoice.due_date ? toDateOnly(toIsoFromUnix(invoice.due_date)) : new Date().toISOString().slice(0, 10),
    payment_url: invoice.hosted_invoice_url || invoice.invoice_pdf || null,
    paid_at: invoice.status_transitions?.paid_at ? toIsoFromUnix(invoice.status_transitions.paid_at) : null
  });
}

async function resolveCompanyForInvoice(supabase, invoice) {
  if (invoice.subscription) {
    const bySubscription = await getCompanyBySubscriptionId(
      supabase,
      typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
    );

    if (bySubscription) {
      return bySubscription;
    }
  }

  if (invoice.customer) {
    return getCompanyByCustomerId(
      supabase,
      typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
    );
  }

  return null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const stripe = createStripeClient();
    const supabase = createSupabaseAdmin();
    const event = await buildVerifiedEvent(stripe, req);

    const wasRecorded = await tryRecordWebhookEvent(supabase, {
      id: event.id,
      provider: 'stripe',
      eventType: event.type,
      payload: event
    });

    if (!wasRecorded) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;

        if (session.mode !== 'subscription') {
          break;
        }

        const companyId = session.metadata?.companyId || session.client_reference_id || null;

        if (!companyId) {
          break;
        }

        await updateCompanySubscription(supabase, companyId, {
          stripe_customer_id: typeof session.customer === 'string' ? session.customer : session.customer?.id || null,
          stripe_subscription_id:
            typeof session.subscription === 'string' ? session.subscription : session.subscription?.id || null,
          subscription_plan: session.metadata?.plan || 'monthly',
          payment_provider: 'stripe',
          payment_method: 'credit_card',
          payment_status: 'pending'
        });
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const rawSubscription = event.data.object;
        const subscription = await stripe.subscriptions.retrieve(rawSubscription.id, {
          expand: ['latest_invoice', 'latest_invoice.lines']
        });

        const company =
          (await getCompanyBySubscriptionId(supabase, subscription.id)) ||
          (await getCompanyByCustomerId(
            supabase,
            typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
          ));

        if (!company) {
          break;
        }

        await syncCompanyFromSubscription(
          supabase,
          company.id,
          subscription,
          typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id || null
        );

        if (typeof subscription.latest_invoice === 'object' && subscription.latest_invoice?.id) {
          await persistStripeInvoice(supabase, company.id, subscription.latest_invoice);
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const company = await resolveCompanyForInvoice(supabase, invoice);

        if (!company) {
          break;
        }

        await persistStripeInvoice(supabase, company.id, invoice);

        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(
            typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id
          );

          await syncCompanyFromSubscription(
            supabase,
            company.id,
            subscription,
            typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id || null,
            invoice
          );
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const company = await resolveCompanyForInvoice(supabase, invoice);

        if (!company) {
          break;
        }

        await persistStripeInvoice(supabase, company.id, invoice);
        await updateCompanySubscription(supabase, company.id, {
          payment_provider: 'stripe',
          payment_method: 'credit_card',
          payment_status: 'failed',
          subscription_status: 'past_due'
        });
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const company =
          (await getCompanyBySubscriptionId(supabase, subscription.id)) ||
          (await getCompanyByCustomerId(
            supabase,
            typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
          ));

        if (!company) {
          break;
        }

        await updateCompanySubscription(supabase, company.id, {
          stripe_subscription_id: subscription.id,
          subscription_status: 'canceled',
          payment_provider: 'stripe',
          payment_method: 'credit_card',
          payment_status: 'canceled',
          next_due_date: null
        });
        break;
      }

      default:
        break;
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('[Stripe] Webhook invalido:', error);
    return res.status(400).json({
      error: 'Falha ao processar webhook da Stripe.',
      details: String(error.message || error)
    });
  }
}
