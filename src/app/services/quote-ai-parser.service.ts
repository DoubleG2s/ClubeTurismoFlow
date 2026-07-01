import { Injectable, inject } from '@angular/core';
import { GeminiClientService } from './gemini-client.service';

export interface ParsedFlightSegment {
  origin_city?: string;
  destination_city?: string;
  departure_time?: string;
  arrival_time?: string;
  has_connection?: boolean;
  connection_city?: string;
  connection_time?: string;
  seats_included?: boolean;
  checked_baggage?: boolean;
}

export interface ParsedHotelData {
  hotel_name?: string;
  regime?: string;
  accommodation?: string;
  amount?: number;
  currency?: 'BRL' | 'USD';
}

export interface ParsedQuoteData {
  check_in?: string;
  check_out?: string;
  adults?: number;
  children?: number;
  outbound?: ParsedFlightSegment;
  inbound?: ParsedFlightSegment;
  hotel?: ParsedHotelData;
  tour_details?: string;
  has_transfer?: boolean;
}

export interface QuoteParseResult {
  success: boolean;
  data: ParsedQuoteData;
  filledFields: string[];
  missingFields: string[];
  confidence: 'high' | 'medium' | 'low';
  rawMessage?: string;
}

// Fallback usado quando a IA retorna um código IATA em vez do nome da cidade.
// A instrução principal no SYSTEM_PROMPT já pede o nome da cidade diretamente.
const IATA_MAP: Record<string, string> = {
  // Brasil — principais hubs
  GRU: 'São Paulo', CGH: 'São Paulo', VCP: 'Campinas',
  GIG: 'Rio de Janeiro', SDU: 'Rio de Janeiro',
  BSB: 'Brasília', SSA: 'Salvador', FOR: 'Fortaleza',
  REC: 'Recife', MAO: 'Manaus', BEL: 'Belém',
  CWB: 'Curitiba', POA: 'Porto Alegre', FLN: 'Florianópolis',
  MCZ: 'Maceió', NAT: 'Natal', THE: 'Teresina',
  SLZ: 'São Luís', VIX: 'Vitória', JPA: 'João Pessoa',
  AJU: 'Aracaju', PMW: 'Palmas', CGR: 'Campo Grande',
  CGB: 'Cuiabá', PVH: 'Porto Velho', RBR: 'Rio Branco',
  MCP: 'Macapá', BVB: 'Boa Vista',
  CNF: 'Belo Horizonte', PLU: 'Belo Horizonte',
  GYN: 'Goiânia', IGU: 'Foz do Iguaçu',
  // Brasil — regionais
  BPS: 'Porto Seguro', RAO: 'Ribeirão Preto', CFB: 'Cabo Frio',
  IOS: 'Ilhéus', FEN: 'Fernando de Noronha', LEC: 'Lençóis',
  JDO: 'Juazeiro do Norte', PNZ: 'Petrolina', STM: 'Santarém',
  UDI: 'Uberlândia', LDB: 'Londrina', MGF: 'Maringá',
  JOI: 'Joinville', NVT: 'Navegantes', IPN: 'Ipatinga',
  PPB: 'Presidente Prudente', JTC: 'Bauru', VAG: 'Varginha',
  PFB: 'Passo Fundo', RIA: 'Santa Maria', MAB: 'Marabá',
  // América do Norte
  MIA: 'Miami', MCO: 'Orlando', JFK: 'Nova York', EWR: 'Nova York', LGA: 'Nova York',
  LAX: 'Los Angeles', ORD: 'Chicago', ATL: 'Atlanta', DFW: 'Dallas',
  // Europa
  LIS: 'Lisboa', OPO: 'Porto', MAD: 'Madrid', BCN: 'Barcelona',
  CDG: 'Paris', ORY: 'Paris', LHR: 'Londres', LGW: 'Londres',
  FCO: 'Roma', MXP: 'Milão', LIN: 'Milão',
  AMS: 'Amsterdã', FRA: 'Frankfurt', DUB: 'Dublin',
  PMI: 'Palma de Mallorca', VCE: 'Veneza', NCE: 'Nice',
  // América Latina
  CUN: 'Cancún', MEX: 'Cidade do México', BOG: 'Bogotá',
  LIM: 'Lima', SCL: 'Santiago', EZE: 'Buenos Aires', AEP: 'Buenos Aires',
  PUJ: 'Punta Cana', SJO: 'San José',
  // Ásia / Oriente Médio / Oceania
  DXB: 'Dubai', DOH: 'Doha', SIN: 'Singapura', HKG: 'Hong Kong',
  BKK: 'Bangkok', NRT: 'Tóquio', HND: 'Tóquio', PEK: 'Pequim', PVG: 'Xangai',
  ICN: 'Seul', SYD: 'Sydney', MEL: 'Melbourne',
  MLE: 'Maldivas', CMB: 'Colombo',
};

const SYSTEM_PROMPT = `Você é um extrator de dados de viagem especializado. Analise o texto bruto fornecido (pode ser de operadoras, consolidadoras, GDS, WhatsApp, e-mail) e extraia as informações de uma cotação de pacote turístico.

Retorne SEMPRE um JSON com esta estrutura exata:
{
  "check_in": "dd/mm/aaaa ou null",
  "check_out": "dd/mm/aaaa ou null",
  "adults": número ou null,
  "children": número ou null,
  "outbound": {
    "origin_city": "nome da cidade de origem (ex: Porto Seguro, São Paulo), ou null",
    "destination_city": "nome da cidade de destino (ex: Cancún, Rio de Janeiro), ou null",
    "departure_time": "HH:mm ou null",
    "arrival_time": "HH:mm ou null",
    "has_connection": true ou false,
    "connection_city": "nome da cidade de conexão, ou null",
    "connection_time": "HH:mm ou null",
    "seats_included": true ou false,
    "checked_baggage": true ou false
  },
  "inbound": {
    "origin_city": "nome da cidade de origem, ou null",
    "destination_city": "nome da cidade de destino, ou null",
    "departure_time": "HH:mm ou null",
    "arrival_time": "HH:mm ou null",
    "has_connection": true ou false,
    "connection_city": "nome da cidade de conexão, ou null",
    "connection_time": "HH:mm ou null",
    "seats_included": true ou false,
    "checked_baggage": true ou false
  },
  "hotel": {
    "hotel_name": "nome completo do hotel ou null",
    "regime": "valor mapeado conforme regra 10, ou null",
    "accommodation": "tipo de acomodação (ex: Apto Standard, Suite) ou null",
    "amount": número sem formatação ou null,
    "currency": "BRL" ou "USD"
  },
  "tour_details": "passeio incluído ou null",
  "has_transfer": true ou false
}

REGRAS CRÍTICAS:
1. Para origin_city, destination_city e connection_city: retorne SEMPRE o nome da cidade em português (ex: "Porto Seguro", "Ribeirão Preto", "São Paulo", "Cancún"). Se o texto contiver um código IATA (ex: BPS, RAO, GRU, CUN), converta-o para o nome da cidade correspondente. NÃO retorne códigos IATA nos campos de cidade. Se não houver informação de origem ou destino no texto, retorne null.
2. Datas SEMPRE no formato dd/mm/aaaa. Se vier como 22-JAN-2025, 2025-01-22, 22 de janeiro, converta.
3. Horários SEMPRE no formato HH:mm (24h). Ex: 8h30→08:30, 2:45pm→14:45.
4. Para valores monetários, retorne apenas o número (R$ 3.450,00→3450, USD 1200→1200).
5. "saída", "embarque", "ida", "going" = outbound. "retorno", "volta", "regresso", "return" = inbound.
6. "bagagem despachada", "checked baggage", "bagagem inclusa" = checked_baggage: true.
7. "assento marcado", "seat selection", "assento incluso" = seats_included: true.
8. "traslado", "transfer", "translado" = has_transfer: true.
9. "passeio", "city tour", "tour", "excursão", "roteiro", "passeio facultativo", "tour opcional", "passeio incluído", "shore excursion" = extraia a descrição do passeio para tour_details (ex: "City Tour em Cancún", "Excursão às Cataratas"). Se houver mais de um, junte em uma string separada por vírgula.
10. Para o campo regime, leia TODO o texto em busca de qualquer indicação de alimentação/refeição inclusa e retorne o valor mapeado exato. Reconheça as seguintes variações (comparação case-insensitive), incluindo abreviações comuns de operadoras brasileiras:
    - "Café da manhã" → termos: "café da manhã", "café da manha", "café", "somente café", "café incluso", "café incluído", "com café", "inclui café", "bed and breakfast", "BB", "B&B", "CP" (café e pernoite)
    - "Meia pensão" → termos: "meia pensão", "meia-pensão", "meia pensao", "half board", "HB", "MP", "JA" (jantar e café), "café e jantar", "jantar incluso", "jantar incluído"
    - "Pensão completa" → termos: "pensão completa", "pensao completa", "full board", "FB", "PC", "todas as refeições", "todas refeições inclusas", "café almoço e jantar"
    - "All inclusive" → termos: "all inclusive", "all-inclusive", "all in", "tudo incluso", "tudo incluído", "AI", "UAI", "ultra all inclusive"
    - "Apenas quarto" → termos: "somente pernoite", "sem refeição", "sem refeições", "sem café", "sem alimentação", "room only", "RO", "SD" (sem desjejum), "SP" (somente pernoite), "SQ", "FA" (fora de alimentação), "apenas pernoite", "só pernoite"
    Se nenhum desses termos for identificado no texto mas houver hotel, retorne "Apenas quarto" como padrão. Retorne null apenas se não houver hotel algum na cotação.
11. Retorne null para campos não encontrados. Nunca invente dados.`;

@Injectable({ providedIn: 'root' })
export class QuoteAiParserService {
  private gemini = inject(GeminiClientService);

  async parseRawText(text: string): Promise<QuoteParseResult> {
    const responseText = await this.gemini.generateText(SYSTEM_PROMPT, text, [], true);

    let raw: any;
    try {
      const cleaned = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
      raw = JSON.parse(cleaned);
    } catch {
      return {
        success: false, data: {}, filledFields: [],
        missingFields: this.getAllFieldNames(), confidence: 'low',
        rawMessage: 'Falha ao interpretar resposta da IA.',
      };
    }

    const data = this.postProcess(raw);
    const { filledFields, missingFields } = this.detectFilledFields(data);
    const confidence: QuoteParseResult['confidence'] =
      filledFields.length >= 8 ? 'high' : filledFields.length >= 4 ? 'medium' : 'low';

    return { success: filledFields.length > 0, data, filledFields, missingFields, confidence };
  }

  private postProcess(raw: any): ParsedQuoteData {
    const data: ParsedQuoteData = {};
    if (raw.check_in) data.check_in = raw.check_in;
    if (raw.check_out) data.check_out = raw.check_out;
    if (raw.adults != null) data.adults = Number(raw.adults);
    if (raw.children != null) data.children = Number(raw.children);
    if (raw.tour_details) data.tour_details = raw.tour_details;
    if (raw.has_transfer != null) data.has_transfer = Boolean(raw.has_transfer);
    if (raw.outbound) data.outbound = this.processFlightSegment(raw.outbound);
    if (raw.inbound) data.inbound = this.processFlightSegment(raw.inbound);
    if (raw.hotel) {
      data.hotel = {
        hotel_name: raw.hotel.hotel_name || undefined,
        regime: raw.hotel.regime || undefined,
        accommodation: raw.hotel.accommodation || undefined,
        amount: raw.hotel.amount != null ? Number(raw.hotel.amount) : undefined,
        currency: raw.hotel.currency === 'USD' ? 'USD' : 'BRL',
      };
    }
    return data;
  }

  private processFlightSegment(seg: any): ParsedFlightSegment {
    const out: ParsedFlightSegment = {};
    if (seg.origin_city) out.origin_city = this.resolveIata(seg.origin_city);
    if (seg.destination_city) out.destination_city = this.resolveIata(seg.destination_city);
    if (seg.departure_time) out.departure_time = seg.departure_time;
    if (seg.arrival_time) out.arrival_time = seg.arrival_time;
    out.has_connection = Boolean(seg.has_connection);
    if (seg.connection_city) out.connection_city = this.resolveIata(seg.connection_city);
    if (seg.connection_time) out.connection_time = seg.connection_time;
    out.seats_included = Boolean(seg.seats_included);
    out.checked_baggage = Boolean(seg.checked_baggage);
    return out;
  }

  private resolveIata(value: string): string {
    if (!value) return value;
    const upper = value.trim().toUpperCase();
    return IATA_MAP[upper] ?? value;
  }

  private detectFilledFields(data: ParsedQuoteData): { filledFields: string[]; missingFields: string[] } {
    const filled: string[] = [];
    const missing: string[] = [];
    const check = (condition: boolean, name: string) =>
      condition ? filled.push(name) : missing.push(name);

    check(!!data.check_in, 'Data Ida');
    check(!!data.check_out, 'Data Volta');
    check(data.adults != null, 'Adultos');
    check(data.children != null, 'Crianças');
    check(!!data.outbound?.origin_city, 'Origem (Ida)');
    check(!!data.outbound?.destination_city, 'Destino (Ida)');
    check(!!data.outbound?.departure_time, 'Saída (Ida)');
    check(!!data.outbound?.arrival_time, 'Chegada (Ida)');
    check(!!data.inbound?.origin_city, 'Origem (Volta)');
    check(!!data.inbound?.destination_city, 'Destino (Volta)');
    check(!!data.inbound?.departure_time, 'Saída (Volta)');
    check(!!data.inbound?.arrival_time, 'Chegada (Volta)');
    check(!!data.hotel?.hotel_name, 'Hotel');
    check(!!data.hotel?.regime, 'Regime');
    check(!!data.hotel?.accommodation, 'Acomodação');
    check(data.hotel?.amount != null, 'Valor');
    check(!!data.tour_details, 'Passeio');

    return { filledFields: filled, missingFields: missing };
  }

  private getAllFieldNames(): string[] {
    return [
      'Data Ida', 'Data Volta', 'Adultos', 'Crianças',
      'Origem (Ida)', 'Destino (Ida)', 'Saída (Ida)', 'Chegada (Ida)',
      'Origem (Volta)', 'Destino (Volta)', 'Saída (Volta)', 'Chegada (Volta)',
      'Hotel', 'Regime', 'Acomodação', 'Valor', 'Passeio',
    ];
  }
}
