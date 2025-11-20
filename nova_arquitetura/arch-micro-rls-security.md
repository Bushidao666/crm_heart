# Arquitetura Micro: RLS & Security v1.0

**Documento ID:** ARCH-rls-security-v1
**Módulo:** RLS & Security
**Bounded Context:** Multi-Tenancy, Autorização & Proteção de Dados
**Data de Criação:** 2025-11-14
**Baseado em:** ARCH-MACRO-v2.0
**Status:** Draft

---

## Visão Geral do Módulo

### Propósito e Responsabilidade

**Responsabilidade Única (SRP):**
Definir e padronizar **toda a estratégia de segurança lógica** do banco único, incluindo:

- Modelo de **claims JWT** (Supabase Auth) para back-office, SDR, CRMs e serviços.
- Padrões de **Row Level Security (RLS)** por schema (`core`, schemas de CRM, marketing).
- Regras de **Storage RLS** para arquivos (contratos, documentos, avatares, etc.).
- Perfis lógicos de acesso (back-office admin, operadores, vendedores, workers, integrações).

Este módulo não lida com autenticação em si (isso é do Auth), mas define **como** as identidades autenticadas enxergam (ou não enxergam) os dados.

---

### Posição na Arquitetura Macro

```mermaid
graph TB
    subgraph "Sistema Completo"
        GOV[Governança & Empresas]
        SDR[SDR & Leads]
        CRM[CRMs (schemas)]
        MKT[Marketing & Tracking]
        INTEGR[Integrações & Contratos]
        AUTH[Supabase Auth]
        STORAGE[Supabase Storage]
        TARGET[🎯 ESTE MÓDULO<br/>RLS & Security]
    end

    AUTH -->|JWT Claims| TARGET
    TARGET -->|Policies & Guidelines| GOV
    TARGET -->|Policies & Guidelines| SDR
    TARGET -->|Policies & Guidelines| CRM
    TARGET -->|Policies & Guidelines| MKT
    TARGET -->|Policies & Guidelines| INTEGR
    TARGET -->|Bucket Policies| STORAGE

    style TARGET fill:#ff6b6b,stroke:#2c3e50,stroke-width:4px
```

---

## Modelo de Identidade & Claims JWT

### Papéis Lógicos Principais

- **`backoffice_admin`**
  Dono da holding / operadores de back-office:
  - Acessam todas as empresas (`company_id` não limita).
  - Operam em `core.companies`, `core.company_users`, configurações globais, etc.

- **`crm_user` / `sales_rep` / `crm_manager`**
  Usuários do CRM operacional:
  - Sempre operam **dentro de uma empresa** (`company_id` obrigatório).
  - Acessam apenas schemas CRM + subset de dados do `core` que lhes diz respeito.

- **`sdr_operator` / `sdr_manager`**
  Usuários que trabalham na camada SDR (talvez com UI específica):
  - Acessam `core.leads`, `core.conversations`, etc. **apenas da empresa** (`company_id`).

- **`marketing_admin`**
  Operadores de marketing:
  - Acessam configurações de pixels, jobs de remarketing, logs, sempre por `company_id`.

- **`service_role`** (chave secreta Supabase):
  - Usada por Edge Functions e workers.
  - Não sofre RLS por padrão, mas o código DEVE respeitar o escopo lógico (sempre filtrar por `company_id`).

#### Contexto de Requisição na Camada de Aplicação

- Toda rota FastAPI injeta um `RequestContext` derivado do JWT/governança, garantindo acesso explícito ao `company_id` e ao `crm_schema`.
- Consultas que receberem um contexto **sem** `company_id` disparam `audit_missing_company(...)`, registrando nos logs a tentativa (com claims e sujeito) antes de negar a operação.
- Repositórios Supabase (`infrastructure/supabase`) e serviços utilizam `.schema("core"|"heart")` e aplicam `eq("company_id", ...)` para reforçar o escopo lógico mesmo quando executados com a chave de serviço.
- Storage paths (ex.: `inbound-media`) são validados para assegurar que o prefixo corresponde ao `company_id` do token; qualquer discrepância gera 403 e log de auditoria.

### Estrutura de Claims

```jsonc
// Exemplo de payload JWT (simplificado)
{
  "sub": "uuid-do-auth-users",
  "role": "crm_user",        // ou backoffice_admin, sdr_operator, marketing_admin...
  "company_id": "uuid-da-empresa",
  "permissions": ["deals:read", "deals:write", "contracts:read"],
  "crm_schema": "heart",     // opcional: schema CRM que o usuário está usando
  "exp": 1731600000
}
```

**Regras:**

- **Usuários de CRM** sempre têm `company_id`.
- **Backoffice_admin** pode ter `company_id` **nulo** ou irrelevante; policies checam apenas `role`.
- Permissões finas (`permissions`) são usadas na camada de aplicação, não diretamente nas policies SQL (para evitar listas muito grandes).

---

## Padrões de RLS por Schema

### Esqueleto de Policy Multi-tenant

Para qualquer tabela multi-tenant com `company_id`:

```sql
-- 1) Habilitar RLS
ALTER TABLE <schema>.<table> ENABLE ROW LEVEL SECURITY;

-- 2) Policy para usuários autenticados (CRM/SDR/etc.)
CREATE POLICY "<table>_tenant_read"
ON <schema>.<table>
FOR SELECT
USING (
  company_id = (auth.jwt()->>'company_id')::uuid
);

CREATE POLICY "<table>_tenant_write"
ON <schema>.<table>
FOR INSERT, UPDATE
USING (
  company_id = (auth.jwt()->>'company_id')::uuid
) WITH CHECK (
  company_id = (auth.jwt()->>'company_id')::uuid
);
```

### Padrão para Back-office (role global)

```sql
CREATE POLICY "<table>_backoffice_all"
ON <schema>.<table>
FOR ALL
USING (auth.jwt()->>'role' = 'backoffice_admin')
WITH CHECK (auth.jwt()->>'role' = 'backoffice_admin');
```

### Padrão para Service Role (Edge Functions)

Normalmente, para tabelas sensíveis, **não** é necessário RLS especial, pois o `service_role` ignora policies. Porém, é boa prática documentar:

- As Edge Functions que usam `service_role` **devem**:
  - Filtrar sempre por `company_id` explícito.
  - Nunca retornar dados de múltiplas empresas para um cliente final.

---

## RLS em `core` (Geral)

### `core.companies`, `core.company_users`, `core.company_crms`

- `core.companies`:
  - Visível e mutável apenas por `backoffice_admin`.
- `core.company_users`:
  - `backoffice_admin` gerencia tudo.
  - `crm_admin` ou `company_owner` de cada empresa **pode ver** seus próprios usuários e, eventualmente, gerenciar invites:

```sql
CREATE POLICY "company_users_self_company_read"
ON core.company_users
FOR SELECT
USING (
  company_id = (auth.jwt()->>'company_id')::uuid
);
```

### `core.leads` e satélites

- Já exemplificado na macro:
  - Usuários autenticados com `company_id` veem apenas leads da empresa.
  - `backoffice_admin` pode ver tudo.

Outras tabelas `core.*` multi-tenant (`instance_status`, `centurion_configs`, `contracts`, etc.) seguem o mesmo padrão.

---

## RLS em Schemas de CRM

### Padrão `crm_schema` + `company_id`

Para tabelas de CRM (ex.: `heart.deals`):

```sql
ALTER TABLE heart.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "heart_deals_tenant_read"
ON heart.deals
FOR SELECT
USING (
  company_id = (auth.jwt()->>'company_id')::uuid
);

CREATE POLICY "heart_deals_tenant_write"
ON heart.deals
FOR INSERT, UPDATE
USING (
  company_id = (auth.jwt()->>'company_id')::uuid
) WITH CHECK (
  company_id = (auth.jwt()->>'company_id')::uuid
);
```

**Opcional:** policies adicionais por cargo:

```sql
-- Apenas gerente ou admin podem apagar deals
CREATE POLICY "heart_deals_delete_managers"
ON heart.deals
FOR DELETE
USING (
  company_id = (auth.jwt()->>'company_id')::uuid
  AND (auth.jwt()->>'role' IN ('crm_manager','crm_admin'))
);
```

Para outros schemas de CRM (`schema_x`), o padrão é reaplicado:

- Sempre `company_id` na tabela.
- policies idênticas, apenas mudando schema/nome da tabela.

---

## RLS em Marketing & Tracking

### Eventos e Configurações de Pixel

- Todas as tabelas (`pixel_configs`, `meta_dispatch_queue`, `meta_dispatch_log`, `remarketing_jobs`, `remarketing_logs`) possuem `company_id`.
- Policies:

```sql
CREATE POLICY "pixel_configs_company_scope"
ON <schema>.pixel_configs
FOR ALL
USING (
  company_id = (auth.jwt()->>'company_id')::uuid
);
```

- Usuário `marketing_admin` da empresa:
  - Tem access total às configs da própria empresa.
- Back-office pode ter policies separadas se precisar ver configurações globais.

Workers (`service_role`) não precisam de policies extras, mas devem ser escritos com `company_id` como parâmetro de filtro em todas as queries relevantes.

---

## Storage: Buckets, Paths e RLS

### Buckets por tipo de arquivo

Exemplos (adaptados do que já existe no projeto):

- `avatars` – fotos de perfil.
- `centurion-avatars` – avatares dos Centurions.
- `attachments` – anexos gerais.
- `exports` – arquivos de exportação gerados pelo sistema.

---

## Rotação de Tokens de Serviço

- Os serviços internos não devem consumir diretamente o `SUPABASE_SERVICE_ROLE_KEY`.
- Use o `TokenProvider` (backend/security/token_provider.py) para emitir JWTs curta duração com os claims `role` e `company_id`.
- Cada worker solicita tokens scoped para a empresa alvo antes de acessar dados; o provider mantém cache e renova tokens automaticamente.
- Para chamadas administrativas (rota `/admin`), valide o `role` `backoffice_admin`; demais rotas exigem `company_id` presente no token.
- `funnel-assets` – mídias de funis SDR.
- `arquivos_deals` – documentos de negócios (contratos, comprovantes, etc.).
- `audios_deals` – áudios ligados a deals.

### Padrão de Key

Sempre que possível, usar um prefixo com `company_id` e ID lógico do recurso:

```text
arquivos_deals/
  <company_id>/
    <deal_id>/
      documento_frente.pdf
      documento_verso.pdf
      comprovante_residencia.pdf
      contrato_assinado.pdf
```

Isso facilita:

- Policies RLS no nível de path.
- Auditoria e limpeza de dados por empresa.

### Policies de Storage (exemplo)

Supabase permite policies sobre `storage.objects`. Exemplo para `arquivos_deals`:

```sql
CREATE POLICY "deal_files_select_company"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'arquivos_deals'
  AND (split_part(name, '/', 1)) = (auth.jwt()->>'company_id')
);

CREATE POLICY "deal_files_insert_company"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'arquivos_deals'
  AND (split_part(name, '/', 1)) = (auth.jwt()->>'company_id')
);
```

Se já existir convenção com `deal_id` no primeiro segmento, pode-se usar join lógico com `heart.deals` para reforçar vinculação por empresa (como já há no projeto, usando `split_part`).

---

## Padrão de Segurança para Edge Functions

### Classes de Edge Functions

- **Públicas** (webhooks externos):
  - Ex.: `autentique-webhook`, `evolution-webhook`.
  - Protegidas por token/assinatura de parceiro.
  - Não expõem dados sensíveis; apenas atualizam estado interno.

- **Semi-públicas** (APIs chamadas por front-end com JWT):
  - Ex.: rotas de CRM, SDR, marketing.
  - Validam JWT, extraem `company_id`, `role` e outras claims.
  - Passam esses parâmetros explicitamente às queries Supabase (reaproveitando RLS).

- **Internas/Workers** (`service_role`):
  - Ex.: `meta-queue-worker`, jobs de remarketing, batch de qualificação proativa.
  - Ignoram RLS nativamente, mas:
    - Devem carregar `company_id` da tabela-alvo.
    - Nunca retornar dados de múltiplas empresas para um único cliente.

### Diagrama de Segurança (alto nível)

```mermaid
flowchart LR
    subgraph "Clients"
        BackOffice[Back-office UI<br/>role=backoffice_admin]
        CRMUsers[CRM UIs<br/>role=crm_user/*]
        Integrations[External Services<br/>(Autentique/Evolution)]
    end

    subgraph "Supabase Edge Functions"
        PublicWebhooks[Public Webhooks<br/>(no JWT, secret token)]
        AppAPIs[App APIs<br/>(JWT, RLS)]
        Workers[Workers<br/>(service_role)]
    end

    subgraph "Postgres + RLS"
        RLSCore[core.* Policies]
        RLSCRM[crm schemas Policies]
        RLSStorage[storage.objects Policies]
    end

    BackOffice --> AppAPIs
    CRMUsers --> AppAPIs
    Integrations --> PublicWebhooks

    AppAPIs --> RLSCore
    AppAPIs --> RLSCRM
    AppAPIs --> RLSStorage

    Workers --> RLSCore
    Workers --> RLSCRM
    Workers --> RLSStorage
```

---

## Checklist de Segurança

- [ ] Toda tabela multi-tenant tem `company_id` + RLS por `company_id`.
- [ ] `backoffice_admin` tem policies específicas onde precisa de visão global.
- [ ] Buckets de storage usam convenção de path + policies que consideram `company_id`.
- [ ] Workers (`service_role`) foram revisados para não vazar dados entre empresas.
- [ ] Webhooks externos (Autentique/Evolution) são validados com secret/assinatura.
- [ ] Edge Functions semi-públicas validam JWT e extraem `company_id`/`role` corretamente.
- [ ] Schemas de CRM (`heart`, `schema_x`) possuem RLS consistente em todas tabelas.
- [ ] Views sensíveis (`decrypted_environment_configurations`) são acessíveis apenas via `service_role`.
- [ ] Políticas de DELETE requerem roles especiais (`crm_manager`, `backoffice_admin`).
- [ ] Logs de auditoria capturam `company_id` + `user_id` em operações sensíveis.

---

## Resumo

O módulo **RLS & Security**:

- Define a camada de segurança lógica de todo o sistema multi-tenant.
- Garante que cada empresa enxerga **apenas** seus dados via políticas de RLS.
- Estabelece padrões claros para JWT claims, roles e permissões.
- Protege storage com paths company-scoped e policies granulares.
- Fornece guidelines para Edge Functions e workers operarem de forma segura.

---
