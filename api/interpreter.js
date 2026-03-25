const { GoogleGenerativeAI } = require("@google/generative-ai");

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

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

    const { text, pdfBase64, pdfMimeType, history } = req.body;
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
      systemInstruction: `
        Você é um assistente operacional moderno do "Clube Turismo Flow".
        Sua função é interpretar as requisições, ler arquivos PDF como vouchers de pacotes de viagem, extrair os dados e acionar ações de sistema.
        Retorne SEMPRE um objeto JSON estrito com a interface:
        {
          "message": "Resposta amigável relatando a ação ou perguntando novos dados.",
          "action": {
             "type": "NONE" | "CREATE_RESERVATION" | "CREATE_QUOTE" | "APPLY_FILTER",
             "payload": {
                "destination": "Destino se houver",
                "passenger": "Nome completo ou do passageiro principal responsável se houver",
                "adults": numero,
                "children": numero,
                "dateStr": "Data identificada d/m/Y",
                "filter": "hoje" | "amanha"
             }
          }
        }
        
        Regras de Inteligência:
        1. Se faltar destino ou passageiro para uma reserva, retorne type "NONE" e o pergunte amigavelmente (Use o "message").
        2. Se você olhar no histórico e ver que o usuário acabou de responder os dados faltantes, crie a ação (CREATE_RESERVATION, etc).
        3. Se receber um arquivo MimeType PDF anexo, extraia o máximo de informações (Hospedagem, Voo, Passageiros, destino/hotel) como se fosse um analista, e dispare CREATE_RESERVATION pré-preenchendo tudo o que achou de relevante no payload (destination, etc) informando no "message" com sucesso os dados identificados.
        4. Transações de formulário NUNCA salvam, a action prepara a tela e o humano salva manualmente.
      `
    });

    const promptParts = [];
    if (text) {
      promptParts.push(text);
    }
    if (pdfBase64 && pdfMimeType) {
      promptParts.push({
        inlineData: {
          data: pdfBase64,
          mimeType: pdfMimeType
        }
      });
    }

    if (promptParts.length === 0) {
      return res.status(400).json({ error: 'Prompt vazio.' });
    }

    let responseText = '';
    
    // Tratativa de Histórico nativo no SDK
    if (history && Array.isArray(history) && history.length > 0) {
       const chat = model.startChat({ history });
       const result = await chat.sendMessage(promptParts);
       responseText = result.response.text();
    } else {
       const result = await model.generateContent(promptParts);
       responseText = result.response.text();
    }
    
    // Fallback de sanity check via limpeza de markdown json blocks se o llm alucinar aspas
    let cleanedResponse = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

    const parsedResponse = JSON.parse(cleanedResponse);
    return res.status(200).json(parsedResponse);
    
  } catch (error) {
    console.error('Gemini API Error:', error);
    return res.status(500).json({ error: 'Erro ao processar integração GenAI', details: String(error) });
  }
}
