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

  const { email, password, name } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Os campos email, password e name são obrigatórios.' });
  }

  try {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (error) {
      return res.status(400).json({ error: error.message });
    }

    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: data.user.id,
        name,
        company_id: adminProfile.profile.company_id,
        role: 'agent',
        updated_at: new Date().toISOString()
      });

    if (profileError) {
      return res.status(201).json({
        warning: 'Usuário criado mas o perfil não pôde ser atualizado: ' + profileError.message,
        userId: data.user.id
      });
    }

    return res.status(201).json({ success: true, userId: data.user.id });
  } catch (error) {
    return res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
};
