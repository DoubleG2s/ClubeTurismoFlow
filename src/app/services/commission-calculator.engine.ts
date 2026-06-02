import { CommissionCalculationData } from '../models/commission-calculation';

export interface CommissionCalculationResult {
  subtotal: number;
  valorComDesconto: number;
  comissaoOriginal: number;
  comissaoFinal: number;
  comissaoCheia: number;
  diferencaOriginal: number;
  diferencaCheia: number;
  ravOriginal: number;
  ravCheia: number;
  
  traslado: number;
  seguro: number;
  encargos: number;
  taxas: number;
  
  comissaoTraslado: number;
  comissaoSeguro: number;
  
  totalComissao: number;
  totalOriginal: number;
  totalComDesconto: number;
}

export class CommissionCalculatorEngine {
  
  /**
   * Converte uma string formatada em número (ex: "1.000,50" -> 1000.50)
   * Aceita também ponto como decimal (ex: "1000.50" -> 1000.50)
   */
  public static toNumber(value: string | number): number {
    if (typeof value === 'number') return value;
    if (!value) return 0;
    
    // Remove tudo exceto números, vírgulas e pontos
    const cleanStr = value.toString().replace(/[^\d.,-]/g, '');
    
    // Se não há vírgula, assume que o ponto (se existir) é o decimal
    if (cleanStr.indexOf(',') === -1) {
      const parsed = parseFloat(cleanStr);
      return isNaN(parsed) ? 0 : parsed;
    }
    
    // Se há vírgula, remove pontos (milhar) e troca vírgula por ponto (decimal)
    const normalizedStr = cleanStr.replace(/\./g, '').replace(',', '.');
    const parsed = parseFloat(normalizedStr);
    return isNaN(parsed) ? 0 : parsed;
  }

  /**
   * Calcula todos os valores e margens com base nos inputs do usuário
   */
  public static calculate(data: CommissionCalculationData): CommissionCalculationResult {
    const subtotal = this.toNumber(data.pacote);
    const desconto = this.toNumber(data.desconto);
    const comissao = this.toNumber(data.comissao);
    const descontoComissao = this.toNumber(data.descontoComissao);
    
    const valorComDesconto = subtotal * (1 - desconto / 100);
    const comissaoOriginal = subtotal * (comissao / 100);
    const comissaoFinal = valorComDesconto * ((comissao - descontoComissao) / 100);
    const comissaoCheia = valorComDesconto * (comissao / 100);
    
    const diferencaOriginal = comissaoOriginal - comissaoFinal;
    const diferencaCheia = comissaoCheia - comissaoFinal;
    
    const ravOriginal = diferencaOriginal / 0.85;
    const ravCheia = diferencaCheia / 0.85;

    const traslado = this.toNumber(data.traslado);
    const comissaoTrasladoPerc = this.toNumber(data.comissaoTraslado);
    const seguro = this.toNumber(data.seguro);
    const comissaoSeguroPerc = this.toNumber(data.comissaoSeguro);
    const encargos = this.toNumber(data.encargos);
    const taxas = this.toNumber(data.taxas);

    const comissaoTraslado = traslado * (comissaoTrasladoPerc / 100);
    const comissaoSeguro = seguro * (comissaoSeguroPerc / 100);
    
    const totalComissao = comissaoFinal + comissaoTraslado + comissaoSeguro;
    const totalOriginal = subtotal + traslado + seguro + encargos + taxas;
    const totalComDesconto = valorComDesconto + traslado + seguro + encargos + taxas;

    return {
      subtotal,
      valorComDesconto,
      comissaoOriginal,
      comissaoFinal,
      comissaoCheia,
      diferencaOriginal,
      diferencaCheia,
      ravOriginal,
      ravCheia,
      traslado,
      seguro,
      encargos,
      taxas,
      comissaoTraslado,
      comissaoSeguro,
      totalComissao,
      totalOriginal,
      totalComDesconto
    };
  }

  /**
   * Retorna os valores padrões (vazios/default) iniciais para uma nova simulação
   */
  public static getInitialData(): CommissionCalculationData {
    return {
      pacote: '',
      desconto: '15',
      comissao: '13',
      descontoComissao: '5',
      traslado: '',
      comissaoTraslado: '13',
      seguro: '',
      comissaoSeguro: '40',
      encargos: '',
      taxas: ''
    };
  }
}
