# KAD Administração

Painel web separado do aplicativo Expo. Ele usa o mesmo Supabase, mas possui build, dependências e controle de acesso próprios.

## Executar

1. O painel reutiliza automaticamente `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` do `.env` da raiz. Se preferir, substitua-as em `admin/.env.local` usando os nomes de `.env.example`.
2. Aplique as migrations da raiz em ordem, incluindo `202608020004_admin_foundation.sql`
   e `202608020005_editorial_concursos.sql`.
3. Vincule o UUID do primeiro administrador pela seção SQL do Supabase:

```sql
insert into private.admin_users (user_id, role)
values ('UUID_DO_USUARIO', 'owner');
```

4. Execute `npm run dev` dentro desta pasta.

Para a recuperação de senha no painel web, adicione a URL abaixo em
**Authentication > URL Configuration > Redirect URLs** no projeto Supabase:

```text
http://127.0.0.1:8082/auth/nova-senha
```

Em ambientes publicados, adicione também a mesma rota usando a origem de cada implantação. O
painel envia essa origem explicitamente ao Supabase e não depende da `Site URL` do aplicativo.

Para revisar apenas a interface vazia, execute `npm run dev:preview`. Esse modo não consulta
dados reais, não simula métricas ou concursos e só funciona no servidor de desenvolvimento.
Rascunhos criados nele ficam exclusivamente na sessão atual e não podem ser publicados.

## Concursos

O primeiro módulo editorial permite criar, editar, revisar, publicar, arquivar e excluir
concursos com cargos estruturados. No modo autenticado, todas as mutações passam por funções
transacionais protegidas por permissões e são registradas em `private.admin_audit_logs`.

Somente concursos com situação editorial `published` podem ser lidos pelo aplicativo. Enquanto
não houver conteúdo publicado no Supabase, o aplicativo preserva o acervo demonstrativo local.

## Segurança

- O navegador utiliza somente a chave publicável.
- O acesso é decidido pelas funções e políticas do banco, não apenas pela interface.
- Chaves secretas e `service_role` não pertencem a este projeto web.
- Operações privilegiadas futuras devem passar por Edge Functions autenticadas.
