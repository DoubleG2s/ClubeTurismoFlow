import { Injectable, computed, signal } from '@angular/core';
import { Venda, VendaCliente, VendaFormValue, todayBR } from '../models/venda';

export interface ReservaMini {
  id: string;
  tipo: string;
  voucher: string;
  destino: string;
  ida: string;
  volta: string;
  passageiros: string[];
  hotel: string;
  fornecedor: string;
  autor: string;
  temVenda: boolean;
}

const CLIENTES_MINI_SEED: VendaCliente[] = [
  { id: 0, nome: 'José Ricardo Hernandez', cpf: '324.887.109-55', nascimento: '14/06/1979' },
  { id: 1, nome: 'Rosa Maria Capeli', cpf: '512.330.887-14', nascimento: '22/09/1965' },
  { id: 2, nome: 'Carlos Vinícius Gava', cpf: '078.912.334-60', nascimento: '05/03/1982' },
  { id: 3, nome: 'Luís Antônio Bonfim', cpf: '445.109.882-33', nascimento: '30/06/1990' },
  { id: 4, nome: 'Camila Souza Rosa', cpf: '339.774.128-90', nascimento: '17/11/1988' },
  { id: 5, nome: 'Fernanda Liu', cpf: '601.223.554-07', nascimento: '08/06/1993' },
  { id: 6, nome: 'Helena Vasques', cpf: '217.665.330-48', nascimento: '26/04/1975' },
  { id: 7, nome: 'Tiago Moreira', cpf: '884.001.227-19', nascimento: '11/06/1985' },
  { id: 8, nome: 'Patrícia Amaral Nunes', cpf: '156.443.902-71', nascimento: '03/02/1980' },
  { id: 9, nome: 'Eduardo Salles Prado', cpf: '890.221.334-05', nascimento: '27/08/1972' },
  { id: 10, nome: 'Natane Gomes Gava', cpf: '223.774.128-91', nascimento: '12/05/1991' },
  { id: 11, nome: 'Ronaldo Dias Capeli', cpf: '512.330.887-15', nascimento: '19/01/1962' },
  { id: 12, nome: 'Otávio Vasques', cpf: '217.665.330-49', nascimento: '02/12/1974' },
  { id: 13, nome: 'Diego Liu', cpf: '601.223.554-08', nascimento: '23/09/1990' },
];

const RESERVAS_MINI: ReservaMini[] = [
  { id: '1R26T3', tipo: 'PACOTE', voucher: 'ALVHQG', destino: 'Maceió', ida: '01/06/2026', volta: '08/06/2026',
    passageiros: ['José Ricardo Hernandez', 'Maria A. L. Hernandez'], hotel: 'Ritz Lagoa da Anta', fornecedor: '', autor: 'Marcelo S.', temVenda: true },
  { id: 'YSPGXS', tipo: 'PACOTE', voucher: 'DW9ZQN', destino: 'Recife', ida: '02/06/2026', volta: '09/06/2026',
    passageiros: ['Ronaldo Dias Capeli', 'Rosa Maria Capeli'], hotel: 'Mar Hotel Conventions', fornecedor: '', autor: 'Ana Costa', temVenda: true },
  { id: 'ZJ4N5D', tipo: 'PACOTE', voucher: 'ZIBF3F', destino: 'Porto Seguro', ida: '03/06/2026', volta: '10/06/2026',
    passageiros: ['Carlos Vinícius Gava', 'Natane Gomes Gava', 'Celine Gomes Gava'], hotel: "Arraial d'Ajuda Eco Resort", fornecedor: 'Azul Viagens', autor: 'Guilherme H.', temVenda: true },
  { id: 'PG88RX', tipo: 'PACOTE', voucher: 'PG88RX', destino: 'Fernando de Noronha', ida: '12/06/2026', volta: '19/06/2026',
    passageiros: ['Luís Antônio Bonfim'], hotel: 'Pousada Maravilha', fornecedor: 'Orinter', autor: 'Ana Costa', temVenda: true },
  { id: 'QM33LV', tipo: 'PACOTE', voucher: 'QM33LV', destino: 'Búzios', ida: '25/06/2026', volta: '28/06/2026',
    passageiros: ['Camila Souza Rosa', 'Pedro Rosa', 'Olga Rosa', 'Bia Rosa'], hotel: 'Insólito Boutique', fornecedor: '', autor: 'Guilherme H.', temVenda: false },
  { id: 'GRM052', tipo: 'PACOTE', voucher: 'KW31PD', destino: 'Gramado', ida: '18/06/2026', volta: '22/06/2026',
    passageiros: ['Fernanda Liu', 'Diego Liu'], hotel: 'Wood Hotel', fornecedor: 'FRT Turismo', autor: 'Marcelo S.', temVenda: false },
  { id: 'JERI88', tipo: 'HOSPEDAGEM', voucher: '', destino: 'Jericoacoara', ida: '09/06/2026', volta: '14/06/2026',
    passageiros: ['Helena Vasques', 'Otávio Vasques'], hotel: 'Essenza Hotel', fornecedor: '', autor: 'Ana Costa', temVenda: false },
  { id: 'AZ4471', tipo: 'VOO', voucher: 'AZ4471', destino: 'Salvador (SSA)', ida: '06/06/2026', volta: '11/06/2026',
    passageiros: ['Tiago Moreira'], hotel: '', fornecedor: 'Azul Viagens', autor: 'Guilherme H.', temVenda: true },
];

const VENDAS_SEED: Venda[] = [
  {
    id: 1, numero: 100231, data: '28/05/2026', vendedor: 'Guilherme H.',
    pagante: { id: 2, nome: 'Carlos Vinícius Gava', cpf: '078.912.334-60', nascimento: '05/03/1982' },
    status: 'Confirmada', numeroReserva: 'ZJ4N5D', origem: null,
    produto: { ...blankProduto(), tipo: 'Pacote', numeroFornecedor: 'DCX73H', fornecedor: 'Azul Viagens',
      dataInicio: '03/06/2026', dataFim: '10/06/2026', tipoViagem: 'Nacional', destino: 'Porto Seguro',
      servicosInclusos: 'Aéreo, hotel, traslados e seguro', transporte: 'Voo regular',
      companhiaAerea: 'Azul', origem: 'Ribeirão Preto (RAO)', numeroVoo: 'AD 4522',
      hotel: "Arraial d'Ajuda Eco Resort", categoriaQuarto: 'Apartamento Superior (duplo)', regimeAlimentacao: 'All inclusive' },
    passageiros: [
      { clienteId: 2, nome: 'Carlos Vinícius Gava', cpf: '078.912.334-60', nascimento: '05/03/1982', valorIndividual: 4317.95 },
      { clienteId: 10, nome: 'Natane Gomes Gava', cpf: '223.774.128-91', nascimento: '12/05/1991', valorIndividual: 4317.95 },
    ],
    valores: { valorProduto: 8635.90, taxas: 433.20, outrasTaxas: 0, rav: 268.03, taxaRav: 10, desconto: 0 },
    pagamentos: [
      { forma: 'Cartão de Crédito', info: '', parcelas: 6, vencimento: '10/06/2026', valor: 6337.13, status: 'Pago' },
      { forma: 'PIX', info: '', parcelas: 1, vencimento: '28/05/2026', valor: 3000.00, status: 'Pago' },
    ],
    comissao: { percentualFornecedor: 12, valorComissaoFornecedor: 1036.31 },
    cadastradoPor: 'Guilherme H.', cadastradoEm: '28/05/2026',
  },
  {
    id: 2, numero: 100198, data: '20/05/2026', vendedor: 'Marcelo S.',
    pagante: { id: 0, nome: 'José Ricardo Hernandez', cpf: '324.887.109-55', nascimento: '14/06/1979' },
    status: 'Finalizada', numeroReserva: '1R26T3',
    origem: { cotacaoId: 'CT-2041', opcao: 'Resort Pé na Areia' },
    produto: { ...blankProduto(), tipo: 'Pacote', numeroFornecedor: 'ALVHQG', fornecedor: 'CVC',
      dataInicio: '01/06/2026', dataFim: '08/06/2026', tipoViagem: 'Nacional', destino: 'Maceió',
      servicosInclusos: 'Aéreo, hotel e café da manhã', transporte: 'Voo regular',
      companhiaAerea: 'LATAM', origem: 'Ribeirão Preto (RAO)', numeroVoo: 'LA 3218',
      hotel: 'Ritz Lagoa da Anta', categoriaQuarto: 'Standard (duplo)', regimeAlimentacao: 'Café da manhã' },
    passageiros: [{ clienteId: 0, nome: 'José Ricardo Hernandez', cpf: '324.887.109-55', nascimento: '14/06/1979', valorIndividual: 7200 }],
    valores: { valorProduto: 7200, taxas: 320, outrasTaxas: 0, rav: 0, taxaRav: 0, desconto: 200 },
    pagamentos: [{ forma: 'Boleto', info: '', parcelas: 3, vencimento: '05/06/2026', valor: 7320, status: 'Pago' }],
    comissao: { percentualFornecedor: 10, valorComissaoFornecedor: 720 },
    cadastradoPor: 'Marcelo S.', cadastradoEm: '20/05/2026',
  },
  {
    id: 3, numero: 100254, data: '30/05/2026', vendedor: 'Ana Costa',
    pagante: { id: 1, nome: 'Rosa Maria Capeli', cpf: '512.330.887-14', nascimento: '22/09/1965' },
    status: 'Aberta', numeroReserva: 'YSPGXS', origem: null,
    produto: { ...blankProduto(), tipo: 'Pacote', numeroFornecedor: 'DW9ZQN', fornecedor: 'Abreu Viagens',
      dataInicio: '02/06/2026', dataFim: '09/06/2026', tipoViagem: 'Nacional', destino: 'Recife',
      servicosInclusos: 'Aéreo e hotel', transporte: 'Voo regular',
      companhiaAerea: 'GOL', origem: 'Ribeirão Preto (RAO)', numeroVoo: 'G3 1147',
      hotel: 'Mar Hotel Conventions', categoriaQuarto: 'Superior (duplo)', regimeAlimentacao: 'Café da manhã' },
    passageiros: [
      { clienteId: 11, nome: 'Ronaldo Dias Capeli', cpf: '512.330.887-15', nascimento: '19/01/1962', valorIndividual: 2565 },
      { clienteId: 1, nome: 'Rosa Maria Capeli', cpf: '512.330.887-14', nascimento: '22/09/1965', valorIndividual: 2565 },
    ],
    valores: { valorProduto: 5100, taxas: 180, outrasTaxas: 0, rav: 150, taxaRav: 10, desconto: 0 },
    pagamentos: [{ forma: 'PIX', info: 'Sinal recebido', parcelas: 1, vencimento: '30/05/2026', valor: 2000, status: 'Pago' }],
    comissao: { percentualFornecedor: 11, valorComissaoFornecedor: 561 },
    cadastradoPor: 'Ana Costa', cadastradoEm: '30/05/2026',
  },
  {
    id: 4, numero: 100112, data: '02/05/2026', vendedor: 'Ana Costa',
    pagante: { id: 3, nome: 'Luís Antônio Bonfim', cpf: '445.109.882-33', nascimento: '30/06/1990' },
    status: 'Em crédito', numeroReserva: 'PG88RX', origem: null,
    produto: { ...blankProduto(), tipo: 'Pacote', numeroFornecedor: 'PG88RX', fornecedor: 'Orinter',
      dataInicio: '12/06/2026', dataFim: '19/06/2026', tipoViagem: 'Nacional', destino: 'Fernando de Noronha',
      servicosInclusos: 'Aéreo, pousada e taxa de preservação', transporte: 'Voo regular',
      companhiaAerea: 'Azul', origem: 'Ribeirão Preto (RAO)', numeroVoo: 'AD 5090',
      hotel: 'Pousada Maravilha', categoriaQuarto: 'Bangalô Premium', regimeAlimentacao: 'Meia pensão' },
    passageiros: [{ clienteId: 3, nome: 'Luís Antônio Bonfim', cpf: '445.109.882-33', nascimento: '30/06/1990', valorIndividual: 15200 }],
    valores: { valorProduto: 15200, taxas: 640, outrasTaxas: 120, rav: 420, taxaRav: 8, desconto: 0 },
    pagamentos: [{ forma: 'Transferência', info: '', parcelas: 1, vencimento: '02/05/2026', valor: 16380, status: 'Pago' }],
    comissao: { percentualFornecedor: 14, valorComissaoFornecedor: 2128 },
    cadastradoPor: 'Ana Costa', cadastradoEm: '02/05/2026',
  },
  {
    id: 5, numero: 100301, data: '01/06/2026', vendedor: 'Guilherme H.',
    pagante: { id: 7, nome: 'Tiago Moreira', cpf: '884.001.227-19', nascimento: '11/06/1985' },
    status: 'Cancelada', numeroReserva: 'AZ4471', origem: null,
    produto: { ...blankProduto(), tipo: 'Voo', numeroFornecedor: 'AZ4471', fornecedor: 'Azul Viagens',
      dataInicio: '06/06/2026', dataFim: '11/06/2026', tipoViagem: 'Nacional', destino: 'Salvador (SSA)',
      servicosInclusos: 'Aéreo', transporte: 'Voo regular',
      companhiaAerea: 'Azul', origem: 'Ribeirão Preto (RAO)', numeroVoo: 'AD 4471' },
    passageiros: [{ clienteId: 7, nome: 'Tiago Moreira', cpf: '884.001.227-19', nascimento: '11/06/1985', valorIndividual: 2800 }],
    valores: { valorProduto: 2800, taxas: 120, outrasTaxas: 0, rav: 0, taxaRav: 0, desconto: 0 },
    pagamentos: [{ forma: 'Cartão de Crédito', info: 'Estorno em processamento', parcelas: 1, vencimento: '01/06/2026', valor: 0, status: 'Pendente' }],
    comissao: { percentualFornecedor: 6, valorComissaoFornecedor: 168 },
    cadastradoPor: 'Guilherme H.', cadastradoEm: '01/06/2026',
  },
  {
    id: 6, numero: 100288, data: '26/05/2026', vendedor: 'Marcelo S.',
    pagante: { id: 8, nome: 'Patrícia Amaral Nunes', cpf: '156.443.902-71', nascimento: '03/02/1980' },
    status: 'Reembolsada', numeroReserva: 'GRM052', origem: null,
    produto: { ...blankProduto(), tipo: 'Pacote', numeroFornecedor: 'KW31PD', fornecedor: 'FRT Turismo',
      dataInicio: '18/06/2026', dataFim: '22/06/2026', tipoViagem: 'Nacional', destino: 'Gramado',
      servicosInclusos: 'Aéreo e hotel', transporte: 'Voo regular',
      companhiaAerea: 'GOL', origem: 'Porto Alegre (POA)', numeroVoo: 'G3 2205',
      hotel: 'Wood Hotel', categoriaQuarto: 'Luxo (casal)', regimeAlimentacao: 'Café da manhã' },
    passageiros: [{ clienteId: 8, nome: 'Patrícia Amaral Nunes', cpf: '156.443.902-71', nascimento: '03/02/1980', valorIndividual: 6200 }],
    valores: { valorProduto: 6200, taxas: 260, outrasTaxas: 0, rav: 0, taxaRav: 0, desconto: 0 },
    pagamentos: [{ forma: 'Boleto', info: 'Reembolsado ao cliente', parcelas: 1, vencimento: '26/05/2026', valor: 6460, status: 'Pago' }],
    comissao: { percentualFornecedor: 9, valorComissaoFornecedor: 558 },
    cadastradoPor: 'Marcelo S.', cadastradoEm: '26/05/2026',
  },
];

function blankProduto() {
  return {
    tipo: 'Pacote' as const, numeroFornecedor: '', fornecedor: '', representante: '',
    dataInicio: '', dataFim: '', tipoViagem: 'Nacional' as const, destino: '', servicosInclusos: '', servicos: [] as { nome: string; detalhe: string }[], transporte: '',
    companhiaAerea: '', numeroVoo: '', origem: '', bagagem: '',
    hotel: '', localizadorHotel: '', categoriaQuarto: '', regimeAlimentacao: '',
    ciaMaritima: '', nomeNavio: '', numeroCabine: '', categoriaCabine: '', portoEmbarque: '', portoDesembarque: '',
    seguradora: '',
    origemTransfer: '', destinoTransfer: '',
  };
}

/**
 * Serviço de Vendas — protótipo visual "plug-and-play": estado 100% em memória
 * (signals), sem integração com Supabase ainda. A forma dos métodos (Observable-like
 * via signals síncronos) já espelha o padrão de VendaService/ClienteService para
 * facilitar a troca futura por chamadas reais ao backend.
 */
@Injectable({ providedIn: 'root' })
export class VendaService {
  private vendasSignal = signal<Venda[]>(VENDAS_SEED);
  private clientesSignal = signal<VendaCliente[]>(CLIENTES_MINI_SEED);
  private reservasSignal = signal<ReservaMini[]>(RESERVAS_MINI);

  readonly vendas = computed(() => this.vendasSignal());
  readonly clientesMini = computed(() => this.clientesSignal());
  readonly reservasMini = computed(() => this.reservasSignal());

  createCliente(data: { nome: string; cpf: string; nascimento: string }): VendaCliente {
    const id = Math.max(-1, ...this.clientesSignal().map(c => c.id)) + 1;
    const created: VendaCliente = { id, nome: data.nome, cpf: data.cpf || '', nascimento: data.nascimento || '' };
    this.clientesSignal.update(cs => [created, ...cs]);
    return created;
  }

  createVenda(value: VendaFormValue): Venda {
    const numero = Math.max(100000, ...this.vendasSignal().map(v => v.numero)) + 1;
    let numeroReserva = value.numeroReserva || value.produto.numeroFornecedor;
    if (!numeroReserva) {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      numeroReserva = '';
      for (let i = 0; i < 6; i++) numeroReserva += chars[Math.floor(Math.random() * chars.length)];
    }
    const nova: Venda = {
      ...value,
      id: Date.now(),
      numero,
      numeroReserva,
      cadastradoPor: 'Guilherme H.',
      cadastradoEm: todayBR(),
    };
    this.vendasSignal.update(vs => [nova, ...vs]);
    return nova;
  }

  updateVenda(id: number, value: VendaFormValue): Venda {
    let updated!: Venda;
    this.vendasSignal.update(vs => vs.map(v => {
      if (v.id !== id) return v;
      updated = { ...v, ...value };
      return updated;
    }));
    return updated;
  }

  deleteVenda(id: number) {
    this.vendasSignal.update(vs => vs.filter(v => v.id !== id));
  }
}
