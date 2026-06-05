const { GoogleGenerativeAI } = require("@google/generative-ai");

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*'); 
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

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

    const { text, pdfBase64, pdfMimeType, history } = req.body;
    
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
      },
      systemInstruction: `
        VocÃª Ã© um assistente operacional moderno do "Clube Turismo Flow".
        Sua funÃ§Ã£o Ã© interpretar as requisiÃ§Ãµes, ler arquivos PDF como vouchers de pacotes de viagem, extrair os dados e acionar aÃ§Ãµes de sistema.
        Retorne SEMPRE um objeto JSON estrito com a interface:
        {
          "message": "Resposta amigÃ¡vel relatando a aÃ§Ã£o ou perguntando novos dados.",
          "action": {
             "type": "NONE" | "CREATE_RESERVATION" | "CREATE_QUOTE" | "APPLY_FILTER",
             "payload": {
                "destination": "Destino se houver",
                "passenger": "Nome completo ou do passageiro principal responsÃ¡vel se houver",
                "adults": numero,
                "children": numero,
                "dateStr": "Data identificada d/m/Y",
                "filter": "hoje" | "amanha"
             }
          }
        }
        
        Regras de InteligÃªncia:
        1. Se faltar destino ou passageiro para uma reserva, retorne type "NONE" e o pergunte amigavelmente (Use o "message").
        2. Se vocÃª olhar no histÃ³rico e ver que o usuÃ¡rio acabou de responder os dados faltantes, crie a aÃ§Ã£o (CREATE_RESERVATION, etc).
        3. Se receber um arquivo MimeType PDF anexo, extraia o mÃ¡ximo de informaÃ§Ãµes (Hospedagem, Voo, Passageiros, destino/hotel) como se fosse um analista, e dispare CREATE_RESERVATION prÃ©-preenchendo tudo o que achou de relevante no payload (destination, etc) informando no "message" com sucesso os dados identificados.
        4. TransaÃ§Ãµes de formulÃ¡rio NUNCA salvam, a action prepara a tela e o humano salva manualmente.
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
    
    // Tratativa de HistÃ³rico nativo no SDK
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
    return res.status(500).json({ error: 'Erro ao processar integraÃ§Ã£o GenAI', details: String(error) });
  }
}

