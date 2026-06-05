const handlers = {
  'cancel-payment': require('../../server/asaas/cancel-payment'),
  'cancel-subscription': require('../../server/asaas/cancel-subscription'),
  'create-debit-checkout': require('../../server/asaas/create-debit-checkout'),
  'create-pix-payment': require('../../server/asaas/create-pix-payment'),
  'payment-status': require('../../server/asaas/payment-status'),
  subscribe: require('../../server/asaas/subscribe'),
  webhook: require('../../server/asaas/webhook')
};

module.exports = async function dispatcher(req, res) {
  const endpoint = Array.isArray(req.query.endpoint) ? req.query.endpoint[0] : req.query.endpoint;
  const handler = handlers[endpoint];

  if (!handler) {
    return res.status(404).json({ error: 'Endpoint Asaas nao encontrado.' });
  }

  return handler(req, res);
};
