export interface SaasInvoice {
  id: string;
  company_id: string;
  stripe_payment_id?: string | null;
  stripe_subscription_id?: string | null;
  asaas_payment_id?: string | null;
  asaas_subscription_id?: string | null;
  payment_provider?: 'stripe' | 'asaas' | null;
  payment_method?: 'credit_card' | 'pix' | 'debit_card' | null;
  value: number;
  status: 'PENDING' | 'RECEIVED' | 'OVERDUE' | 'CANCELED';
  due_date: string;
  payment_url?: string | null;
  external_checkout_url?: string | null;
  pix_encoded?: string | null;
  paid_at?: string | null;
  created_at: string;
  updated_at: string;
}
