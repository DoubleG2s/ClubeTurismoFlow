const { createClient } = require('@supabase/supabase-js');

export default async function handler(req, res) {
  // Webhooks geralmente são POST e não dependem de CORS de browser
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL; 
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_ANON_KEY; 
  const ASAAS_API_KEY = process.env.ASAAS_API_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ASAAS_API_KEY) {
    console.error('Webhook: Missing Environment Variables.');
    return res.status(500).json({ error: 'Configuração do servidor incompleta.' });
  }

  // Fallback pra ANON KEY, compensado com RPC
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const asaasEvent = req.body;
    console.log('[Webhook Asaas] Recebido evento:', asaasEvent.event);

    const payment = asaasEvent.payment;
    if (!payment || !payment.subscription) {
       // O evento não é sobre uma cobrança de assinatura.
       return res.status(200).json({ received: true, ignored: true, reason: 'Not a subscription payment' });
    }

    // 0. Pegamos o id da empresa baseado no ID ds assinatura (via RPC)
    const { data: company, error } = await supabase.rpc('asaas_get_company_by_sub', {
        p_sub_id: payment.subscription
    });

    if (error || !company) {
       console.error('[Webhook Asaas] Empresa não encontrada para a assinatura', payment.subscription);
       return res.status(404).json({ error: 'Empresa não encontrada no banco de dados' });
    }

    // 1. Atualizar histórico da fatura (Tabela saas_invoices)
    const statusMap = {
       'PENDING': 'PENDING',
       'RECEIVED': 'RECEIVED',
       'CONFIRMED': 'RECEIVED',
       'OVERDUE': 'OVERDUE',
       'DELETED': 'CANCELED',
    };
    
    const dbStatus = statusMap[payment.status] || payment.status;

    // Fazer Upsert da fatura via RPC Segura
    const { error: invoiceError } = await supabase.rpc('asaas_upsert_invoice', {
          p_company_id: company.id,
          p_asaas_payment_id: payment.id,
          p_asaas_sub_id: payment.subscription,
          p_value: payment.value,
          p_status: dbStatus,
          p_due_date: payment.dueDate,
          p_payment_url: payment.invoiceUrl || payment.bankSlipUrl || null
    });

    if (invoiceError) {
      console.warn('[Webhook Asaas] Erro ao salvar fatura:', invoiceError);
    }

    // 2. Atualizar status da conta da Agência (Tabela companies)
    let companyStatus = company.subscription_status; // Mantem atual
    let validUntil = null;

    if (asaasEvent.event === 'PAYMENT_RECEIVED' || asaasEvent.event === 'PAYMENT_CONFIRMED') {
       companyStatus = 'active';
       
       // Garante 1 mês de acesso após a data de vencimento paga.
       const dueDate = new Date(payment.dueDate);
       dueDate.setMonth(dueDate.getMonth() + 1);
       validUntil = dueDate.toISOString(); // Timestamp
    }
    else if (asaasEvent.event === 'PAYMENT_OVERDUE' || asaasEvent.event === 'PAYMENT_REPROVED') {
       companyStatus = 'past_due';
    }

    // Só atualizamos no banco se houve mudança para manter performance e não reescrever datas à toa
    if (companyStatus !== company.subscription_status || validUntil) {
       const updatePayload = { subscription_status: companyStatus };
       if (validUntil) updatePayload.subscription_expires_at = validUntil;

       // Atualiza a assinatura. Passa o ASAAS_API_KEY como senha secreta para o Postgres verificar.
       await supabase.rpc('asaas_process_webhook', {
          p_secret: ASAAS_API_KEY,
          p_sub_id: payment.subscription,
          p_status: companyStatus,
          p_expires_at: validUntil
       });
         
       console.log(`[Webhook Asaas] Conta ${company.id} atualizada para ${companyStatus}`);
    }

    return res.status(200).json({ processed: true });

  } catch (error) {
    console.error('[Webhook Asaas] Erro fatal:', error);
    return res.status(500).json({ error: 'Falha durante o webhook', details: String(error) });
  }
}
