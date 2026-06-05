const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'MÃ©todo nÃ£o permitido.' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY nÃ£o configurada no servidor Vercel.' });
    }

    const { text, fileName } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'O texto do PDF Ã© obrigatÃ³rio.' });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const extractFunctionDeclaration = {
      name: "extract_voucher",
      description: "Extrai dados estruturados de um voucher de viagem em PDF",
      parameters: {
        type: "OBJECT",
        properties: {
          passageiros: {
            type: "ARRAY",
            items: { type: "STRING" },
            description: "Lista de todos os passageiros identificados no voucher. NUNCA omita nenhum."
          },
          destino: {
            type: "STRING",
            description: "Apenas o nome da cidade de destino, sem estado ou paÃ­s."
          },
          data_ida: {
            type: "STRING",
            description: "Data da viagem de ida ou check-in no formato DD/MM/AAAA."
          },
          data_volta: {
            type: "STRING",
            description: "Data de retorno ou check-out no formato DD/MM/AAAA. Deixe vazio se nÃ£o houver."
          },
          reserva_voucher: {
            type: "STRING",
            description: "CÃ³digo da reserva principal. DEVE conter exatamente 6 caracteres. Deixe vazio se nÃ£o encontrar."
          },
          voo_voucher: {
            type: "STRING",
            description: "CÃ³digo do localizador do voo. DEVE conter exatamente 6 caracteres. Deixe vazio se nÃ£o encontrar."
          },
          hotel_nome: {
            type: "STRING",
            description: "Nome do hotel ou hospedagem. Deixe vazio se nÃ£o houver."
          },
          hotel_localizador: {
            type: "STRING",
            description: "Localizador do hotel. Deixe vazio se nÃ£o houver. Procure primeiro por Localizador externo: ou cÃ³digos longos alfanumÃ©ricos perto do bloco do hotel."
          }
        },
        required: ["passageiros", "destino", "data_ida", "data_volta", "reserva_voucher", "voo_voucher", "hotel_nome", "hotel_localizador"]
      }
    };

    const chat = model.startChat({
      tools: [{ functionDeclarations: [extractFunctionDeclaration] }],
      toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["extract_voucher"] } },
      systemInstruction: `
        VocÃª Ã© um sistema especializado em extraÃ§Ã£o de dados de vouchers de turismo (Azul Viagens, CVC, etc).
        Priorize PRECISÃƒO. NUNCA invente dados. Se um campo nÃ£o estiver presente, retorne string vazia.
        Regras cruciais:
        - Passageiros: Extraia TODOS, sem duplicaÃ§Ãµes, sem omitir ninguÃ©m.
        - Destino: APENAS nome da cidade (sem UF, sem paÃ­s).
        - Datas: Formato obrigatÃ³rio DD/MM/AAAA.
        - CÃ³digos de Voo/Reserva: Devem ter EXATAMENTE 6 caracteres (ex: C3YB65). Se o cÃ³digo tiver mais ou menos que 6 caracteres, NÃƒO Ã‰ O VOUCHER DE VOO/RESERVA, deixe em branco.
        - Hotel Localizador: Se houver "Localizador externo:", esse Ã© o mais forte. Pode conter letras e nÃºmeros.
      `
    });

    const result = await chat.sendMessage(`Arquivo: ${fileName || 'voucher.pdf'}\n\nConteÃºdo:\n${text}`);
    const call = result.response.functionCalls()[0];
    
    if (call && call.name === "extract_voucher") {
      return res.status(200).json(call.args);
    } else {
      return res.status(500).json({ error: 'A IA nÃ£o retornou o formato estruturado esperado.' });
    }

  } catch (error) {
    // Silencia o erro real no console para nÃ£o sujar logs do server, mas retorna detalhe amigÃ¡vel pro front
    return res.status(500).json({ error: 'Erro ao processar o voucher via IA.', details: String(error) });
  }
}

