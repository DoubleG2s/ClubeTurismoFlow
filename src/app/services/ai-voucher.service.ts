import { Injectable, inject } from '@angular/core';
import { PdfExtractorService } from './pdf-extractor.service';
import { GeminiClientService } from './gemini-client.service';
import { ProductType } from '../models/reservation';

export interface VoucherExtractionResult {
  passageiros: string[];
  destino: string;
  data_ida: string;
  data_volta: string;
  reserva_voucher: string;
  voo_voucher: string;
  voo_origem: string;
  voo_destino: string;
  voo_companhia: string;
  fornecedor: string;
  hotel_nome: string;
  hotel_localizador: string;
  hotel_observacoes: string;
  notes_prefill: string;
  product_type: ProductType;
}

const SYSTEM_PROMPT = `Você é um sistema especializado em extração de dados de vouchers de turismo (Azul Viagens, CVC, Submarino Viagens, etc).
Priorize PRECISÃO ABSOLUTA. NUNCA invente dados. Se um campo não estiver presente no documento, retorne string vazia.

=== SEÇÃO: VOUCHER DE VOO ===
Procure no PDF por um bloco com o cabeçalho "VOUCHER DE VOO" (pode aparecer como "Voucher de Voo", "VOUCHER VOO" ou variações). Dentro desse bloco extraia:

- VOO_VOUCHER (localizador do voo): procure especificamente pelo texto "Referência da reserva:" e extraia o código imediatamente após ele.
  Esse código tem EXATAMENTE 6 caracteres alfanuméricos (ex: GLWT2T, AB1234, XY98ZT).
  Se o código encontrado tiver tamanho diferente de 6, descarte e retorne vazio.
  ATENÇÃO: NÃO confunda com o número do voo (ex: AD2507, G31234) — número de voo não é localizador.
  Se o texto "Referência da reserva:" não existir, procure por "Localizador:", "Booking ref:" ou equivalente dentro do bloco VOUCHER DE VOO.

- VOO_ORIGEM: procure pelo texto "Saída: " dentro da seção VOUCHER DE VOO e extraia a cidade ou código IATA imediatamente após.
  Se encontrar o código IATA (3 letras maiúsculas como GRU, RAO, VCP), use-o diretamente.
  Se aparecer nome da cidade junto ao código (ex: "Ribeirão Preto (RAO)"), extraia apenas as 3 letras do código IATA.

- VOO_DESTINO: código IATA de 3 letras maiúsculas da cidade/aeroporto de DESTINO do voo (ex: MCZ, FOR, SSA).
  Se aparecer o nome da cidade junto ao código, use APENAS as 3 letras do código IATA.


=== SEÇÃO: VOUCHER DE HOTEL ===
Localize a seção identificada como "Voucher de Hotel" no PDF e extraia:

- HOTEL_NOME: nome completo do hotel exatamente como aparece no documento.

- HOTEL_LOCALIZADOR: siga esta ordem de prioridade estrita:
  PRIORIDADE 1 — Se existir um campo "Localizador externo" no documento, use ESSE valor (pode ter letras e números, qualquer tamanho).
  PRIORIDADE 2 — Se não houver "Localizador externo", use o valor de "Nº da reserva", "Nº reserva", "Reservation ID", "Booking ID" ou equivalente.
  Se nenhum dos dois existir, retorne vazio.

- HOTEL_OBSERVACOES: extraia a quantidade de hóspedes e formate EXATAMENTE assim: "X adulto(s), Y criança(s)".
  Essa informação geralmente aparece após o tipo de quarto e o regime alimentar (ex: "2 adultos, 0 crianças").
  Se crianças não forem mencionadas no documento, retorne "0 crianças" para esse campo.
  Exemplo de saída: "2 adultos, 1 criança" ou "3 adultos, 0 crianças".

=== REGRAS GERAIS ===
- Passageiros: extraia TODOS os nomes da lista de passageiros, sem duplicações e sem omitir ninguém.
- Destino: APENAS o nome da cidade de destino principal (sem UF, sem país).
- Datas: formato obrigatório DD/MM/AAAA.
- RESERVA_VOUCHER (código da reserva principal): EXATAMENTE 6 caracteres alfanuméricos. Ignore qualquer outro código.`;

@Injectable({
  providedIn: 'root'
})
export class AiVoucherService {
  private pdfExtractor = inject(PdfExtractorService);
  private gemini = inject(GeminiClientService);

  async processVoucher(file: File): Promise<VoucherExtractionResult> {
    try {
      const text = await this.pdfExtractor.extractText(file);

      const args = await this.gemini.generateWithTools(
        SYSTEM_PROMPT,
        `Arquivo: ${file.name}\n\nConteúdo:\n${text}`,
        {
          name: 'extract_voucher',
          description: 'Extrai dados estruturados de um voucher de viagem em PDF, separando as seções de voo e hotel.',
          parameters: {
            type: 'object',
            properties: {
              passageiros: {
                type: 'array',
                items: { type: 'string' },
                description: 'Lista completa de todos os passageiros. NUNCA omita nenhum.'
              },
              destino: {
                type: 'string',
                description: 'Nome da cidade de destino principal, sem UF ou país. Ex: "Maceió", "Cancún".'
              },
              data_ida: {
                type: 'string',
                description: 'Data de ida ou check-in no formato DD/MM/AAAA.'
              },
              data_volta: {
                type: 'string',
                description: 'Data de retorno ou check-out no formato DD/MM/AAAA. Vazio se não houver.'
              },
              reserva_voucher: {
                type: 'string',
                description: 'Código da reserva principal com EXATAMENTE 6 caracteres alfanuméricos. Retorne vazio se não encontrar ou se o código tiver tamanho diferente de 6.'
              },
              voo_voucher: {
                type: 'string',
                description: 'Localizador do voo extraído da seção "VOUCHER DE VOO". Procure pelo texto "Referência da reserva:" e use o código logo após — deve ter EXATAMENTE 6 caracteres alfanuméricos (ex: GLWT2T, AB1234). Se não houver "Referência da reserva:", tente "Localizador:" ou "Booking ref:" dentro do mesmo bloco. NUNCA usar número de voo (ex: AD2507). Retorne vazio se não encontrar ou se o código tiver tamanho diferente de 6.'
              },
              voo_origem: {
                type: 'string',
                description: 'Código IATA de 3 letras maiúsculas da origem do voo. Procure pelo texto "Saída: " na seção VOUCHER DE VOO e extraia o código IATA logo após (ex: RAO, GRU, VCP). Se aparecer nome da cidade junto ao código (ex: "Ribeirão Preto (RAO)"), use apenas as 3 letras.'
              },
              voo_destino: {
                type: 'string',
                description: 'Código IATA de 3 letras maiúsculas do destino do voo (ex: MCZ, FOR, SSA). Extrair somente as 3 letras, ignorando o nome da cidade.'
              },
              hotel_nome: {
                type: 'string',
                description: 'Nome completo do hotel conforme aparece na seção "Voucher de Hotel". Vazio se não houver hotel.'
              },
              hotel_localizador: {
                type: 'string',
                description: 'Localizador do hotel com prioridade estrita: (1) valor de "Localizador externo" se existir; (2) senão, valor de "Nº da reserva", "Reservation ID", "Booking ID" ou equivalente. Retorne vazio se nenhum existir.'
              },
              hotel_observacoes: {
                type: 'string',
                description: 'Quantidade de hóspedes formatada como "X adulto(s), Y criança(s)". Ex: "2 adultos, 1 criança", "3 adultos, 0 crianças". Se crianças não forem mencionadas, use 0. Vazio se não houver hotel.'
              }
            },
            required: [
              'passageiros', 'destino', 'data_ida', 'data_volta',
              'reserva_voucher', 'voo_voucher', 'voo_origem', 'voo_destino',
              'hotel_nome', 'hotel_localizador', 'hotel_observacoes'
            ]
          }
        }
      );

      return this.normalizeData(args);
    } catch (err: any) {
      throw new Error(err.message || 'Falha ao processar o voucher. Verifique o arquivo.');
    }
  }

  private normalizeData(data: any): VoucherExtractionResult {
    let px = Array.isArray(data.passageiros) ? data.passageiros : [];
    px = px.map((p: string) => p.trim()).filter((p: string) => p.length > 0);
    px = [...new Set(px)];

    let reserva = (data.reserva_voucher || '').trim().toUpperCase();
    if (reserva.length !== 6) reserva = '';

    let voo = (data.voo_voucher || '').trim().toUpperCase();
    if (voo.length !== 6) voo = '';

    const voo_origem = (data.voo_origem || '').trim().toUpperCase().slice(0, 3);
    const voo_destino = (data.voo_destino || '').trim().toUpperCase().slice(0, 3);
    const voo_companhia = 'AZUL LINHAS AÉREAS';
    const fornecedor = 'AZUL VIAGENS';

    const hotel_nome = (data.hotel_nome || '').trim();
    const hotel_localizador = (data.hotel_localizador || '').trim() || reserva;
    const hotel_observacoes = (data.hotel_observacoes || '').trim();

    const notes_prefill = hotel_observacoes;

    let product_type = ProductType.PACOTE;
    if (voo && !hotel_nome) {
      product_type = ProductType.VOO;
    } else if (hotel_nome && !voo) {
      product_type = ProductType.HOSPEDAGEM;
    }

    return {
      passageiros: px,
      destino: (data.destino || '').trim(),
      data_ida: (data.data_ida || '').trim(),
      data_volta: (data.data_volta || '').trim(),
      reserva_voucher: reserva,
      voo_voucher: voo,
      voo_origem,
      voo_destino,
      voo_companhia,
      fornecedor,
      hotel_nome,
      hotel_localizador,
      hotel_observacoes,
      notes_prefill,
      product_type
    };
  }
}
