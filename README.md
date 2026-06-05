# Clube Turismo Flow

Sistema web multi-tenant para gestao operacional de agencias de viagens. O projeto centraliza reservas, hoteis, voos, cotacoes, creditos, usuarios, calendario de embarques, propostas comerciais, calculo de comissoes e assinatura mensal da plataforma.

## Indice

- [Visao Geral](#visao-geral)
- [Principais Recursos](#principais-recursos)
- [Stack](#stack)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Pre-requisitos](#pre-requisitos)
- [Configuracao de Ambiente](#configuracao-de-ambiente)
- [Como Rodar Localmente](#como-rodar-localmente)
- [Banco de Dados e Supabase](#banco-de-dados-e-supabase)
- [Pagamentos e Assinaturas](#pagamentos-e-assinaturas)
- [Scripts Disponiveis](#scripts-disponiveis)
- [Deploy](#deploy)
- [Seguranca](#seguranca)
- [Troubleshooting](#troubleshooting)

## Visao Geral

O Clube Turismo Flow foi criado para apoiar a rotina de uma operadora ou agencia de turismo que trabalha com multiplas empresas/tenants. Cada empresa possui seus proprios dados operacionais, e o sistema usa Supabase para autenticacao, armazenamento e isolamento dos registros.

O frontend e uma aplicacao Angular servida na porta `3000` em desenvolvimento. As integracoes sensiveis ficam em functions serverless dentro da pasta `api/`, pensadas para execucao na Vercel.

## Principais Recursos

- Autenticacao com Supabase Auth.
- Controle multi-tenant por empresa.
- Gestao de reservas.
- Cadastro e consulta de hoteis.
- Cadastro e consulta de voos.
- Cotacoes e propostas comerciais.
- Geracao de proposta com dados de hotel, voo, assentos, bagagem e valores.
- Calculadora de comissao.
- Gestao de creditos.
- Calendario de embarques.
- Painel administrativo e gestao de usuarios.
- Leitura/interprete de voucher com IA.
- Extracao de PDF com `pdfjs-dist`.
- Assinatura mensal com Stripe e Asaas.
- Pix via Asaas com QR Code e copia e cola.
- Checkout externo de debito via Asaas.
- Checkout/cartao via Stripe.
- Webhooks para sincronizar status de assinatura e historico de faturas.

## Stack

- Angular 21
- TypeScript 5.9
- RxJS
- Tailwind CSS 3
- Lucide Angular
- Supabase JS
- Stripe
- Asaas
- Google Generative AI
- Vercel Serverless Functions
- Node.js
- npm

## Estrutura do Projeto

```text
.
|-- api/                         Functions serverless usadas pela Vercel
|   |-- asaas/                   Endpoints e helpers do Asaas
|   |-- stripe/                  Endpoints e helpers da Stripe
|   |-- extract-voucher.js       Extracao/interprete de voucher
|   `-- interpreter.js           Endpoint de IA/interprete
|-- assets/                      Imagens e arquivos estaticos
|-- src/
|   |-- app/
|   |   |-- animations/          Animacoes da aplicacao
|   |   |-- components/          Componentes reutilizaveis e telas legadas
|   |   |-- features/            Paginas principais por dominio
|   |   |-- layout/              Shell principal da aplicacao
|   |   |-- models/              Tipos e contratos do dominio
|   |   |-- services/            Integracoes, estado remoto e regras de negocio
|   |   `-- shared/              Utilitarios compartilhados
|   `-- environments/            Arquivos gerados por inject-env.js
|-- supabase/
|   |-- migrations/              Scripts SQL versionados
|   `-- verify_checkout_schema.sql
|-- angular.json                 Configuracao Angular
|-- inject-env.js                Injeta variaveis nos environments Angular
|-- package.json                 Scripts e dependencias
`-- package-lock.json            Lockfile npm
```

Aliases configurados no TypeScript:

```text
@app/*
@components/*
@features/*
@services/*
@models/*
@env/*
```

## Pre-requisitos

- Node.js compativel com Angular 21.
- npm.
- Projeto Supabase configurado.
- Chaves do Supabase.
- Conta Stripe, caso use checkout por cartao/assinatura Stripe.
- Conta Asaas, caso use Pix/debito/assinatura Asaas.
- Vercel CLI para testar as functions localmente.

Instale as dependencias:

```bash
npm install
```

## Configuracao de Ambiente

O projeto usa arquivos `.env` e `.env.local`, que nao devem ser commitados. O arquivo de referencia e `.env.example`.

Crie um `.env.local` para desenvolvimento:

```env
SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_ANON_KEY=sua-chave-publica-do-supabase
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key

GEMINI_API_KEY=
API_BASE_URL=

STRIPE_SECRET_KEY=sk_test_ou_sk_live
STRIPE_PUBLISHABLE_KEY=pk_test_ou_pk_live
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_MONTHLY_PRICE_ID=price_...

ASAAS_API_KEY=$aact_...
ASAAS_BASE_URL=https://sandbox.asaas.com/api
ASAAS_WEBHOOK_TOKEN=defina-um-token-opcional-para-validar-o-webhook
ASAAS_MONTHLY_AMOUNT=5
```

Quando desenvolvimento/teste e producao usam chaves diferentes, prefira os prefixos explicitos:

```env
DEV_STRIPE_PUBLISHABLE_KEY=pk_test_...
DEV_ASAAS_MONTHLY_AMOUNT=5

PROD_STRIPE_PUBLISHABLE_KEY=pk_live_...
PROD_ASAAS_MONTHLY_AMOUNT=370
```

O mesmo padrao existe para:

- `DEV_SUPABASE_URL` / `PROD_SUPABASE_URL`
- `DEV_SUPABASE_ANON_KEY` / `PROD_SUPABASE_ANON_KEY`
- `DEV_GEMINI_API_KEY` / `PROD_GEMINI_API_KEY`
- `DEV_API_BASE_URL` / `PROD_API_BASE_URL`

### Como o `inject-env.js` funciona

Antes de rodar ou buildar, os scripts chamam:

```bash
npm run inject
```

Esse comando le `.env` e, em ambiente nao produtivo, tambem le `.env.local` com prioridade maior para o ambiente de desenvolvimento. O arquivo de producao e gerado sem deixar `.env.local` sobrescrever os valores produtivos.

Depois ele gera:

- `src/environments/environment.ts`
- `src/environments/environment.prod.ts`

Variaveis injetadas no Angular:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `GEMINI_API_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `API_BASE_URL`
- `ASAAS_MONTHLY_AMOUNT`

Fallbacks importantes:

- Desenvolvimento usa `DEV_*` quando existir; se nao existir, usa a variavel sem prefixo.
- Producao usa `PROD_*` quando existir; se nao existir, usa a variavel sem prefixo.
- Se `environment.prod.ts` receber `pk_test_`, o script mostra um aviso para lembrar que Stripe ainda esta em modo teste.

Variaveis usadas apenas no backend/serverless:

- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_MONTHLY_PRICE_ID`
- `ASAAS_API_KEY`
- `ASAAS_BASE_URL`
- `ASAAS_WEBHOOK_TOKEN`

Importante: `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY` e `ASAAS_API_KEY` nunca devem aparecer no frontend.

## Como Rodar Localmente

Para rodar apenas o Angular:

```bash
npm run dev
```

A aplicacao fica disponivel em:

```text
http://localhost:3000
```

Para rodar simulando as functions da Vercel:

```bash
npm run vercel:dev
```

Use esse modo quando precisar testar endpoints em `api/`, como pagamentos, webhooks simulados ou chamadas de IA.

Para gerar build de producao:

```bash
npm run build
```

## Banco de Dados e Supabase

O Supabase e usado para:

- autenticacao;
- perfis de usuario;
- empresas/tenants;
- reservas;
- hoteis;
- voos;
- cotacoes;
- creditos;
- faturas SaaS;
- status de assinatura;
- idempotencia de webhooks.

### Migracao de checkout hibrido

Rode no SQL Editor do Supabase:

```text
supabase/migrations/20260406_hybrid_checkout.sql
```

Essa migracao adiciona campos de assinatura/pagamento em `companies`, amplia `saas_invoices` e cria a tabela `payment_webhook_events`.

Depois, use este script para conferir se o schema necessario esta presente:

```text
supabase/verify_checkout_schema.sql
```

### Tabelas importantes

- `profiles`: dados do usuario e vinculo com empresa.
- `companies`: dados da empresa/tenant e status da assinatura.
- `saas_invoices`: historico de faturas e pagamentos.
- `payment_webhook_events`: controle de idempotencia dos webhooks.

## Pagamentos e Assinaturas

O projeto suporta fluxo hibrido:

- Stripe para cartao/checkout/portal/faturas.
- Asaas para Pix e checkout externo de debito.

### Stripe

Endpoints principais:

- `POST /api/stripe/create-embedded-checkout-session`
- `POST /api/stripe/create-embedded-subscription-session`
- `POST /api/stripe/create-checkout-session`
- `POST /api/stripe/create-portal-session`
- `POST /api/stripe/webhook`
- `POST /api/stripe/sync-company-subscription`
- `POST /api/stripe/reconcile-company-status`

Configure no painel da Stripe:

- um produto;
- um price recorrente mensal;
- `STRIPE_MONTHLY_PRICE_ID`;
- webhook apontando para `/api/stripe/webhook`.

Eventos recomendados:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

### Asaas

Endpoints principais:

- `POST /api/asaas/create-pix-payment`
- `POST /api/asaas/create-debit-checkout`
- `POST /api/asaas/payment-status`
- `POST /api/asaas/cancel-subscription`
- `POST /api/asaas/webhook`

Ambientes comuns:

```env
ASAAS_BASE_URL=https://sandbox.asaas.com/api
```

```env
ASAAS_BASE_URL=https://api.asaas.com
```

Para desenvolvimento, use um valor baixo:

```env
ASAAS_MONTHLY_AMOUNT=5
```

Para producao, ajuste para o valor real da assinatura:

```env
ASAAS_MONTHLY_AMOUNT=370
```

Configure o webhook do Asaas para:

```text
POST /api/asaas/webhook
```

Se `ASAAS_WEBHOOK_TOKEN` estiver definido, o webhook precisa enviar o mesmo token.

## Scripts Disponiveis

```bash
npm run inject
```

Gera os arquivos de environment usados pelo Angular.

```bash
npm run dev
```

Injeta variaveis e inicia o Angular em desenvolvimento.

```bash
npm run vercel:dev
```

Injeta variaveis e inicia o ambiente local da Vercel.

```bash
npm run build
```

Injeta variaveis e gera o build de producao em `dist/`.

```bash
npm run preview
```

Injeta variaveis e serve o build em configuracao de producao.

## Deploy

O projeto foi estruturado para deploy na Vercel.

Checklist de deploy:

1. Configure as variaveis de ambiente na Vercel.
2. Garanta que `NODE_ENV` ou `VERCEL_ENV` esteja correto em producao.
3. Configure `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
4. Configure `SUPABASE_SERVICE_ROLE_KEY` apenas no ambiente serverless.
5. Configure Stripe e/ou Asaas conforme o metodo de pagamento usado.
6. Rode a migracao do Supabase antes de liberar assinatura.
7. Configure os webhooks externos apontando para a URL final da Vercel.

Comandos esperados:

```bash
npm install
npm run build
```

Saida do build:

```text
dist/
```

## Seguranca

- `.env`, `.env.local` e demais `.env.*` ficam ignorados pelo Git.
- A chave `SUPABASE_SERVICE_ROLE_KEY` deve existir apenas no backend/serverless.
- Endpoints de assinatura validam sessao Supabase via token Bearer.
- Usuarios comuns operam apenas a empresa vinculada em `profiles.company_id`.
- Admins podem operar uma empresa alvo quando autenticados.
- Webhooks usam tabela de idempotencia para evitar processamento duplicado.
- O token do webhook do Asaas e opcional, mas recomendado.

## Troubleshooting

### `SUPABASE_URL` ou `SUPABASE_ANON_KEY` aparece como `MISSING`

Confira se `.env.local` existe e se os nomes das variaveis estao corretos. Depois rode:

```bash
npm run inject
```

### Build funciona, mas pagamento falha

Verifique se voce esta rodando com:

```bash
npm run vercel:dev
```

O `ng serve` sozinho nao executa as functions da pasta `api/`.

### Stripe retorna erro de chave ou price

Confirme:

- `STRIPE_SECRET_KEY`
- `STRIPE_PUBLISHABLE_KEY`
- `STRIPE_MONTHLY_PRICE_ID`
- `STRIPE_WEBHOOK_SECRET`

O `STRIPE_MONTHLY_PRICE_ID` precisa ser um price recorrente mensal.

### Asaas retorna erro de autenticacao

Confirme:

- `ASAAS_API_KEY`
- `ASAAS_BASE_URL`

Para sandbox:

```env
ASAAS_BASE_URL=https://sandbox.asaas.com/api
```

Para producao:

```env
ASAAS_BASE_URL=https://api.asaas.com
```

### Pix nao aparece na tela

Confirme se o endpoint `create-pix-payment` esta sendo chamado pelo ambiente serverless e se o retorno do Asaas inclui QR Code ou copia e cola.

### Webhook duplicado

O projeto registra eventos em `payment_webhook_events`. Se um evento ja foi processado, ele nao deve ser aplicado novamente.

### Alterei `.env.local`, mas a aplicacao nao mudou

Rode novamente:

```bash
npm run inject
```

ou reinicie:

```bash
npm run dev
```

## Observacoes de Desenvolvimento

- Evite editar manualmente `environment.ts` e `environment.prod.ts` quando a mudanca vier de variavel de ambiente. Altere `.env.local` e rode `npm run inject`.
- Antes de subir mudancas, rode `npm run build`.
- Nao commite `.env` ou chaves privadas.
- Para testar pagamentos ponta a ponta, prefira `npm run vercel:dev`.
