<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
<h1>Clube Turismo Flow</h1>
<p><strong>Sistema de Gestao Multi-Tenant para Agencias de Viagens</strong></p>
</div>

---

## Visao Geral

O **Clube Turismo Flow** e uma plataforma para operacao de agencias de turismo com arquitetura multi-tenant, cobrindo reservas, hoteis, voos, cotacoes e creditos em um unico painel.

---

## Stack

- Frontend: Angular
- UI: Tailwind CSS
- Backend/Data: Supabase
- Billing: Stripe Embedded Checkout + Asaas + Webhooks

---

## Como Executar Localmente

### Pre-requisitos

- Node.js LTS
- Projeto Supabase configurado
- Conta Stripe com um `Price` mensal criado
- Conta Asaas com API key ativa

### Ambiente

Crie um arquivo `.env.local` com:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-anon-key-publica
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
GEMINI_API_KEY=sua-chave-opcional
STRIPE_SECRET_KEY=sk_test_...
STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_MONTHLY_PRICE_ID=price_...
STRIPE_WEBHOOK_SECRET=whsec_...
ASAAS_API_KEY=$aact_...
ASAAS_BASE_URL=https://sandbox.asaas.com/api
ASAAS_WEBHOOK_TOKEN=token-opcional
ASAAS_MONTHLY_AMOUNT=370
```

Notas da Stripe:

- `STRIPE_MONTHLY_PRICE_ID` precisa ser um `Price` recorrente mensal.
- Configure o webhook para `POST /api/stripe/webhook`.
- Eventos recomendados: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.

Notas do Asaas:

- Configure o webhook para `POST /api/asaas/webhook`.
- O token em `ASAAS_WEBHOOK_TOKEN` e opcional, mas recomendado.
- O Pix e exibido na propria pagina; o checkout de debito so abre fora quando o usuario clicar.

### Migracao Recomendada Sem Perder Dados

Se voce quer o caminho recomendado com risco minimo:

1. Rode o SQL em `supabase/migrations/20260406_hybrid_checkout.sql` no Supabase.
2. O script adiciona os campos de status/provedor/metodo e cria a tabela de idempotencia `payment_webhook_events`.
3. Nenhuma coluna antiga e removida.

Resumo do que o script faz:

- adiciona campos de status e identificadores em `companies`
- adiciona colunas de rastreamento de cobranca em `saas_invoices`
- cria `payment_webhook_events` para tolerancia a repeticao de webhook

Isso permite usar Stripe e Asaas no mesmo checkout, com logs e sincronizacao mais robustos.

### Instalar Dependencias

```bash
npm install
```

### Rodar em Desenvolvimento

```bash
npm run dev
```

Para simular as functions da pasta `api`, use:

```bash
npm run vercel:dev
```

---

## Fluxo de Checkout

- Cartao de credito recorrente: Stripe Embedded Checkout dentro da pagina.
- Pix: Asaas com QR Code e copia e cola exibidos dentro da propria UI.
- Cartao de debito: Asaas com invoice hospedada aberta apenas quando o usuario clicar.
- Os webhooks de Stripe e Asaas atualizam `subscription_status`, `payment_provider`, `payment_method`, `payment_status`, datas e historico de cobrancas.

### Seguranca Multi-Tenant

- As rotas Stripe validam a sessao autenticada do Supabase via token Bearer.
- Para usuarios comuns, a empresa usada no backend vem de `profiles.company_id`.
- Para admins, o `companyId` enviado no body pode ser usado como empresa alvo, desde que o usuario esteja autenticado.
- Isso evita que um tenant tente operar a assinatura de outra empresa apenas alterando o payload no navegador.
