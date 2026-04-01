export interface SaasInvoice {
  id: string;
  company_id: string;
  asaas_payment_id: string;
  asaas_subscription_id?: string;
  value: number;
  status: 'PENDING' | 'RECEIVED' | 'OVERDUE' | 'CANCELED';
  due_date: string;
  payment_url?: string;
  pix_encoded?: string;
  created_at: string;
  updated_at: string;
}
