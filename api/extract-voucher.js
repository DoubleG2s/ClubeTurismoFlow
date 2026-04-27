const { GoogleGenerativeAI } = require("@google/generative-ai");

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS,POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método não permitido.' });
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY não configurada no servidor Vercel.' });
    }

    const { text, fileName } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'O texto do PDF é obrigatório.' });
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
            description: "Apenas o nome da cidade de destino, sem estado ou país."
          },
          data_ida: {
            type: "STRING",
            description: "Data da viagem de ida ou check-in no formato DD/MM/AAAA."
          },
          data_volta: {
            type: "STRING",
            description: "Data de retorno ou check-out no formato DD/MM/AAAA. Deixe vazio se não houver."
          },
          reserva_voucher: {
            type: "STRING",
            description: "Código da reserva principal. DEVE conter exatamente 6 caracteres. Deixe vazio se não encontrar."
          },
          voo_voucher: {
            type: "STRING",
            description: "Código do localizador do voo. DEVE conter exatamente 6 caracteres. Deixe vazio se não encontrar."
          },
          hotel_nome: {
            type: "STRING",
            description: "Nome do hotel ou hospedagem. Deixe vazio se não houver."
          },
          hotel_localizador: {
            type: "STRING",
            description: "Localizador do hotel. Deixe vazio se não houver. Procure primeiro por Localizador externo: ou códigos longos alfanuméricos perto do bloco do hotel."
          }
        },
        required: ["passageiros", "destino", "data_ida", "data_volta", "reserva_voucher", "voo_voucher", "hotel_nome", "hotel_localizador"]
      }
    };

    const chat = model.startChat({
      tools: [{ functionDeclarations: [extractFunctionDeclaration] }],
      toolConfig: { functionCallingConfig: { mode: "ANY", allowedFunctionNames: ["extract_voucher"] } },
      systemInstruction: `
        Você é um sistema especializado em extração de dados de vouchers de turismo (Azul Viagens, CVC, etc).
        Priorize PRECISÃO. NUNCA invente dados. Se um campo não estiver presente, retorne string vazia.
        Regras cruciais:
        - Passageiros: Extraia TODOS, sem duplicações, sem omitir ninguém.
        - Destino: APENAS nome da cidade (sem UF, sem país).
        - Datas: Formato obrigatório DD/MM/AAAA.
        - Códigos de Voo/Reserva: Devem ter EXATAMENTE 6 caracteres (ex: C3YB65). Se o código tiver mais ou menos que 6 caracteres, NÃO É O VOUCHER DE VOO/RESERVA, deixe em branco.
        - Hotel Localizador: Se houver "Localizador externo:", esse é o mais forte. Pode conter letras e números.
      `
    });

    const result = await chat.sendMessage(`Arquivo: ${fileName || 'voucher.pdf'}\n\nConteúdo:\n${text}`);
    const call = result.response.functionCalls()[0];
    
    if (call && call.name === "extract_voucher") {
      return res.status(200).json(call.args);
    } else {
      return res.status(500).json({ error: 'A IA não retornou o formato estruturado esperado.' });
    }

  } catch (error) {
    // Silencia o erro real no console para não sujar logs do server, mas retorna detalhe amigável pro front
    return res.status(500).json({ error: 'Erro ao processar o voucher via IA.', details: String(error) });
  }
}
