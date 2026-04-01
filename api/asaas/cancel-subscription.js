import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Configurando CORS básico
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  const { companyId, subscriptionId } = req.body;

  if (!companyId || !subscriptionId) {
    return res.status(400).json({ error: 'Faltam dados obrigatórios para cancelamento.' });
  }

  const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_ANON_KEY; 

  if (!ASAAS_API_KEY) { return res.status(500).json({ error: 'Falta variável ASAAS_API_KEY' }); }
  if (!SUPABASE_URL) { return res.status(500).json({ error: 'Falta variável SUPABASE_URL' }); }
  if (!SUPABASE_SERVICE_KEY) { return res.status(500).json({ error: 'Falta variável SUPABASE_ANON_KEY' }); }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const ASAAS_URL = ASAAS_API_KEY.includes('hmlg') 
      ? 'https://sandbox.asaas.com/api/v3'
      : 'https://api.asaas.com/v3';

    // 1. Cancela a assinatura no painel do Asaas utilizando o Endpoint DELETE
    const cancelResponse = await fetch(`${ASAAS_URL}/subscriptions/${subscriptionId}`, {
      method: 'DELETE',
      headers: {
        'access_token': ASAAS_API_KEY,
        'Content-Type': 'application/json'
      }
    });

    const cancelData = await cancelResponse.json();

    if (!cancelResponse.ok && cancelData.errors) {
       // Mesmo se der erro no asaas, às vezes ela já estava apagada.
       console.error('[Asaas] Cancellation Failed:', cancelData.errors);
       return res.status(400).json({ error: 'Falha ao cancelar no Gateway.', details: cancelData.errors });
    }

    // 2. Atualiza no Banco de Dados via RPC Segura
    await supabase.rpc('asaas_cancel_subscription', {
         p_company_id: companyId
    });

    return res.status(200).json({ 
      success: true,
      message: 'Assinatura cancelada com sucesso. Seu acesso foi suspenso.'
    });

  } catch (error) {
    console.error('Erro Fatal no cancelamento:', error);
    return res.status(500).json({ error: 'Erro de servidor', details: String(error) });
  }
}
