import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, computed, inject, signal } from '@angular/core';
import {
  FORMAS_PAGAMENTO, FORNECEDORES, PRODUTO_TIPOS, STATUS_PAGAMENTO, STATUS_VENDA,
  Venda, VendaCliente, VendaFormValue, VendaPagamento, VendaPassageiro, VendaProduto, VendaValores,
  brl, calcReceitaPrevista, calcValorTotal, num, saldoInfo, somaPagamentos
} from '../../models/venda';
import { VendaService, ReservaMini } from '../../services/venda.service';
import { VendaClienteAutocompleteComponent } from '../venda-shared/venda-cliente-autocomplete.component';
import { VendaCurrencyInputComponent } from '../venda-shared/venda-currency-input.component';
import { VendaServicosEditorComponent } from '../venda-shared/venda-servicos-editor.component';

const VENDEDORES_LOCAL = ['Marcelo S.', 'Ana Costa', 'Guilherme H.'];
const TIPO_MAP: Record<string, string> = { PACOTE: 'Pacote', VOO: 'Voo', HOSPEDAGEM: 'Hospedagem', CRUZEIRO: 'Cruzeiro' };

function toFormValue(v: Venda): VendaFormValue {
  const { id, numero, cadastradoPor, cadastradoEm, ...rest } = v;
  return JSON.parse(JSON.stringify(rest));
}

@Component({
  selector: 'app-venda-form',
  standalone: true,
  imports: [CommonModule, VendaClienteAutocompleteComponent, VendaCurrencyInputComponent, VendaServicosEditorComponent],
  templateUrl: './venda-form.component.html'
})
export class VendaFormComponent implements OnChanges {
  private vendaService = inject(VendaService);

  @Input({ required: true }) venda!: Venda;
  @Input() submitLabel = 'Salvar alterações';
  @Input() showCancel = true;
  @Input() isSaving = false;

  @Output() save = new EventEmitter<VendaFormValue>();
  @Output() cancel = new EventEmitter<void>();

  readonly vendedores = VENDEDORES_LOCAL;
  readonly fornecedores = FORNECEDORES;
  readonly produtoTipos = PRODUTO_TIPOS;
  readonly statusVenda = STATUS_VENDA;
  readonly statusPagamento = STATUS_PAGAMENTO;

  draft = signal<VendaFormValue>(blankDraft());

  resQuery = signal('');
  resOpen = signal(false);

  clientes = this.vendaService.clientesMini;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['venda'] && this.venda) {
      this.draft.set(toFormValue(this.venda));
    }
  }

  // ── Helpers de leitura (computed sobre o draft) ──
  valorTotal = computed(() => calcValorTotal(this.draft().valores));
  baseCalculo = computed(() => num(this.draft().valores.valorProduto));
  receitaPrevista = computed(() => calcReceitaPrevista(this.draft().comissao, this.draft().valores));
  somaPag = computed(() => somaPagamentos(this.draft().pagamentos));
  saldo = computed(() => saldoInfo(this.draft().pagamentos, this.valorTotal()));

  get isVoo(): boolean {
    return this.draft().produto.tipo === 'Voo';
  }

  get tipoProd(): string {
    return this.draft().produto.tipo;
  }

  get transporteOpts(): string[] | null {
    const t = this.tipoProd;
    if (t === 'Voo') return ['Voo regular', 'Voo fretado', 'Bloqueio aéreo'];
    if (t === 'Pacote') return ['Voo regular', 'Voo fretado', 'Bloqueio aéreo', 'Rodoviário', 'Cruzeiro', '—'];
    if (t === 'Transfer') return ['Regular', 'Privativo'];
    if (t === 'Passeio') return ['Regular', 'Privativo', '—'];
    if (t === 'Outros') return ['Voo regular', 'Rodoviário', '—'];
    return null;
  }

  get showTransporte(): boolean {
    return this.transporteOpts !== null;
  }

  get isAzulPacote(): boolean {
    return this.tipoProd === 'Pacote' && this.draft().produto.fornecedor === 'Azul Viagens';
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

  // ── Setters genéricos ──
  set<K extends keyof VendaFormValue>(key: K, val: VendaFormValue[K]) {
    this.draft.update(d => ({ ...d, [key]: val }));
  }

  setProduto<K extends keyof VendaProduto>(key: K, val: VendaProduto[K]) {
    this.draft.update(d => ({ ...d, produto: { ...d.produto, [key]: val } }));
  }

  setValores<K extends keyof VendaValores>(key: K, val: VendaValores[K]) {
    this.draft.update(d => ({ ...d, valores: { ...d.valores, [key]: val } }));
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

  onNumeroFornecedorChange(val: string) {
    const upper = val.toUpperCase();
    this.draft.update(d => ({
      ...d,
      numeroReserva: d.numeroReserva && d.numeroReserva !== d.produto.numeroFornecedor ? d.numeroReserva : upper,
      produto: { ...d.produto, numeroFornecedor: upper },
    }));
  }

  onServicosCommit(evt: { servicos: { nome: string; detalhe: string }[]; nomes: string }) {
    this.draft.update(d => ({ ...d, produto: { ...d.produto, servicos: evt.servicos, servicosInclusos: evt.nomes } }));
  }

  // ── Reserva (vincular) ──
  reservasMini = this.vendaService.reservasMini;

  resMatches = computed(() => {
    const term = this.resQuery().trim().toUpperCase();
    const list = this.reservasMini();
    if (!term) return list.filter(r => !r.temVenda).slice(0, 6);
    return list.filter(r => r.id.includes(term) || r.destino.toUpperCase().includes(term) || r.passageiros.some(p => p.toUpperCase().includes(term))).slice(0, 6);
  });

  importReserva(res: ReservaMini) {
    const paxList: VendaPassageiro[] = res.passageiros.map(nome => {
      const found = this.clientes().find((c: VendaCliente) => c.nome.toLowerCase() === nome.toLowerCase());
      return found
        ? { clienteId: found.id, nome: found.nome, cpf: found.cpf, nascimento: found.nascimento, valorIndividual: 0 }
        : { clienteId: null, nome, cpf: '', nascimento: '', valorIndividual: 0 };
    });

    this.draft.update(d => ({
      ...d,
      numeroReserva: res.id,
      vendedor: d.vendedor || res.autor,
      produto: {
        ...d.produto,
        tipo: (TIPO_MAP[res.tipo] as VendaProduto['tipo']) || 'Pacote',
        numeroFornecedor: res.voucher || '',
        fornecedor: res.fornecedor || d.produto.fornecedor,
        dataInicio: res.ida,
        dataFim: res.volta,
        destino: res.destino,
        tipoViagem: 'Nacional',
      },
      passageiros: paxList.length > 0 ? paxList : d.passageiros,
      pagante: paxList.length > 0 && paxList[0].clienteId != null
        ? { id: paxList[0].clienteId, nome: paxList[0].nome, cpf: paxList[0].cpf, nascimento: paxList[0].nascimento }
        : d.pagante,
    }));
    this.resOpen.set(false);
    this.resQuery.set('');
  }

  desvincularReserva() {
    this.set('numeroReserva', '');
  }

  // ── Passageiros ──
  addPax() {
    this.draft.update(d => ({ ...d, passageiros: [...d.passageiros, { clienteId: null, nome: '', cpf: '', nascimento: '', valorIndividual: 0 }] }));
  }

  removePax(i: number) {
    this.draft.update(d => ({ ...d, passageiros: d.passageiros.filter((_, idx) => idx !== i) }));
  }

  setPax(i: number, cliente: VendaCliente | null) {
    this.draft.update(d => ({
      ...d,
      passageiros: d.passageiros.map((p, idx) => idx === i
        ? { ...p, clienteId: cliente ? cliente.id : null, nome: cliente ? cliente.nome : '', cpf: cliente ? cliente.cpf : '', nascimento: cliente ? cliente.nascimento : '' }
        : p),
    }));
  }

  setPaxValor(i: number, val: number) {
    this.draft.update(d => ({ ...d, passageiros: d.passageiros.map((p, idx) => idx === i ? { ...p, valorIndividual: num(val) } : p) }));
  }

  paxAsCliente(p: VendaPassageiro): VendaCliente | null {
    return p.clienteId != null ? { id: p.clienteId, nome: p.nome, cpf: p.cpf, nascimento: p.nascimento } : null;
  }

  // ── Pagamentos ──
  addPag() {
    this.draft.update(d => ({ ...d, pagamentos: [...d.pagamentos, { forma: 'PIX', info: '', parcelas: 1, vencimento: '', valor: 0, status: 'Pendente' }] }));
  }

  removePag(i: number) {
    this.draft.update(d => ({ ...d, pagamentos: d.pagamentos.filter((_, idx) => idx !== i) }));
  }

  setPag<K extends keyof VendaPagamento>(i: number, key: K, val: VendaPagamento[K]) {
    this.draft.update(d => ({ ...d, pagamentos: d.pagamentos.map((p, idx) => idx === i ? { ...p, [key]: val } : p) }));
  }

  onFormaChange(i: number, forma: string) {
    this.draft.update(d => ({
      ...d,
      pagamentos: d.pagamentos.map((pp, idx) => idx === i
        ? { ...pp, forma: forma as VendaPagamento['forma'], parcelas: this.semParcelas(forma) ? 1 : pp.parcelas, vencimento: this.comVencimento(forma) ? pp.vencimento : '' }
        : pp),
    }));
  }

  onPagVencimentoChange(i: number, iso: string) {
    if (!iso) { this.setPag(i, 'vencimento', ''); return; }
    const [y, m, dd] = iso.split('-');
    this.setPag(i, 'vencimento', `${dd}/${m}/${y}`);
  }

  pagVencimentoISO(p: VendaPagamento): string {
    return p.vencimento ? p.vencimento.split('/').reverse().join('-') : '';
  }

  // ── Comissão bidirecional ──
  onPercent(val: string) {
    const p = num(val);
    this.setComissaoBoth(p, Math.round(this.baseCalculo() * p) / 100);
  }

  onValorComissao(val: number) {
    const valorC = num(val);
    const base = this.baseCalculo();
    const p = base > 0 ? Math.round((valorC / base) * 1000) / 10 : 0;
    this.setComissaoBoth(p, valorC);
  }

  private setComissaoBoth(p: number, valorC: number) {
    this.draft.update(d => ({ ...d, comissao: { ...d.comissao, percentualFornecedor: p, valorComissaoFornecedor: valorC } }));
  }

  brl = brl;
  num = num;

  onSubmit() {
    this.save.emit(this.draft());
  }
}

function blankDraft(): VendaFormValue {
  return {
    data: '', vendedor: '', pagante: null, status: 'Aberta', numeroReserva: '', origem: null,
    produto: {
      tipo: 'Pacote', numeroFornecedor: '', fornecedor: '', representante: '',
      dataInicio: '', dataFim: '', tipoViagem: 'Nacional', destino: '', servicosInclusos: '', servicos: [], transporte: '',
      companhiaAerea: '', numeroVoo: '', origem: '', bagagem: '',
      hotel: '', localizadorHotel: '', categoriaQuarto: '', regimeAlimentacao: '',
      ciaMaritima: '', nomeNavio: '', numeroCabine: '', categoriaCabine: '', portoEmbarque: '', portoDesembarque: '',
      seguradora: '', origemTransfer: '', destinoTransfer: '',
    },
    passageiros: [{ clienteId: null, nome: '', cpf: '', nascimento: '', valorIndividual: 0 }],
    valores: { valorProduto: 0, taxas: 0, outrasTaxas: 0, rav: 0, taxaRav: 0, desconto: 0 },
    pagamentos: [{ forma: 'PIX', info: '', parcelas: 1, vencimento: '', valor: 0, status: 'Pendente' }],
    comissao: { percentualFornecedor: 0, valorComissaoFornecedor: 0 },
  };
}
