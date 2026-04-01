export interface Company {
  id: string;
  name: string;
  slug: string;
  // SaaS Subscription Fields
  asaas_customer_id?: string;
  asaas_subscription_id?: string;
  subscription_status?: 'inactive' | 'active' | 'past_due' | 'canceled';
  subscription_expires_at?: string;
  tax_id?: string; // CNPJ/CPF
  created_at: string;
  updated_at: string;
}
