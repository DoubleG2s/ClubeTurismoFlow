-- Verificacao do schema necessario para o checkout de assinatura.
-- Este script nao altera nada no banco. Ele apenas mostra o que esta faltando.

-- 1. Tabelas obrigatorias
with expected_tables as (
  select 'companies' as table_name
  union all select 'profiles'
  union all select 'saas_invoices'
  union all select 'payment_webhook_events'
),
actual_tables as (
  select table_name
  from information_schema.tables
  where table_schema = 'public'
)
select
  et.table_name,
  case when at.table_name is not null then 'OK' else 'MISSING' end as status
from expected_tables et
left join actual_tables at
  on at.table_name = et.table_name
order by et.table_name;

-- 2. Colunas obrigatorias por tabela
with expected_columns as (
  select 'companies' as table_name, 'id' as column_name
  union all select 'companies', 'name'
  union all select 'companies', 'billing_email'
  union all select 'companies', 'billing_postal_code'
  union all select 'companies', 'tax_id'
  union all select 'companies', 'subscription_status'
  union all select 'companies', 'subscription_plan'
  union all select 'companies', 'subscription_expires_at'
  union all select 'companies', 'payment_provider'
  union all select 'companies', 'payment_method'
  union all select 'companies', 'payment_status'
  union all select 'companies', 'stripe_customer_id'
  union all select 'companies', 'stripe_subscription_id'
  union all select 'companies', 'asaas_customer_id'
  union all select 'companies', 'asaas_payment_id'
  union all select 'companies', 'asaas_subscription_id'
  union all select 'companies', 'pix_automatic_authorization_id'
  union all select 'companies', 'paid_at'
  union all select 'companies', 'next_due_date'
  union all select 'companies', 'external_checkout_url'

  union all select 'profiles', 'id'
  union all select 'profiles', 'company_id'
  union all select 'profiles', 'role'

  union all select 'saas_invoices', 'id'
  union all select 'saas_invoices', 'company_id'
  union all select 'saas_invoices', 'stripe_payment_id'
  union all select 'saas_invoices', 'stripe_subscription_id'
  union all select 'saas_invoices', 'asaas_payment_id'
  union all select 'saas_invoices', 'asaas_subscription_id'
  union all select 'saas_invoices', 'payment_provider'
  union all select 'saas_invoices', 'payment_method'
  union all select 'saas_invoices', 'value'
  union all select 'saas_invoices', 'status'
  union all select 'saas_invoices', 'due_date'
  union all select 'saas_invoices', 'payment_url'
  union all select 'saas_invoices', 'external_checkout_url'
  union all select 'saas_invoices', 'pix_encoded'
  union all select 'saas_invoices', 'paid_at'
  union all select 'saas_invoices', 'created_at'
  union all select 'saas_invoices', 'updated_at'

  union all select 'payment_webhook_events', 'id'
  union all select 'payment_webhook_events', 'provider'
  union all select 'payment_webhook_events', 'event_type'
  union all select 'payment_webhook_events', 'company_id'
  union all select 'payment_webhook_events', 'payload'
  union all select 'payment_webhook_events', 'processed_at'
  union all select 'payment_webhook_events', 'created_at'
),
actual_columns as (
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
)
select
  ec.table_name,
  ec.column_name,
  case when ac.column_name is not null then 'OK' else 'MISSING' end as status
from expected_columns ec
left join actual_columns ac
  on ac.table_name = ec.table_name
 and ac.column_name = ec.column_name
order by ec.table_name, ec.column_name;

-- 3. Colunas faltando apenas
with expected_columns as (
  select 'companies' as table_name, 'id' as column_name
  union all select 'companies', 'name'
  union all select 'companies', 'billing_email'
  union all select 'companies', 'billing_postal_code'
  union all select 'companies', 'tax_id'
  union all select 'companies', 'subscription_status'
  union all select 'companies', 'subscription_plan'
  union all select 'companies', 'subscription_expires_at'
  union all select 'companies', 'payment_provider'
  union all select 'companies', 'payment_method'
  union all select 'companies', 'payment_status'
  union all select 'companies', 'stripe_customer_id'
  union all select 'companies', 'stripe_subscription_id'
  union all select 'companies', 'asaas_customer_id'
  union all select 'companies', 'asaas_payment_id'
  union all select 'companies', 'asaas_subscription_id'
  union all select 'companies', 'pix_automatic_authorization_id'
  union all select 'companies', 'paid_at'
  union all select 'companies', 'next_due_date'
  union all select 'companies', 'external_checkout_url'

  union all select 'profiles', 'id'
  union all select 'profiles', 'company_id'
  union all select 'profiles', 'role'

  union all select 'saas_invoices', 'id'
  union all select 'saas_invoices', 'company_id'
  union all select 'saas_invoices', 'stripe_payment_id'
  union all select 'saas_invoices', 'stripe_subscription_id'
  union all select 'saas_invoices', 'asaas_payment_id'
  union all select 'saas_invoices', 'asaas_subscription_id'
  union all select 'saas_invoices', 'payment_provider'
  union all select 'saas_invoices', 'payment_method'
  union all select 'saas_invoices', 'value'
  union all select 'saas_invoices', 'status'
  union all select 'saas_invoices', 'due_date'
  union all select 'saas_invoices', 'payment_url'
  union all select 'saas_invoices', 'external_checkout_url'
  union all select 'saas_invoices', 'pix_encoded'
  union all select 'saas_invoices', 'paid_at'
  union all select 'saas_invoices', 'created_at'
  union all select 'saas_invoices', 'updated_at'

  union all select 'payment_webhook_events', 'id'
  union all select 'payment_webhook_events', 'provider'
  union all select 'payment_webhook_events', 'event_type'
  union all select 'payment_webhook_events', 'company_id'
  union all select 'payment_webhook_events', 'payload'
  union all select 'payment_webhook_events', 'processed_at'
  union all select 'payment_webhook_events', 'created_at'
),
actual_columns as (
  select table_name, column_name
  from information_schema.columns
  where table_schema = 'public'
)
select
  ec.table_name,
  ec.column_name
from expected_columns ec
left join actual_columns ac
  on ac.table_name = ec.table_name
 and ac.column_name = ec.column_name
where ac.column_name is null
order by ec.table_name, ec.column_name;

-- 4. Indices importantes para o checkout
with expected_indexes as (
  select 'saas_invoices_stripe_payment_id_key' as index_name
  union all select 'saas_invoices_asaas_payment_id_key'
  union all select 'payment_webhook_events_provider_idx'
),
actual_indexes as (
  select indexname as index_name
  from pg_indexes
  where schemaname = 'public'
)
select
  ei.index_name,
  case when ai.index_name is not null then 'OK' else 'MISSING' end as status
from expected_indexes ei
left join actual_indexes ai
  on ai.index_name = ei.index_name
order by ei.index_name;
