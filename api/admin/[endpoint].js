const handlers = {
  'create-agent': require('../../server/admin/create-agent'),
  'delete-agent': require('../../server/admin/delete-agent'),
  'update-agent': require('../../server/admin/update-agent')
};

module.exports = async function dispatcher(req, res) {
  const endpoint = Array.isArray(req.query.endpoint) ? req.query.endpoint[0] : req.query.endpoint;
  const handler = handlers[endpoint];

  if (!handler) {
    return res.status(404).json({ error: 'Endpoint admin não encontrado.' });
  }

  return handler(req, res);
};
