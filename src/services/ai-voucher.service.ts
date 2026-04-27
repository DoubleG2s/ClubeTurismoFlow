import { Injectable, inject } from '@angular/core';
import { PdfExtractorService } from './pdf-extractor.service';
import { environment } from '../environments/environment';
import { GoogleGenerativeAI, SchemaType, FunctionCallingMode, FunctionDeclaration } from '@google/generative-ai';

export interface VoucherExtractionResult {
  passageiros: string[];
  destino: string;
  data_ida: string;
  data_volta: string;
  reserva_voucher: string;
  voo_voucher: string;
  hotel_nome: string;
  hotel_localizador: string;
  notes_prefill: string; // Hotel Nome | Localizador: LOCATOR
}

@Injectable({
  providedIn: 'root'
})
export class AiVoucherService {
  private pdfExtractor = inject(PdfExtractorService);
  private genAI = new GoogleGenerativeAI(environment.geminiApiKey);
  
  async processVoucher(file: File): Promise<VoucherExtractionResult> {
    try {
      // 1. Extrair texto no cliente
      const text = await this.pdfExtractor.extractText(file);
      
      const extractFunctionDeclaration: FunctionDeclaration = {
        name: "extract_voucher",
        description: "Extrai dados estruturados de um voucher de viagem em PDF",
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            passageiros: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: "Lista de todos os passageiros identificados no voucher. NUNCA omita nenhum."
            },
            destino: {
              type: SchemaType.STRING,
              description: "Apenas o nome da cidade de destino, sem estado ou país."
            },
            data_ida: {
              type: SchemaType.STRING,
              description: "Data da viagem de ida ou check-in no formato DD/MM/AAAA."
            },
            data_volta: {
              type: SchemaType.STRING,
              description: "Data de retorno ou check-out no formato DD/MM/AAAA. Deixe vazio se não houver."
            },
            reserva_voucher: {
              type: SchemaType.STRING,
              description: "Código da reserva principal. DEVE conter exatamente 6 caracteres. Deixe vazio se não encontrar."
            },
            voo_voucher: {
              type: SchemaType.STRING,
              description: "Código do localizador do voo. DEVE conter exatamente 6 caracteres. Deixe vazio se não encontrar."
            },
            hotel_nome: {
              type: SchemaType.STRING,
              description: "Nome do hotel ou hospedagem. Deixe vazio se não houver."
            },
            hotel_localizador: {
              type: SchemaType.STRING,
              description: "Localizador do hotel. Deixe vazio se não houver. Procure primeiro por Localizador externo: ou códigos longos alfanuméricos perto do bloco do hotel."
            }
          },
          required: ["passageiros", "destino", "data_ida", "data_volta", "reserva_voucher", "voo_voucher", "hotel_nome", "hotel_localizador"]
        }
      };

      const model = this.genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        tools: [{ functionDeclarations: [extractFunctionDeclaration] }],
        toolConfig: { functionCallingConfig: { mode: FunctionCallingMode.ANY, allowedFunctionNames: ["extract_voucher"] } },
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

      const chat = model.startChat();
      const result = await chat.sendMessage(`Arquivo: ${file.name}\n\nConteúdo:\n${text}`);
      const call = result.response.functionCalls()?.[0];
      
      if (!call || call.name !== "extract_voucher") {
        throw new Error('A IA não retornou o formato estruturado esperado.');
      }

      return this.normalizeData(call.args);
    } catch (err: any) {
      // Retorna erro amigável (tratamento silencioso exigido pelas regras)
      throw new Error(err.message || 'Falha ao processar o voucher. Verifique o arquivo.');
    }
  }

  private normalizeData(data: any): VoucherExtractionResult {
    // Normalização extra do Frontend (defesa em profundidade)
    
    // Garantir passageiros array limpo
    let px = Array.isArray(data.passageiros) ? data.passageiros : [];
    px = px.map((p: string) => p.trim()).filter((p: string) => p.length > 0);
    // Remover duplicatas
    px = [...new Set(px)];

    // Códigos
    let reserva = (data.reserva_voucher || '').trim().toUpperCase();
    if (reserva.length !== 6) reserva = '';
    
    let voo = (data.voo_voucher || '').trim().toUpperCase();
    if (voo.length !== 6) voo = '';

    const hotel_nome = (data.hotel_nome || '').trim();
    const hotel_localizador = (data.hotel_localizador || '').trim();

    let notes_prefill = '';
    if (hotel_nome && hotel_localizador) {
      notes_prefill = `${hotel_nome} | Localizador: ${hotel_localizador}`;
    } else if (hotel_nome) {
      notes_prefill = hotel_nome;
    } else if (hotel_localizador) {
      notes_prefill = `Localizador do Hotel: ${hotel_localizador}`;
    }

    return {
      passageiros: px,
      destino: (data.destino || '').trim(),
      data_ida: (data.data_ida || '').trim(),
      data_volta: (data.data_volta || '').trim(),
      reserva_voucher: reserva,
      voo_voucher: voo,
      hotel_nome: hotel_nome,
      hotel_localizador: hotel_localizador,
      notes_prefill: notes_prefill
    };
  }
}
