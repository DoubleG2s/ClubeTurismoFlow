alter table if exists public.companies
  add column if not exists subscription_plan text,
  add column if not exists payment_provider text,
  add column if not exists payment_method text,
  add column if not exists payment_status text,
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists asaas_customer_id text,
  add column if not exists asaas_payment_id text,
  add column if not exists asaas_subscription_id text,
  add column if not exists pix_automatic_authorization_id text,
  add column if not exists paid_at timestamptz,
  add column if not exists next_due_date timestamptz,
  add column if not exists external_checkout_url text;

alter table if exists public.saas_invoices
  add column if not exists stripe_payment_id text,
  add column if not exists stripe_subscription_id text,
  add column if not exists asaas_payment_id text,
  add column if not exists asaas_subscription_id text,
  add column if not exists payment_provider text,
  add column if not exists payment_method text,
  add column if not exists external_checkout_url text,
  add column if not exists paid_at timestamptz;

create unique index if not exists saas_invoices_stripe_payment_id_key
  on public.saas_invoices (stripe_payment_id)
  where stripe_payment_id is not null;

create unique index if not exists saas_invoices_asaas_payment_id_key
  on public.saas_invoices (asaas_payment_id)
  where asaas_payment_id is not null;

create table if not exists public.payment_webhook_events (
  id text primary key,
  provider text not null,
  event_type text not null,
  company_id uuid null references public.companies(id) on delete set null,
  payload jsonb,
  processed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists payment_webhook_events_provider_idx
  on public.payment_webhook_events (provider, processed_at desc);
