const { addCors, createSupabaseAdmin, requireAdminProfile } = require('../stripe/_lib');

module.exports = async function handler(req, res) {
  addCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  const supabaseAdmin = createSupabaseAdmin();

  let adminProfile;
  try {
    adminProfile = await requireAdminProfile(req, supabaseAdmin);
  } catch (err) {
    return res.status(err.statusCode || 401).json({ error: err.message });
  }

  const { id, ...updates } = req.body;
  if (!id) {
    return res.status(400).json({ error: 'O campo id é obrigatório.' });
  }

  try {
    const { error } = await supabaseAdmin
      .from('profiles')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao atualizar usuário.' });
  }
};
