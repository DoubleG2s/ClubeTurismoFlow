<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
<h1>✈️ Clube Turismo Flow</h1>
<p><strong>Sistema de Gestão Multi-Tenant para Agências de Viagens</strong></p>
</div>

---

## 📖 Visão Geral

O **Clube Turismo Flow** é uma plataforma inovadora desenvolvida para o gerenciamento operacional de agências de turismo. Focado na jornada completa do cliente, o sistema centraliza o controle de reservas, hotéis, voos, cotações e créditos com uma arquitetura técnica segura e ágil.

Desenvolvido para escalar com múltiplos escritórios ou franquias operacionais, possui **arquitetura Multi-Tenant reativa**, assegurando que os dados de cada unidade permaneçam 100% isolados, protegidos e íntegros.

---

## ✨ Principais Funcionalidades

* 🏢 **Arquitetura Multi-Tenant Segura**: Proteção ativa contra manipulação de referência direta (IDOR). O estado do aplicativo é reativo (via Angular Signals/effects) isolando reservas, voos, cotações e hotéis dependendo do ID da empresa ativa.
* 🛎️ **Gestão de Reservas**: Pipeline operacional do passageiro com checklist dinâmico interativo: desde a emissão de aéreos e vouchers, até etapas de pré-vendas e pós-viagem.
* 🏨 **Catálogo de Hotéis**: Cadastro rico com suporte a múltiplas imagens (integrado ao *Supabase Storage*), listagem flexível de telefones e envio de comunicados por e-mail no próprio painel.
* ✈️ **Controle de Voos & Cotações**: Acompanhamento de propostas, datas, localizadores e faturamento, permitindo visão transparente do funil de vendas.
* 💳 **Gestão de Créditos**: Rastreio de créditos pendentes junto a cias aéreas e fornecedores para maximizar os resultados do caixa corporativo.

---

## 🛠️ Stack Tecnológica

* **Frontend:** [Angular](https://angular.dev/) (Arquitetura moderna com Standalone Components, Routing Avançado e gerenciamento de estado via Signals).
* **UI/UX:** Tailwind CSS para estilos utilitários consistentes.
* **Backend as a Service:** [Supabase](https://supabase.com/) (Banco de Dados PostgreSQL, Autenticação, Storage e Real-time).

---

## 🚀 Como Executar Localmente

### Pré-requisitos
* Node.js LTS ativo no ambiente
* Conta e Projeto criados no Supabase (com as tabelas mapeadas)

### Passo a Passo

1. **Instale as dependências:**
   ```bash
   npm install
   ```

2. **Configuração de Ambiente:**
   Certifique-se de configurar as chaves providas pelo Supabase no arquivo `.env.local` na raiz do projeto:
   ```env
   SUPABASE_URL=https://seu-projeto.supabase.co
   SUPABASE_ANON_KEY=sua-anon-key-publica
   ```

3. **Inicie a Aplicação em Modo de Desenvolvimento:**
   ```bash
   npm run dev
   ```
   > Esse script roda o pre-flight de injeção de ambiente e inicializa o servidor na porta padrão (`http://localhost:3000` ou similar).

---

*Desenvolvido com foco em alta performance, código limpo e experiência de usuário fluida.*
