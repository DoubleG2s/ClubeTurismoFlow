const { createClient } = require('@supabase/supabase-js');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const ASAAS_API_KEY = process.env.ASAAS_API_KEY;
  const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_ANON_KEY; 
  // O usuário solicitou usar a ANON_KEY como fallback absoluto.

  if (!ASAAS_API_KEY) {
     return res.status(500).json({ error: 'Configuração Incompleta: Variável ASAAS_API_KEY não encontrada no .env.local' });
  }
  if (!SUPABASE_URL) {
     return res.status(500).json({ error: 'Configuração Incompleta: Variável SUPABASE_URL não encontrada no .env.local' });
  }
  if (!SUPABASE_SERVICE_KEY) {
     return res.status(500).json({ error: 'Configuração Incompleta: Variável SUPABASE_ANON_KEY não encontrada no .env.local.' });
  }

  // Usamos Service Role Key para BYPASS do RLS (Segurança Backend)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { companyId, companyName, taxId, email, postalCode, value, creditCard } = req.body;

    if (!companyId || !companyName || !taxId || !creditCard) {
      return res.status(400).json({ error: 'Faltam dados obrigatórios. O Cartão de Crédito é exigido.' });
    }

    // 1. Busca a empresa via RPC Segura
    const { data: company, error: companyError } = await supabase.rpc('asaas_get_company', {
        p_company_id: companyId
    });

    if (companyError || !company) {
      return res.status(404).json({ error: 'Empresa (Tenant) não encontrada no sistema. (Erro RPC: ' + companyError?.message + ')' });
    }

    let customerId = company.asaas_customer_id;

    // 2. Se a empresa não tem cliente no Asaas, vamos criá-lo
    if (!customerId) {
      const customerRes = await fetch('https://sandbox.asaas.com/api/v3/customers', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY
        },
        body: JSON.stringify({
          name: companyName,
          email: email,
          cpfCnpj: taxId.replace(/\D/g, ''), // Limpa máscara
          postalCode: postalCode ? postalCode.replace(/\D/g, '') : undefined,
          externalReference: companyId // Para nosso rastreio
        })
      });

      const customerData = await customerRes.json();
      
      if (!customerRes.ok) {
        console.error('Asaas Customer Error:', customerData);
        return res.status(400).json({ error: 'Falha ao criar Cliente no Asaas', details: customerData.errors });
      }

      customerId = customerData.id;

      // Salva o Customer_ID de volta na tabela companies via RPC Segura
      await supabase.rpc('asaas_update_customer', {
         p_company_id: companyId,
         p_customer_id: customerId,
         p_tax_id: taxId
      });
    } // fim da criação de customer

    // 3. Verifica se a empresa já tem uma assinatura ativa
    // Se a assinatura anterior foi cancelada ('canceled'), nós liberamos a criação de uma assinatura NOVA por cima.
    if (company.asaas_subscription_id && company.subscription_status !== 'canceled') {
       return res.status(400).json({ error: 'Esta agência já possui uma assinatura criada. Pague a fatura correspondente.' });
    }

    // 4. Cria a Assinatura (SubscriptionMensal) pagando no Cartão
    const payloadSignature = {
        customer: customerId,
        billingType: 'CREDIT_CARD',
        value: value || 99.90,       // Valor da assinatura SaaS mensal Básico
        nextDueDate: new Date().toISOString().split('T')[0], // Começa hoje
        cycle: 'MONTHLY',            // Mensal
        description: 'Assinatura Mensal - Plataforma Clube Turismo Flow',
        creditCard: {
            holderName: creditCard.holderName,
            number: creditCard.number,
            expiryMonth: creditCard.expiryMonth,
            expiryYear: creditCard.expiryYear,
            ccv: creditCard.ccv
        },
        creditCardHolderInfo: {
            name: companyName,
            email: 'admin@' + companyName.toLowerCase().replace(/\s/g, '') + '.com',
            cpfCnpj: taxId.replace(/\D/g, ''),
            postalCode: postalCode ? postalCode.replace(/\D/g, '') : '01001000',
            addressNumber: '100',
            phone: '11999999999'
        }
    };

    const subscriptionRes = await fetch('https://sandbox.asaas.com/api/v3/subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY
      },
      body: JSON.stringify(payloadSignature)
    });

    const subData = await subscriptionRes.json();

    if (!subscriptionRes.ok) {
      console.error('Asaas Subscription Error:', subData);
      return res.status(400).json({ error: 'Falha ao criar Assinatura Mensal no Asaas', details: subData.errors });
    }

    // 5. Salva o ID da nova Assinatura no banco da Empresa
    await supabase.rpc('asaas_update_subscription_start', {
         p_company_id: companyId,
         p_sub_id: subData.id
    });

    // 6. Desbloqueio Otimista: Libera a empresa imediatamente por 30 dias na sequência.
    // Criar a data de expiração para +30 dias
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    const expiresAtIso = nextMonth.toISOString();

    await supabase.rpc('asaas_process_webhook', {
          p_secret: ASAAS_API_KEY,
          p_sub_id: subData.id,
          p_status: 'active',
          p_expires_at: expiresAtIso
    });

    // O retorno para o Front-End será de sucesso total
    return res.status(200).json({ 
      success: true,
      message: 'Cartão aprovado e Assinatura ativada com sucesso.',
      subscriptionId: subData.id
    });

  } catch (error) {
    console.error('Erro na Vercel Function (Subscribe):', error);
    return res.status(500).json({ error: 'Erro interno do servidor', details: String(error) });
  }
}
