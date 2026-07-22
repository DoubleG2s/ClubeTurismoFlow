export type VendaStatus = 'Aberta' | 'Confirmada' | 'Finalizada' | 'Em crédito' | 'Reembolsada' | 'Cancelada';
export type ProdutoTipo = 'Pacote' | 'Voo' | 'Hospedagem' | 'Cruzeiro' | 'Seguro' | 'Transfer' | 'Passeio' | 'Ingresso' | 'Outros';
export type FormaPagamento = 'Cartão de Crédito' | 'PIX' | 'Boleto' | 'Transferência' | 'Dinheiro' | 'Pontos TudoAzul';
export type StatusPagamento = 'Pendente' | 'Pago';

export const VENDEDORES = ['Marcelo S.', 'Ana Costa', 'Guilherme H.'] as const;
export const FORNECEDORES = ['Azul Viagens', 'CVC', 'Abreu Viagens', 'FRT Turismo', 'Cativa Viagens', 'Orinter', 'MSC Cruzeiros', 'Costa Cruzeiros', 'Decolar Corporate'];
export const PRODUTO_TIPOS: ProdutoTipo[] = ['Pacote', 'Voo', 'Hospedagem', 'Cruzeiro', 'Seguro', 'Transfer', 'Passeio', 'Ingresso', 'Outros'];
export const STATUS_VENDA: VendaStatus[] = ['Aberta', 'Confirmada', 'Finalizada', 'Em crédito', 'Reembolsada', 'Cancelada'];
export const FORMAS_PAGAMENTO: FormaPagamento[] = ['Cartão de Crédito', 'PIX', 'Boleto', 'Transferência', 'Dinheiro'];
export const STATUS_PAGAMENTO: StatusPagamento[] = ['Pendente', 'Pago'];
export const REGIME_OPCOES = ['Sem pensão', 'Café da manhã', 'Meia pensão', 'Pensão completa', 'All inclusive'];

export interface VendaPromoAzul {
  codigo: string;
  desconto: number;
  reduzComissao: number;
}

/** Promocodes Azul (espelham o cadastro em Fornecedores). Incidem só nas linhas marcadas do modo "por serviço". */
export const PROMO_AZUL_VENDA: VendaPromoAzul[] = [
  { codigo: 'AZUL10', desconto: 10, reduzComissao: 0 },
  { codigo: 'AZUL15', desconto: 15, reduzComissao: 5 },
  { codigo: 'AZUL20', desconto: 20, reduzComissao: 7 },
  { codigo: 'AZUL25', desconto: 25, reduzComissao: 7 },
];

export const SVC_SUGESTOES = ['Pacote (aéreo + hotel)', 'Aéreo', 'Hotel', 'Traslado', 'Seguro', 'Passeio', 'Ingresso', 'Carro'];

export interface VendaCliente {
  id: number;
  nome: string;
  cpf: string;
  nascimento: string;
}

export interface VendaProduto {
  tipo: ProdutoTipo;
  numeroFornecedor: string;
  fornecedor: string;
  representante: string;
  dataInicio: string;
  dataFim: string;
  tipoViagem: 'Nacional' | 'Internacional';
  destino: string;
  servicosInclusos: string;
  servicos: { nome: string; detalhe: string }[];
  transporte: string;
  // Voo
  companhiaAerea: string;
  numeroVoo: string;
  origem: string;
  bagagem: string;
  // Hospedagem
  hotel: string;
  localizadorHotel: string;
  categoriaQuarto: string;
  regimeAlimentacao: string;
  // Cruzeiro
  ciaMaritima: string;
  nomeNavio: string;
  numeroCabine: string;
  categoriaCabine: string;
  portoEmbarque: string;
  portoDesembarque: string;
  // Seguro
  seguradora: string;
  // Transfer
  origemTransfer: string;
  destinoTransfer: string;
}

export interface VendaPassageiro {
  clienteId: number | null;
  nome: string;
  cpf: string;
  nascimento: string;
  valorIndividual: number;
}

export interface VendaServicoLinha {
  id: string;
  nome: string;
  valor: number;
  aplicaPromo: boolean;
  percentComissao: number;
  valorComissao: number;
}

export interface VendaValores {
  /** "unico" = um valor/comissão para toda a venda; "servico" = um valor/comissão por serviço (itens). */
  modo?: 'unico' | 'servico';
  valorProduto: number;
  taxas: number;
  outrasTaxas: number;
  rav: number;
  taxaRav: number;
  desconto: number;
  /** Desconto total aplicado pelo promocode (soma das linhas marcadas), calculado automaticamente. */
  descontoPromo?: number;
  /** Linhas de serviço do modo "por serviço". */
  itens?: VendaServicoLinha[];
  /** Código do promocode Azul selecionado (só disponível quando fornecedor é Azul Viagens). */
  promocode?: string;
}

export interface VendaPagamento {
  forma: FormaPagamento;
  info: string;
  parcelas: number;
  vencimento: string;
  valor: number;
  status: StatusPagamento;
}

export interface VendaComissao {
  percentualFornecedor: number;
  valorComissaoFornecedor: number;
}

export interface VendaOrigem {
  cotacaoId: string;
  opcao?: string | null;
}

export interface Venda {
  id: number;
  numero: number;
  data: string;
  vendedor: string;
  pagante: VendaCliente | null;
  status: VendaStatus;
  numeroReserva: string;
  origem: VendaOrigem | null;
  produto: VendaProduto;
  passageiros: VendaPassageiro[];
  valores: VendaValores;
  pagamentos: VendaPagamento[];
  comissao: VendaComissao;
  cadastradoPor: string;
  cadastradoEm: string;
}

export type VendaFormValue = Omit<Venda, 'id' | 'numero' | 'cadastradoPor' | 'cadastradoEm'>;

export function todayBR(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
}

export function blankVendaProduto(): VendaProduto {
  return {
    tipo: 'Pacote', numeroFornecedor: '', fornecedor: '', representante: '',
    dataInicio: '', dataFim: '', tipoViagem: 'Nacional', destino: '', servicosInclusos: '', servicos: [], transporte: '',
    companhiaAerea: '', numeroVoo: '', origem: '', bagagem: '',
    hotel: '', localizadorHotel: '', categoriaQuarto: '', regimeAlimentacao: '',
    ciaMaritima: '', nomeNavio: '', numeroCabine: '', categoriaCabine: '', portoEmbarque: '', portoDesembarque: '',
    seguradora: '',
    origemTransfer: '', destinoTransfer: '',
  };
}

export function blankVenda(): VendaFormValue {
  return {
    data: todayBR(),
    vendedor: '',
    pagante: null,
    status: 'Aberta',
    numeroReserva: '',
    origem: null,
    produto: blankVendaProduto(),
    passageiros: [{ clienteId: null, nome: '', cpf: '', nascimento: '', valorIndividual: 0 }],
    valores: { modo: 'unico', valorProduto: 0, taxas: 0, outrasTaxas: 0, rav: 0, taxaRav: 0, desconto: 0, descontoPromo: 0, itens: [], promocode: '' },
    pagamentos: [{ forma: 'PIX', info: '', parcelas: 1, vencimento: '', valor: 0, status: 'Pendente' }],
    comissao: { percentualFornecedor: 0, valorComissaoFornecedor: 0 },
  };
}

export function num(v: unknown): number {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
}

export function brl(n: number): string {
  return 'R$ ' + (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function pct(n: number): string {
  return (Number(n) || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%';
}

export function calcValorTotal(v: VendaValores): number {
  return num(v.valorProduto) + num(v.taxas) + num(v.outrasTaxas) + num(v.rav) - num(v.desconto) - num(v.descontoPromo);
}

export function calcReceitaPrevista(comissao: VendaComissao, valores: VendaValores): number {
  return num(comissao.valorComissaoFornecedor) + (num(valores.rav) - num(valores.rav) * num(valores.taxaRav) / 100);
}

export function somaPagamentos(pagamentos: VendaPagamento[]): number {
  return pagamentos.reduce((s, p) => s + num(p.valor), 0);
}

export interface SaldoInfo {
  state: 'ok' | 'pending' | 'over';
  diff: number;
  label: string;
}

export function saldoInfo(pagamentos: VendaPagamento[], total: number): SaldoInfo {
  const soma = somaPagamentos(pagamentos);
  const diff = Math.round((total - soma) * 100) / 100;
  if (Math.abs(diff) < 0.005) return { state: 'ok', diff: 0, label: 'Venda conciliada' };
  if (diff > 0) return { state: 'pending', diff, label: `Saldo pendente: ${brl(diff)}` };
  return { state: 'over', diff, label: `Divergência: ${brl(-diff)} a mais` };
}

// ─────────────────────────────────────────────────────────────
// Modo "por serviço" — cada serviço com seu valor e sua comissão (% e R$).
// Promocodes Azul incidem SÓ nas linhas marcadas (tipicamente Pacote aéreo+hotel):
// descontam o cliente e reduzem os pontos de comissão. Seguro nunca é descontado.
// ─────────────────────────────────────────────────────────────
export function isSeguroNome(n: string | null | undefined): boolean {
  return /seguro/i.test(n || '');
}

export function isPacoteNome(n: string | null | undefined): boolean {
  return /pacote|a[eé]reo|a[eé]rea|hotel|hosped/i.test(n || '');
}

export function fornecedorAceitaPromo(v: VendaFormValue): boolean {
  return v.produto.fornecedor === 'Azul Viagens';
}

export function getPromoVenda(v: VendaFormValue): VendaPromoAzul | null {
  if (!fornecedorAceitaPromo(v)) return null;
  return PROMO_AZUL_VENDA.find(p => p.codigo === v.valores.promocode) || null;
}

let _svcSeq = 1;
export function newLinhaServico(nome = '', aplicaPromo = false, valor: number | string = 0): VendaServicoLinha {
  return {
    id: 'svc' + (_svcSeq++),
    nome,
    valor: num(valor),
    aplicaPromo: !!aplicaPromo && !isSeguroNome(nome),
    percentComissao: 0,
    valorComissao: 0,
  };
}

export interface LinhaServicoCalc {
  valor: number;
  on: boolean;
  descontoCliente: number;
  valorCliente: number;
  pctBase: number;
  pctEfetivo: number;
  comissao: number;
}

/** Calcula uma linha de serviço, considerando o promocode ativo (se aplicável a ela). */
export function calcLinhaServico(linha: VendaServicoLinha, promo: VendaPromoAzul | null): LinhaServicoCalc {
  const valor = num(linha.valor);
  const on = !!promo && !!linha.aplicaPromo && !isSeguroNome(linha.nome);
  const descontoCliente = on ? Math.round(valor * promo!.desconto) / 100 : 0;
  const valorCliente = valor - descontoCliente;
  const pctBase = num(linha.percentComissao);
  const pctEfetivo = on ? Math.max(0, Math.round((pctBase - promo!.reduzComissao) * 10) / 10) : pctBase;
  const comissao = Math.round(valorCliente * pctEfetivo) / 100;
  return { valor, on, descontoCliente, valorCliente, pctBase, pctEfetivo, comissao };
}

export interface SomaServicosResult {
  bruto: number;
  cliente: number;
  descontoPromo: number;
  comissao: number;
}

/** Agregados de todos os serviços de uma venda (modo "por serviço"). */
export function somaServicos(v: VendaFormValue): SomaServicosResult {
  const promo = getPromoVenda(v);
  return (v.valores.itens || []).reduce((a, l) => {
    const c = calcLinhaServico(l, promo);
    a.bruto += c.valor; a.cliente += c.valorCliente; a.descontoPromo += c.descontoCliente; a.comissao += c.comissao;
    return a;
  }, { bruto: 0, cliente: 0, descontoPromo: 0, comissao: 0 });
}

/**
 * Sincroniza os agregados dos serviços nos campos legados (valorProduto/descontoPromo/comissao)
 * para que TODAS as telas de leitura (revisão, listagem, drawer) continuem corretas mesmo
 * sem saber que a venda foi montada "por serviço".
 */
export function syncServico(v: VendaFormValue): VendaFormValue {
  const s = somaServicos(v);
  const r2 = (n: number) => Math.round(n * 100) / 100;
  const pctW = s.cliente > 0 ? Math.round((s.comissao / s.cliente) * 1000) / 10 : 0;
  return {
    ...v,
    valores: { ...v.valores, valorProduto: r2(s.bruto), descontoPromo: r2(s.descontoPromo) },
    comissao: { percentualFornecedor: pctW, valorComissaoFornecedor: r2(s.comissao) },
  };
}

/** Mapeia o status da venda para uma classe .ct-pill-* já existente no design system. */
export function statusPillClass(status: VendaStatus): string {
  switch (status) {
    case 'Aberta': return 'ct-pill-info';
    case 'Confirmada': return 'ct-pill-brand';
    case 'Em crédito': return 'ct-pill-ai';
    case 'Reembolsada': return 'ct-pill-warn';
    case 'Cancelada': return 'ct-pill-danger';
    case 'Finalizada':
    default: return '';
  }
}
