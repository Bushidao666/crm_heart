-- Função utilitária para centralizar a verificação de banimento no Postgres.
create schema if not exists heart;

create or replace function heart.is_user_banned(target_user uuid)
returns boolean
language sql
security definer
set search_path = heart, public
as $$
  select exists (
    select 1
    from heart.equipe e
    where e.user_id = target_user
      and coalesce(e.status, 'active') = 'removed'
  );
$$;

comment on function heart.is_user_banned is 'Retorna true se o usuário estiver com status removed na heart.equipe.';

-- Exemplo de policy usando a função para negar acesso a usuários banidos.
-- Ajuste "schema.table" e o filtro de acordo com o seu caso.
drop policy if exists "deny banned users" on heart.alguma_tabela;
create policy "deny banned users"
on heart.alguma_tabela
for all
using (
  auth.uid() = user_id
  and not heart.is_user_banned(auth.uid())
);

-- Para tabelas multi-tenant, utilize um join com heart.equipe, por exemplo:
-- using (
--   exists (
--     select 1
--     from heart.equipe e
--     where e.company_id = heart.alguma_tabela.company_id
--       and e.user_id = auth.uid()
--       and not heart.is_user_banned(auth.uid())
--   )
-- );
