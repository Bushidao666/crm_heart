-- Refaz as policies de deals para permitir que vendedores criem e gerenciem apenas os próprios negócios
-- sem depender de EXISTS em tabelas bloqueadas por RLS.

-- Função segura que ignora RLS para checar o vínculo do usuário com a empresa.
create or replace function heart.is_user_in_company(_company_id uuid)
returns boolean
language sql
security definer
set search_path = heart, public
as $$
  select
    exists (
      select 1
      from heart.equipe e
      where e.company_id = _company_id
        and e.user_id = auth.uid()
    )
    or exists (
      select 1
      from heart.crm_user_profiles p
      where p.company_id = _company_id
        and p.user_id = auth.uid()
    );
$$;

grant execute on function heart.is_user_in_company(uuid) to authenticated;

-- Garante RLS ligado
alter table heart.deals enable row level security;

-- Policies simplificadas por responsible owner
drop policy if exists heart_deals_insert_company_scope on heart.deals;
drop policy if exists heart_deals_select_company_scope on heart.deals;
drop policy if exists heart_deals_update_company_scope on heart.deals;
drop policy if exists heart_deals_delete_company_scope on heart.deals;

-- Inserir: apenas se o vendedor responsável é o próprio usuário e vinculado à empresa
create policy heart_deals_insert_owner
on heart.deals
for insert
to authenticated
with check (
  vendedor_responsavel = auth.uid()
  and company_id is not null
  and heart.is_user_in_company(company_id)
);

-- Ler apenas negócios próprios
create policy heart_deals_select_owner
on heart.deals
for select
to authenticated
using (
  vendedor_responsavel = auth.uid()
);

-- Atualizar apenas negócios próprios e vinculados
create policy heart_deals_update_owner
on heart.deals
for update
to authenticated
using (
  vendedor_responsavel = auth.uid()
  and heart.is_user_in_company(company_id)
)
with check (
  vendedor_responsavel = auth.uid()
  and heart.is_user_in_company(company_id)
);

drop policy if exists heart_deals_delete_owner on heart.deals;

create policy heart_deals_delete_owner
on heart.deals
for delete
to authenticated
using (
  vendedor_responsavel = auth.uid()
  and heart.is_user_in_company(company_id)
);
