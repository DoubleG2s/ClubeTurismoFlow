import { Injectable, signal } from '@angular/core';
import { environment } from '../environments/environment';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type AiIntentType =
  | 'NONE'
  | 'CREATE_RESERVATION' | 'EDIT_RESERVATION'
  | 'CREATE_QUOTE' | 'EDIT_QUOTE'
  | 'CREATE_HOTEL' | 'EDIT_HOTEL'
  | 'CREATE_CREDIT' | 'EDIT_CREDIT'
  | 'CREATE_FLIGHT' | 'EDIT_FLIGHT'
  | 'APPLY_FILTER'
  | 'CONFIRM_TAB_SWITCH';

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

const SYSTEM_PROMPT = [
  'Você é um assistente operacional moderno do "Clube Turismo Flow" (Copilot).',
  'Sua função é interpretar requisições, ler anexos (vouchers), extrair dados, sugerir ações e acionar as telas do sistema para CRIAR ou EDITAR registros.',
  '',
  'REGRAS CRÍTICAS DE SEGURANÇA E NEGÓCIO:',
  '1. NUNCA exclua dados. Em nenhuma hipótese gere ações de exclusão ("delete", "remover", "apagar"). Se solicitado, negue educadamente e explique que você não tem essa permissão.',
  '2. NÃO persista dados automaticamente. Seu papel é atuar como "preenchimento inteligente" de formulários. O usuário sempre confirma antes de salvar.',
  '3. Para solicitações de edição/atualização, utilize as actions do tipo EDIT_* e no payload informe os dados de busca (ex: nome, localizador, title) fornecidos pelo usuário, para que o sistema encontre o registro.',
  '',
  'Retorne SEMPRE um JSON válido com dois campos: "message" (string com feedback ao usuário) e "action" (objeto com "type" e "payload").',
  '',
  'Opções de ACTION TYPE disponíveis e campos do payload:',
  '- "NONE": Sem ação.',
  '- "CREATE_RESERVATION" ou "EDIT_RESERVATION": payload com destination, passengers (array de strings), date, return_date, reservation_number, flight_voucher, notes.',
  '- "CREATE_FLIGHT" ou "EDIT_FLIGHT": payload com locator, origin, flight_time.',
  '- "CREATE_HOTEL" ou "EDIT_HOTEL": payload com name, address, location, city, uf, country.',
  '- "CREATE_CREDIT" ou "EDIT_CREDIT" ou "CREATE_QUOTE" ou "EDIT_QUOTE": payload com customer, amount, title.',
  '- "APPLY_FILTER": payload com filter ("hoje" ou "amanha").',
  '- Nas edições (EDIT_*), adicione também "search_term" no payload para ajudar na busca.',
  '',
  'Regras EXTENSIVAS para Leitura de Documentos (Vouchers):',
  '1. VALIDAR PASSAGEIROS (CRÍTICO): Busque a lista COMPLETA de passageiros, geralmente localizados nas seções "Voucher de hotel", "Voucher de Voo" ou "Voucher de Serviço". Você DEVE retornar EXATAMENTE todos os passageiros. Se houver 4 pessoas, a array "passengers" DEVE ter 4 itens. Não omita de forma alguma o último passageiro.',
  '2. LOCALIZADOR DO VOO (flight_voucher): Procure especificamente pelas 6 letras/números que aparecem após textos como "Referência da reserva:" (Ex: GLWT2T). NÃO confunda com o número do voo (Ex: AD2507). O campo flight_voucher é reservado estritamente para o código de reserva.',
  '3. CAMPO DESTINO: Preencha estritamente com o NOME DA CIDADE. Não inclua estado, UF ou país. (Ex: "Maceió - AL - Brasil" vira apenas "Maceió").',
  '4. CAMPO OBSERVAÇÕES (notes): Preencha APENAS com o NOME DO HOTEL explícito e absolutamente MAIS NADA.',
  '5. O formulário não salva automaticamente, é apenas um preview (pre-fill) para a UI.',
  '',
  'Regras de Filtros e Listagem:',
].join('\n');

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
        model: 'gemini-2.5-flash',
        generationConfig: {
          responseMimeType: 'application/json',
        },
        systemInstruction: SYSTEM_PROMPT
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

      let data: AiResponse = { message: '' };
      try {
        let cleanedResponse = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        cleanedResponse = cleanedResponse.replace(/""([^"]+)""\s*:/g, '"$1":');
        data = JSON.parse(cleanedResponse) as AiResponse;
      } catch {
        throw new Error('Falha ao parsear o JSON retornado pela IA. Resposta crua: ' + responseText);
      }

      let messageContent = text;
      if (pdfBase64) messageContent += '\n[Arquivo PDF anexado]';

      this.chatHistory.push({ role: 'user', parts: [{ text: messageContent }] });
      this.chatHistory.push({ role: 'model', parts: [{ text: data.message || JSON.stringify(data.action) }] });

      if (this.chatHistory.length > 16) {
        this.chatHistory = this.chatHistory.slice(-16);
      }

      return data;

    } catch (err: any) {
      throw err;
    }
  }
}
