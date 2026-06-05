const handlers = {
  'cancel-subscription': require('../../server/stripe/cancel-subscription'),
  'create-boleto-subscription': require('../../server/stripe/create-boleto-subscription'),
  'create-checkout-session': require('../../server/stripe/create-checkout-session'),
  'create-embedded-checkout-session': require('../../server/stripe/create-embedded-checkout-session'),
  'create-embedded-subscription-session': require('../../server/stripe/create-embedded-subscription-session'),
  'create-payment-element-session': require('../../server/stripe/create-payment-element-session'),
  'create-payment-method-update-session': require('../../server/stripe/create-payment-method-update-session'),
  'create-portal-session': require('../../server/stripe/create-portal-session'),
  'create-subscription': require('../../server/stripe/create-subscription'),
  'generate-boleto-payment': require('../../server/stripe/generate-boleto-payment'),
  'get-invoice-document': require('../../server/stripe/get-invoice-document'),
  'get-invoice-document-content': require('../../server/stripe/get-invoice-document-content'),
  'get-subscription-management': require('../../server/stripe/get-subscription-management'),
  'reactivate-subscription': require('../../server/stripe/reactivate-subscription'),
  'reconcile-company-status': require('../../server/stripe/reconcile-company-status'),
  'sync-company-subscription': require('../../server/stripe/sync-company-subscription'),
  'sync-invoice-history': require('../../server/stripe/sync-invoice-history'),
  'update-subscription-payment-method': require('../../server/stripe/update-subscription-payment-method'),
  webhook: require('../../server/stripe/webhook')
};

async function readJsonBody(req) {
  if (req.body !== undefined) {
    return req.body;
  }

  const chunks = [];

  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString('utf8').trim();
  return rawBody ? JSON.parse(rawBody) : {};
}

async function dispatcher(req, res) {
  const endpoint = Array.isArray(req.query.endpoint) ? req.query.endpoint[0] : req.query.endpoint;
  const handler = handlers[endpoint];

  if (!handler) {
    return res.status(404).json({ error: 'Endpoint Stripe nao encontrado.' });
  }

  if (endpoint !== 'webhook') {
    req.body = await readJsonBody(req);
  }

  return handler(req, res);
}

dispatcher.config = {
  api: {
    bodyParser: false
  }
};

module.exports = dispatcher;
