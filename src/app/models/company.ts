export interface Company {
  id: string;
  name: string;
  slug: string;
  billing_email?: string;
  billing_postal_code?: string;
  stripe_customer_id?: string;
  stripe_subscription_id?: string;
  asaas_customer_id?: string;
  asaas_payment_id?: string;
  asaas_subscription_id?: string;
  subscription_status?: 'inactive' | 'active' | 'trial' | 'past_due' | 'canceled';
  subscription_plan?: string;
  subscription_expires_at?: string;
  payment_provider?: 'stripe' | 'asaas' | null;
  payment_method?: 'credit_card' | 'pix' | 'debit_card' | null;
  payment_status?: 'pending' | 'paid' | 'failed' | 'canceled' | null;
  pix_automatic_authorization_id?: string;
  paid_at?: string;
  next_due_date?: string;
  external_checkout_url?: string;
  tax_id?: string;
  created_at: string;
  updated_at: string;
}
