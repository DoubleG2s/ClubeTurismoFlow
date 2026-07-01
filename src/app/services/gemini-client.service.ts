import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { supabase } from './supabase';

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

  async generateText(
    systemPrompt: string,
    userMessage: string,
    history: AiMessage[] = [],
    jsonMode = false
  ): Promise<string> {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage }
    ];

    const data = await this.callWithRetry(() =>
      this.fetchGroq({ messages, model: MODEL, json_mode: jsonMode })
    );

    return data.content ?? '';
  }

  async generateWithTools(
    systemPrompt: string,
    userMessage: string,
    tool: AiToolDefinition
  ): Promise<Record<string, any>> {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage }
    ];

    const data = await this.callWithRetry(() =>
      this.fetchGroq({
        messages,
        model: MODEL,
        tools: [{
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
          }
        }],
        tool_choice: { type: 'function', function: { name: tool.name } }
      })
    );

    const toolCall = data.tool_calls?.[0];
    if (!toolCall || toolCall.type !== 'function') {
      throw new Error('A IA não retornou o formato estruturado esperado.');
    }
    return JSON.parse(toolCall.function.arguments);
  }

  private async fetchGroq(body: Record<string, any>): Promise<any> {
    const baseUrl = environment.apiBaseUrl || '';
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`${baseUrl}/api/groq`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (response.status === 401) {
      throw new Error('Sessão expirada. Faça login novamente.');
    }

    if (response.status === 429) {
      const err: any = new Error('Rate limit');
      err.status = 429;
      throw err;
    }

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      throw new Error(payload?.error || `Erro na API de IA: ${response.status}`);
    }

    return response.json();
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
