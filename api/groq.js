const Groq = require('groq-sdk');
const { addCors, requireAuthToken } = require('../server/stripe/_lib');

module.exports = async function handler(req, res) {
  addCors(res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método não permitido.' });

  try {
    await requireAuthToken(req);
  } catch {
    return res.status(401).json({ error: 'Não autorizado.' });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'GROQ_API_KEY não configurada no servidor.' });

  const { messages, model, json_mode, tools, tool_choice } = req.body;
  if (!messages || !model) return res.status(400).json({ error: 'Os campos messages e model são obrigatórios.' });

  try {
    const groq = new Groq({ apiKey });
    const response = await groq.chat.completions.create({
      model,
      messages,
      ...(json_mode ? { response_format: { type: 'json_object' } } : {}),
      ...(tools ? { tools, tool_choice: tool_choice ?? 'auto' } : {})
    });

    return res.status(200).json(response.choices[0].message);
  } catch (error) {
    const status = error?.status === 429 ? 429 : 500;
    return res.status(status).json({ error: error?.message || 'Erro ao processar requisição de IA.' });
  }
};
