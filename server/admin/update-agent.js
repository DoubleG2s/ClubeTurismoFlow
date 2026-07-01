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

  // Remove fields the admin must not be able to change via this endpoint
  delete updates.company_id;
  delete updates.role;

  try {
    const { data: targetProfile, error: targetError } = await supabaseAdmin
      .from('profiles')
      .select('id, company_id')
      .eq('id', id)
      .eq('company_id', adminProfile.profile.company_id)
      .maybeSingle();

    if (targetError || !targetProfile) {
      return res.status(403).json({ error: 'Acesso negado.' });
    }

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
