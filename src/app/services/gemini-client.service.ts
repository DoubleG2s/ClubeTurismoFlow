import { Injectable } from '@angular/core';
import { GoogleGenerativeAI, GenerativeModel, ModelParams } from '@google/generative-ai';
import { environment } from '../../environments/environment';

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;

@Injectable({ providedIn: 'root' })
export class GeminiClientService {
  private genAI = new GoogleGenerativeAI(environment.geminiApiKey);

  getModel(params: ModelParams): GenerativeModel {
    return this.genAI.getGenerativeModel(params);
  }

  async generateWithRetry(
    model: GenerativeModel,
    prompt: Parameters<GenerativeModel['generateContent']>[0],
    attempt = 0
  ): Promise<ReturnType<GenerativeModel['generateContent']>> {
    try {
      return await model.generateContent(prompt);
    } catch (err: any) {
      const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.toLowerCase().includes('quota');
      if (is429 && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        return this.generateWithRetry(model, prompt, attempt + 1);
      }
      if (is429) {
        throw new Error('Limite de uso da IA atingido. Tente novamente em alguns minutos.');
      }
      throw err;
    }
  }

  async sendMessageWithRetry(
    chat: ReturnType<GenerativeModel['startChat']>,
    message: Parameters<ReturnType<GenerativeModel['startChat']>['sendMessage']>[0],
    attempt = 0
  ): Promise<ReturnType<ReturnType<GenerativeModel['startChat']>['sendMessage']>> {
    try {
      return await chat.sendMessage(message);
    } catch (err: any) {
      const is429 = err?.status === 429 || err?.message?.includes('429') || err?.message?.toLowerCase().includes('quota');
      if (is429 && attempt < MAX_RETRIES) {
        const delay = BASE_DELAY_MS * Math.pow(2, attempt);
        await new Promise(r => setTimeout(r, delay));
        return this.sendMessageWithRetry(chat, message, attempt + 1);
      }
      if (is429) {
        throw new Error('Limite de uso da IA atingido. Tente novamente em alguns minutos.');
      }
      throw err;
    }
  }
}
