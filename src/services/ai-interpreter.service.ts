import { Injectable, signal } from '@angular/core';
import { environment } from '../environments/environment';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type AiIntentType = 'NONE' | 'CREATE_RESERVATION' | 'CREATE_QUOTE' | 'APPLY_FILTER' | 'CONFIRM_TAB_SWITCH';

export interface AiAction {
  type: AiIntentType;
  payload?: any;
}

export interface AiResponse {
  message: string;
  action?: AiAction;
}

type ConversationState = 'IDLE' | 'AWAITING_TAB_SWITCH_CONFIRMATION';

interface HistoryRecord {
  role: 'user' | 'model';
  parts: { text: string }[];
}

@Injectable({
  providedIn: 'root'
})
export class AiInterpreterService {
  private currentState = signal<ConversationState>('IDLE');
  private pendingAction = signal<AiAction | null>(null);
  private chatHistory: HistoryRecord[] = [];
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(environment.geminiApiKey);
  }

  public blockForTabConfirmation(pendingReq: AiAction): AiResponse {
    this.currentState.set('AWAITING_TAB_SWITCH_CONFIRMATION');
    this.pendingAction.set(pendingReq);
    return {
      message: 'Você tem um formulário de cadastro em andamento. Deseja descartar as alterações e mudar de tela?'
    };
  }

  public async processMessageVercel(text: string, pdfBase64?: string, pdfMimeType?: string): Promise<AiResponse> {
    const lowerText = text ? text.toLowerCase() : '';
    const state = this.currentState();

    if (state === 'AWAITING_TAB_SWITCH_CONFIRMATION') {
      const confirmWords = ['sim', 'pode', 'quero', 'descartar', 'ok', 'prosseguir', 'claro'];
      if (confirmWords.some(w => lowerText.includes(w))) {
        const action: AiAction = { type: 'CONFIRM_TAB_SWITCH', payload: this.pendingAction() };
        this.currentState.set('IDLE');
        this.pendingAction.set(null);
        return { message: 'Ok, descartando formulário e abrindo rápida a tela...', action };
      } else {
        this.currentState.set('IDLE');
        this.pendingAction.set(null);
        return { message: 'Entendido. Abortei a mudança de telas para salvar seus dados do formulário.' };
      }
    }

    try {
      const model = this.genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
        },
        systemInstruction: `
        Você é um assistente operacional moderno do "Clube Turismo Flow".
        Sua função é interpretar requisições, ler anexos PDF, extrair os dados e acionar ações no sistema.
        Retorne SEMPRE um objeto JSON estrito com a interface:
        {
          "message": "Resposta amigável relatando a ação ou perguntando novos dados.",
          "action": {
             "type": "NONE" | "CREATE_RESERVATION" | "CREATE_QUOTE" | "APPLY_FILTER",
             "payload": {
                "destination": "Destino se houver",
                "passenger": "Nome do passageiro principal se houver",
                "adults": numero,
                "children": numero,
                "dateStr": "Data identificada"
             }
          }
        }
        
        Regras de Inteligência:
        1. Se faltar dados vitais e for o primeiro turno, retorne type "NONE" pedindo civilizadamente ("message").
        2. Se ver no histórico que o usuário acaba de responder à uma pergunta sua, funde isso com a memória e crie o payload real.
        3. Se receber anexo PDF, atue como um Operador de Viagem lendo um voucher. Encontre destino, data, hotel e passageiros. Acione o CREATE_RESERVATION pré-preenchendo todos os achados e diga na sua "message" o que identificou.
        `
      });

      const promptParts: any[] = [];
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
        throw new Error('O prompt está vazio.');
      }

      let responseText = '';
      if (this.chatHistory.length > 0) {
         const chat = model.startChat({ history: this.chatHistory });
         const result = await chat.sendMessage(promptParts);
         responseText = result.response.text();
      } else {
         const result = await model.generateContent(promptParts);
         responseText = result.response.text();
      }
      
      let data: AiResponse;
      try {
        const cleanedResponse = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        data = JSON.parse(cleanedResponse) as AiResponse;
      } catch (e: any) {
        throw new Error('Falha ao parsear o JSON retornado pela IA. Verifique as aspas. Resposta crua: ' + responseText);
      }

      let messageContent = text;
      if (pdfBase64) messageContent += '\n[Arquivo PDF anexado]';
      
      this.chatHistory.push({ role: 'user', parts: [{ text: messageContent }] });
      this.chatHistory.push({ role: 'model', parts: [{ text: data.message || JSON.stringify(data.action) }] });

      if (this.chatHistory.length > 16) {
        this.chatHistory = this.chatHistory.slice(-16);
      }

      return data;
      
    } catch (err) {
      console.error('Gemini API Error no Frontend:', err);
      throw err;
    }
  }
}
