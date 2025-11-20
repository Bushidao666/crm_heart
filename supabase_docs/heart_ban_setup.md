# Banimento no banco (RLS)

1. **Criar/atualizar a função utilitária**
   ```bash
   psql "$SUPABASE_DB_URL" -f supabase_docs/heart_ban_policies.sql
   ```
   Isso garante a existência da função `heart.is_user_banned` e aplica um modelo de policy.

2. **Aplicar policies nas tabelas relevantes**
   - Edite `supabase_docs/heart_ban_policies.sql` adicionando as tabelas específicas antes de rodar o comando acima; ou
   - Copie o bloco `create policy` para cada tabela multi-tenant ajustando o filtro.

3. **Verificar consistência entre Auth e heart.equipe**
   ```bash
   cd apps/backend
   npm run check:ban-consistency
   ```
   > Requer `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` e `SUPABASE_HEART_SCHEMA` configurados (via `.env`).

4. **Repetir o script após banir/desbanir em massa** para garantir que não há divergências.
