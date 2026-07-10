export interface CommissionCalculationData {
  pacote: string;
  desconto: string;
  comissao: string;
  descontoComissao: string;
  traslado: string;
  comissaoTraslado: string;
  seguro: string;
  comissaoSeguro: string;
  encargos: string;
  taxas: string;
  creator_name?: string;
  // Campos visuais do card (metaForm)
  hospedagem?: string;
  dataIda?: string;
  dataVolta?: string;
  nome?: string;
  adultos?: number;
  criancas?: number;
}

export interface CommissionCalculation {
  id: string;
  company_id?: string;
  created_by?: string;
  title: string;
  customer_name?: string | null;
  calculation_data: CommissionCalculationData;
  notes?: string | null;
  created_at?: string;
  updated_at?: string;
}
