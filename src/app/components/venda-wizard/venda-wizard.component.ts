import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Output, computed, inject, signal } from '@angular/core';
import {
  FORMAS_PAGAMENTO, FORNECEDORES, PRODUTO_TIPOS, PROMO_AZUL_VENDA, STATUS_PAGAMENTO, STATUS_VENDA, SVC_SUGESTOES,
  VendaCliente, VendaFormValue, VendaPagamento, VendaPassageiro, VendaProduto, VendaServicoLinha, VendaValores,
  blankVenda, brl, calcLinhaServico, calcReceitaPrevista, calcValorTotal, fornecedorAceitaPromo, getPromoVenda,
  isPacoteNome, isSeguroNome, newLinhaServico, num, pct, saldoInfo, somaPagamentos, somaServicos, syncServico
} from '../../models/venda';
import { ReservaMini, VendaService } from '../../services/venda.service';
import { VendaClienteAutocompleteComponent } from '../venda-shared/venda-cliente-autocomplete.component';
import { VendaCurrencyInputComponent } from '../venda-shared/venda-currency-input.component';
import { VendaServicosEditorComponent, parseServicos } from '../venda-shared/venda-servicos-editor.component';

const VENDEDORES_LOCAL = ['Marcelo S.', 'Ana Costa', 'Guilherme H.'];
const TIPO_MAP: Record<string, string> = { PACOTE: 'Pacote', VOO: 'Voo', HOSPEDAGEM: 'Hospedagem', CRUZEIRO: 'Cruzeiro' };

// Voucher fictício — simula os dados extraídos de um PDF importado (mock, sem backend)
const VOUCHER_VENDA_MOCK: ReservaMini = {
  id: 'GX7K2P', tipo: 'PACOTE', voucher: 'GX7K2P', destino: 'Maceió',
  ida: '12/07/2026', volta: '19/07/2026', hotel: 'Jatiúca Resort',
  fornecedor: 'Azul Viagens', autor: '',
  passageiros: ['Camila Souza Rosa', 'Pedro Nogueira Alves'], temVenda: false,
};

interface WizStep {
  key: 'geral' | 'produto' | 'pax' | 'valores' | 'revisao';
  label: string;
  icon: string;
}

const WIZ_STEPS: WizStep[] = [
  { key: 'geral', label: 'Dados gerais', icon: 'tag' },
  { key: 'produto', label: 'Produto', icon: 'voucher' },
  { key: 'pax', label: 'Passageiros', icon: 'users' },
  { key: 'valores', label: 'Valores', icon: 'money' },
  { key: 'revisao', label: 'Revisão', icon: 'check' },
];

function wizMissing(stepKey: WizStep['key'], v: VendaFormValue): string[] {
  const miss: string[] = [];
  const t = v.produto.tipo;

  if (stepKey === 'geral') {
    if (!v.data) miss.push('Data da venda');
    if (!v.vendedor) miss.push('Vendedor');
    if (!v.produto.fornecedor.trim()) miss.push(t === 'Seguro' ? 'Seguradora' : 'Fornecedor');
    if (!v.pagante) miss.push('Pagante');
  }
  if (stepKey === 'produto') {
    if (t === 'Transfer') {
      if (!v.produto.origemTransfer.trim()) miss.push('Origem do transfer');
      if (!v.produto.destinoTransfer.trim()) miss.push('Destino do transfer');
    } else if (!v.produto.destino.trim()) miss.push('Destino');
    if (!v.produto.dataInicio) miss.push('Data de início');
    if (!v.produto.dataFim) miss.push('Data de fim');
  }
  if (stepKey === 'pax') {
    if (!v.passageiros.some(p => (p.nome || '').trim())) miss.push('Ao menos 1 passageiro');
  }
  if (stepKey === 'valores') {
    if (!(num(v.valores.valorProduto) > 0)) miss.push('Valor do produto');
  }
  return miss;
}

function wizStepDone(stepKey: WizStep['key'], v: VendaFormValue): boolean {
  return wizMissing(stepKey, v).length === 0;
}

/**
 * Wizard de Nova Venda — 5 etapas (Dados gerais, Produto, Passageiros, Valores, Revisão)
 * com resumo vivo. Todas as etapas vivem neste único componente (rail + conteúdo);
 * elas foram etapas separadas no protótipo, mas aqui viram apenas seções do mesmo
 * template selecionadas via @switch, evitando um componente Angular por etapa.
 */
@Component({
  selector: 'app-venda-wizard',
  standalone: true,
  imports: [CommonModule, VendaClienteAutocompleteComponent, VendaCurrencyInputComponent, VendaServicosEditorComponent],
  templateUrl: './venda-wizard.component.html'
})
export class VendaWizardComponent {
  private vendaService = inject(VendaService);

  @Output() done = new EventEmitter<VendaFormValue>();

  readonly steps = WIZ_STEPS;
  readonly vendedores = VENDEDORES_LOCAL;
  readonly fornecedores = FORNECEDORES;
  readonly produtoTipos = PRODUTO_TIPOS;
  readonly statusVenda = STATUS_VENDA;
  readonly statusPagamento = STATUS_PAGAMENTO;

  clientes = this.vendaService.clientesMini;
  reservasMini = this.vendaService.reservasMini;

  draft = signal<VendaFormValue>(blankVenda());
  step = signal(0);
  tried = signal<Record<string, boolean>>({});
  summaryOpen = signal(false);
  resOpen = signal(false);
  showOptProduto = signal(false);
  showOptValores = signal(false);
  svcLayout = signal<'cartoes' | 'tabela'>('cartoes');

  stepKey = computed(() => this.steps[this.step()].key);
  missing = computed(() => wizMissing(this.stepKey(), this.draft()));
  isLast = computed(() => this.step() === this.steps.length - 1);

  valorTotal = computed(() => calcValorTotal(this.draft().valores));
  receita = computed(() => calcReceitaPrevista(this.draft().comissao, this.draft().valores));
  saldo = computed(() => saldoInfo(this.draft().pagamentos, this.valorTotal()));
  paxCount = computed(() => this.draft().passageiros.filter(p => (p.nome || '').trim()).length);
  destinoResumo = computed(() => {
    const d = this.draft();
    return d.produto.tipo === 'Transfer' ? [d.produto.origemTransfer, d.produto.destinoTransfer].filter(Boolean).join(' → ') : d.produto.destino;
  });

  resMatches = computed(() => {
    const q = (this.draft().produto.numeroFornecedor || '').trim().toUpperCase();
    const list = this.reservasMini();
    return list.filter(r => !q || r.id.includes(q) || (r.voucher || '').includes(q) || r.destino.toUpperCase().includes(q) || r.passageiros.some(p => p.toUpperCase().includes(q))).slice(0, 6);
  });

  brl = brl;
  num = num;
  pct = pct;
  isSeguroNome = isSeguroNome;
  readonly promoAzulOpcoes = PROMO_AZUL_VENDA;

  // ── Valores — modo "por serviço" ──
  get modo(): 'unico' | 'servico' {
    return this.draft().valores.modo || 'unico';
  }

  get aceitaPromo(): boolean {
    return fornecedorAceitaPromo(this.draft());
  }

  get promoAtiva() {
    return getPromoVenda(this.draft());
  }

  get itensServico(): VendaServicoLinha[] {
    return this.draft().valores.itens || [];
  }

  get somaServicosCalc() {
    return somaServicos(this.draft());
  }

  get sugestoesServico(): string[] {
    return SVC_SUGESTOES.filter(s => !this.itensServico.some(l => l.nome.toLowerCase() === s.toLowerCase()));
  }

  calcLinha(l: VendaServicoLinha) {
    return calcLinhaServico(l, this.promoAtiva);
  }

  setModo(m: 'unico' | 'servico') {
    const d = this.draft();
    if (this.modo === m) return;
    if (m === 'servico') {
      const itens = d.valores.itens && d.valores.itens.length ? d.valores.itens : this.seedItensServico(d);
      this.emit(syncServico({ ...d, valores: { ...d.valores, modo: 'servico', itens } }));
    } else {
      this.emit({ ...d, valores: { ...d.valores, modo: 'unico', descontoPromo: 0 } });
    }
  }

  private seedItensServico(v: VendaFormValue): VendaServicoLinha[] {
    const servicos = parseServicos(v.produto.servicos, v.produto.servicosInclusos);
    const has = (re: RegExp) => servicos.some(s => re.test(s.nome || ''));
    const itens: VendaServicoLinha[] = [];
    if (has(/a[eé]reo|hotel|hosped/i) || v.produto.tipo === 'Pacote') itens.push(newLinhaServico('Pacote (aéreo + hotel)', true));
    if (has(/traslad|transfer/i)) itens.push(newLinhaServico('Traslado', false));
    if (has(/seguro/i)) itens.push(newLinhaServico('Seguro', false));
    if (itens.length === 0) itens.push(newLinhaServico('Pacote (aéreo + hotel)', true));
    const vp = num(v.valores.valorProduto);
    if (vp > 0) itens[0].valor = vp;
    return itens;
  }

  setPromocode(codigo: string) {
    const d = this.draft();
    const next = d.valores.promocode === codigo ? '' : codigo;
    this.emit(syncServico({ ...d, valores: { ...d.valores, promocode: next } }));
  }

  private commitItensServico(itens: VendaServicoLinha[]) {
    const d = this.draft();
    this.emit(syncServico({ ...d, valores: { ...d.valores, itens } }));
  }

  addLinhaServico(nome = '') {
    const aplicaPromo = isPacoteNome(nome);
    this.commitItensServico([...this.itensServico, newLinhaServico(nome, aplicaPromo)]);
  }

  removeLinhaServico(i: number) {
    this.commitItensServico(this.itensServico.filter((_, idx) => idx !== i));
  }

  setLinhaNome(i: number, val: string) {
    this.commitItensServico(this.itensServico.map((l, idx) => idx === i ? { ...l, nome: val, aplicaPromo: isSeguroNome(val) ? false : l.aplicaPromo } : l));
  }

  setLinhaValor(i: number, val: number) {
    this.commitItensServico(this.itensServico.map((l, idx) => idx === i ? { ...l, valor: num(val), valorComissao: Math.round(num(val) * num(l.percentComissao)) / 100 } : l));
  }

  setLinhaPct(i: number, val: string) {
    const p = num(val);
    this.commitItensServico(this.itensServico.map((l, idx) => idx === i ? { ...l, percentComissao: p, valorComissao: Math.round(num(l.valor) * p) / 100 } : l));
  }

  setLinhaValorCom(i: number, val: number) {
    const vc = num(val);
    this.commitItensServico(this.itensServico.map((l, idx) => {
      if (idx !== i) return l;
      const p = num(l.valor) > 0 ? Math.round((vc / num(l.valor)) * 1000) / 10 : 0;
      return { ...l, valorComissao: vc, percentComissao: p };
    }));
  }

  toggleLinhaPromo(i: number) {
    this.commitItensServico(this.itensServico.map((l, idx) => idx === i ? { ...l, aplicaPromo: !l.aplicaPromo } : l));
  }

  // ── Navegação do wizard ──
  stepDone(key: WizStep['key']): boolean {
    return wizStepDone(key, this.draft()) && key !== 'revisao';
  }

  stepMissingCount(key: WizStep['key']): number {
    return wizMissing(key, this.draft()).length;
  }

  next() {
    if (this.missing().length > 0) {
      this.tried.update(t => ({ ...t, [this.stepKey()]: true }));
      return;
    }
    this.step.update(s => Math.min(this.steps.length - 1, s + 1));
  }

  prev() {
    this.step.update(s => Math.max(0, s - 1));
  }

  goTo(i: number) {
    if (i <= this.step()) { this.step.set(i); return; }
    for (let k = 0; k < i; k++) {
      if (!wizStepDone(this.steps[k].key, this.draft())) {
        this.step.set(k);
        this.tried.update(t => ({ ...t, [this.steps[k].key]: true }));
        return;
      }
    }
    this.step.set(i);
  }

  salvar() {
    for (let k = 0; k < this.steps.length - 1; k++) {
      if (!wizStepDone(this.steps[k].key, this.draft())) {
        this.step.set(k);
        this.tried.update(t => ({ ...t, [this.steps[k].key]: true }));
        return;
      }
    }
    this.done.emit(this.draft());
    this.draft.set(blankVenda());
    this.step.set(0);
    this.tried.set({});
  }

  // ── Setters genéricos ──
  private emit(next: VendaFormValue) {
    this.draft.set(next);
  }

  set<K extends keyof VendaFormValue>(key: K, val: VendaFormValue[K]) {
    this.emit({ ...this.draft(), [key]: val });
  }

  setProduto<K extends keyof VendaProduto>(key: K, val: VendaProduto[K]) {
    this.emit({ ...this.draft(), produto: { ...this.draft().produto, [key]: val } });
  }

  setValores<K extends keyof VendaValores>(key: K, val: VendaValores[K]) {
    this.emit({ ...this.draft(), valores: { ...this.draft().valores, [key]: val } });
  }

  onDataChange(iso: string) {
    if (!iso) { this.set('data', ''); return; }
    const [y, m, dd] = iso.split('-');
    this.set('data', `${dd}/${m}/${y}`);
  }

  get dataISO(): string {
    return this.draft().data ? this.draft().data.split('/').reverse().join('-') : '';
  }

  onProdutoDataChange(field: 'dataInicio' | 'dataFim', iso: string) {
    if (!iso) { this.setProduto(field, ''); return; }
    const [y, m, dd] = iso.split('-');
    this.setProduto(field, `${dd}/${m}/${y}`);
  }

  produtoDataISO(field: 'dataInicio' | 'dataFim'): string {
    const v = this.draft().produto[field];
    return v ? v.split('/').reverse().join('-') : '';
  }

  onServicosCommit(evt: { servicos: { nome: string; detalhe: string }[]; nomes: string }) {
    this.emit({ ...this.draft(), produto: { ...this.draft().produto, servicos: evt.servicos, servicosInclusos: evt.nomes } });
  }

  get tipoProd(): string {
    return this.draft().produto.tipo;
  }

  /** Serviços comuns que não fazem sentido para o tipo de produto atual (ex: Hotel quando é só Voo). */
  get servicosOcultos(): string[] {
    if (this.tipoProd === 'Voo') return ['Hotel'];
    if (this.tipoProd === 'Hospedagem') return ['Aéreo'];
    return [];
  }

  /** Serviços que devem ficar sempre marcados e travados para o tipo de produto atual. */
  get servicosObrigatorios(): string[] {
    if (this.tipoProd === 'Voo') return ['Aéreo'];
    if (this.tipoProd === 'Hospedagem') return ['Hotel'];
    return [];
  }

  /** Troca o tipo do produto: remove serviços que não fazem mais sentido e força o obrigatório do novo tipo. */
  setProdutoTipo(tipo: VendaProduto['tipo']) {
    const d = this.draft();
    const remover = tipo === 'Voo' ? 'hotel' : tipo === 'Hospedagem' ? 'aéreo' : null;
    let servicos = remover ? d.produto.servicos.filter(s => s.nome.toLowerCase() !== remover) : d.produto.servicos;

    const obrigatorio = tipo === 'Voo' ? 'Aéreo' : tipo === 'Hospedagem' ? 'Hotel' : null;
    if (obrigatorio && !servicos.some(s => s.nome.toLowerCase() === obrigatorio.toLowerCase())) {
      servicos = [...servicos, { nome: obrigatorio, detalhe: '' }];
    }

    this.emit({
      ...d,
      produto: {
        ...d.produto,
        tipo,
        servicos,
        servicosInclusos: servicos.map(s => s.nome).join(', '),
      },
    });
  }

  get transporteOpts(): string[] | null {
    const t = this.draft().produto.tipo;
    if (t === 'Voo') return ['Voo regular', 'Voo fretado', 'Bloqueio aéreo'];
    if (t === 'Pacote') return ['Voo regular', 'Voo fretado', 'Bloqueio aéreo', 'Rodoviário', 'Cruzeiro', '—'];
    if (t === 'Transfer') return ['Regular', 'Privativo'];
    if (t === 'Passeio') return ['Regular', 'Privativo', '—'];
    if (t === 'Outros') return ['Voo regular', 'Rodoviário', '—'];
    return null;
  }

  get isVoo(): boolean {
    return this.draft().produto.tipo === 'Voo';
  }

  /** Verifica se um serviço (ex: "Aéreo", "Hotel") está marcado em Serviços inclusos. */
  servicoAtivo(nome: string): boolean {
    const d = this.draft().produto;
    return parseServicos(d.servicos, d.servicosInclusos).some(s => s.nome.toLowerCase() === nome.toLowerCase());
  }

  // ── Vincular reserva (etapa Dados gerais) ──
  onNumRes(val: string) {
    this.emit({ ...this.draft(), numeroReserva: val, produto: { ...this.draft().produto, numeroFornecedor: val } });
    this.resOpen.set(true);
  }

  importVoucherMock() {
    this.importReserva(VOUCHER_VENDA_MOCK);
  }

  importReserva(res: ReservaMini) {
    const numRes = res.voucher || res.id;
    const d = this.draft();
    const novoTipo = (TIPO_MAP[res.tipo] as VendaProduto['tipo']) || 'Pacote';

    // Ajusta Serviços inclusos: remove o que não faz sentido pro novo tipo, força o obrigatório
    // (Aéreo p/ Voo, Hotel p/ Hospedagem) e, no caso de Pacote, sugere Aéreo/Hotel quando a reserva os traz.
    const remover = novoTipo === 'Voo' ? 'hotel' : novoTipo === 'Hospedagem' ? 'aéreo' : null;
    let servicos = remover ? d.produto.servicos.filter(s => s.nome.toLowerCase() !== remover) : d.produto.servicos;
    const garantir: string[] = [];
    if (novoTipo === 'Voo' || novoTipo === 'Pacote') garantir.push('Aéreo');
    if (novoTipo === 'Hospedagem' || (novoTipo === 'Pacote' && res.hotel)) garantir.push('Hotel');
    for (const nome of garantir) {
      if (!servicos.some(s => s.nome.toLowerCase() === nome.toLowerCase())) servicos = [...servicos, { nome, detalhe: '' }];
    }

    // O pagante é sugerido a partir do primeiro nome da reserva, só quando já existe um cliente
    // cadastrado com esse nome. A lista de passageiros NÃO é pré-preenchida — quem decide é o usuário,
    // usando o atalho "pagante também viaja?" ou adicionando manualmente na etapa Passageiros.
    const primeiroNome = res.passageiros[0];
    const clienteEncontrado = primeiroNome ? this.clientes().find((c: VendaCliente) => c.nome.toLowerCase() === primeiroNome.toLowerCase()) : null;
    const pagante = clienteEncontrado
      ? { id: clienteEncontrado.id, nome: clienteEncontrado.nome, cpf: clienteEncontrado.cpf, nascimento: clienteEncontrado.nascimento }
      : d.pagante;

    this.emit({
      ...d,
      numeroReserva: numRes,
      vendedor: d.vendedor || res.autor,
      produto: {
        ...d.produto,
        tipo: novoTipo,
        numeroFornecedor: numRes,
        fornecedor: res.fornecedor || d.produto.fornecedor,
        dataInicio: res.ida,
        dataFim: res.volta,
        destino: res.destino,
        hotel: res.hotel || d.produto.hotel,
        tipoViagem: 'Nacional',
        servicos,
        servicosInclusos: servicos.map(s => s.nome).join(', '),
      },
      pagante,
    });
    this.resOpen.set(false);
  }

  // ── Passageiros ──
  get pagavaTambemViaja(): boolean {
    const d = this.draft();
    return !!d.pagante && !d.passageiros.some(p => p.clienteId === d.pagante?.id);
  }

  get nenhumPassageiro(): boolean {
    return !!this.tried()['pax'] && !this.draft().passageiros.some(p => (p.nome || '').trim());
  }

  addPax() {
    this.emit({ ...this.draft(), passageiros: [...this.draft().passageiros, { clienteId: null, nome: '', cpf: '', nascimento: '', valorIndividual: 0 }] });
  }

  removePax(i: number) {
    this.emit({ ...this.draft(), passageiros: this.draft().passageiros.filter((_, idx) => idx !== i) });
  }

  setPax(i: number, cliente: VendaCliente | null) {
    this.emit({
      ...this.draft(),
      passageiros: this.draft().passageiros.map((p, idx) => idx === i
        ? { ...p, clienteId: cliente ? cliente.id : null, nome: cliente ? cliente.nome : '', cpf: cliente ? cliente.cpf : '', nascimento: cliente ? cliente.nascimento : '' }
        : p),
    });
  }

  setPaxValor(i: number, val: number) {
    this.emit({ ...this.draft(), passageiros: this.draft().passageiros.map((p, idx) => idx === i ? { ...p, valorIndividual: num(val) } : p) });
  }

  paxAsCliente(p: VendaPassageiro): VendaCliente | null {
    return p.clienteId != null ? { id: p.clienteId, nome: p.nome, cpf: p.cpf, nascimento: p.nascimento } : null;
  }

  copiaPagante() {
    const d = this.draft();
    const pagante = d.pagante;
    if (!pagante) return;
    const jaTem = d.passageiros.some(p => p.clienteId === pagante.id);
    if (jaTem) return;
    const novo: VendaPassageiro = { clienteId: pagante.id, nome: pagante.nome, cpf: pagante.cpf || '', nascimento: pagante.nascimento || '', valorIndividual: 0 };
    const vazioIdx = d.passageiros.findIndex(p => !(p.nome || '').trim());
    const passageiros = vazioIdx >= 0 ? d.passageiros.map((p, i) => i === vazioIdx ? novo : p) : [...d.passageiros, novo];
    this.emit({ ...d, passageiros });
  }

  // ── Valores, pagamentos e comissão ──
  get baseCalculo(): number {
    return num(this.draft().valores.valorProduto);
  }

  get somaPag(): number {
    return somaPagamentos(this.draft().pagamentos);
  }

  get isAzulPacote(): boolean {
    const d = this.draft();
    return d.produto.tipo === 'Pacote' && d.produto.fornecedor === 'Azul Viagens';
  }

  get formasPagamento(): string[] {
    return this.isAzulPacote ? [...FORMAS_PAGAMENTO, 'Pontos TudoAzul'] : [...FORMAS_PAGAMENTO];
  }

  semParcelas(f: string): boolean {
    return f === 'PIX' || f === 'Dinheiro' || f === 'Transferência' || f === 'Pontos TudoAzul';
  }

  comVencimento(f: string): boolean {
    return f === 'Boleto';
  }

  addPag() {
    this.emit({ ...this.draft(), pagamentos: [...this.draft().pagamentos, { forma: 'PIX', info: '', parcelas: 1, vencimento: '', valor: 0, status: 'Pendente' }] });
  }

  removePag(i: number) {
    this.emit({ ...this.draft(), pagamentos: this.draft().pagamentos.filter((_, idx) => idx !== i) });
  }

  setPag<K extends keyof VendaPagamento>(i: number, key: K, val: VendaPagamento[K]) {
    this.emit({ ...this.draft(), pagamentos: this.draft().pagamentos.map((p, idx) => idx === i ? { ...p, [key]: val } : p) });
  }

  onFormaChange(i: number, forma: string) {
    const d = this.draft();
    this.emit({
      ...d,
      pagamentos: d.pagamentos.map((pp, idx) => idx === i
        ? { ...pp, forma: forma as VendaPagamento['forma'], parcelas: this.semParcelas(forma) ? 1 : pp.parcelas, vencimento: this.comVencimento(forma) ? pp.vencimento : '' }
        : pp),
    });
  }

  onPagVencimentoChange(i: number, iso: string) {
    if (!iso) { this.setPag(i, 'vencimento', ''); return; }
    const [y, m, dd] = iso.split('-');
    this.setPag(i, 'vencimento', `${dd}/${m}/${y}`);
  }

  pagVencimentoISO(p: VendaPagamento): string {
    return p.vencimento ? p.vencimento.split('/').reverse().join('-') : '';
  }

  onPercent(val: string) {
    const p = num(val);
    this.setComissaoBoth(p, Math.round(this.baseCalculo * p) / 100);
  }

  onValorComissao(val: number) {
    const valorC = num(val);
    const base = this.baseCalculo;
    const p = base > 0 ? Math.round((valorC / base) * 1000) / 10 : 0;
    this.setComissaoBoth(p, valorC);
  }

  private setComissaoBoth(p: number, valorC: number) {
    this.emit({ ...this.draft(), comissao: { ...this.draft().comissao, percentualFornecedor: p, valorComissaoFornecedor: valorC } });
  }

  // ── Revisão ──
  get passageirosPreenchidos(): VendaPassageiro[] {
    return this.draft().passageiros.filter(p => (p.nome || '').trim());
  }

  get servicosList() {
    const d = this.draft();
    return parseServicos(d.produto.servicos, d.produto.servicosInclusos);
  }
}
