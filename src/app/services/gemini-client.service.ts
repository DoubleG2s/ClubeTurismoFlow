import { Injectable } from '@angular/core';
import Groq from 'groq-sdk';
import { environment } from '../../environments/environment';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;
const MODEL = 'llama-3.3-70b-versatile';

export interface AiMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

@Injectable({ providedIn: 'root' })
export class GeminiClientService {
  private client = new Groq({
    apiKey: environment.groqApiKey,
    dangerouslyAllowBrowser: true
  });

  async generateText(
    systemPrompt: string,
    userMessage: string,
    history: AiMessage[] = [],
    jsonMode = false
  ): Promise<string> {
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: userMessage }
    ];

    return this.callWithRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: MODEL,
        messages,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
      });
      return response.choices[0].message.content ?? '';
    });
  }

  async generateWithTools(
    systemPrompt: string,
    userMessage: string,
    tool: AiToolDefinition
  ): Promise<Record<string, any>> {
    const messages: Groq.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    return this.callWithRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: MODEL,
        messages,
        tools: [{
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        }],
        tool_choice: { type: 'function', function: { name: tool.name } }
      });

      const toolCall = response.choices[0].message.tool_calls?.[0];
      if (!toolCall || toolCall.type !== 'function') {
        throw new Error('A IA não retornou o formato estruturado esperado.');
      }
      return JSON.parse(toolCall.function.arguments);
    });
  }

  private async callWithRetry<T>(fn: () => Promise<T>, attempt = 0): Promise<T> {
    try {
      return await fn();
    } catch (err: any) {
      const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.toLowerCase().includes('rate limit');
      if (is429 && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        return this.callWithRetry(fn, attempt + 1);
      }
      if (is429) throw new Error('Limite de uso da IA atingido. Tente novamente em alguns minutos.');
      throw err;
    }
  }
}
