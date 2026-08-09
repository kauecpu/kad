# KAD Administração

Painel web separado do aplicativo Expo. Ele usa o mesmo Supabase, mas possui build, dependências e controle de acesso próprios.

## Executar

1. O painel reutiliza automaticamente `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` do `.env` da raiz. Se preferir, substitua-as em `admin/.env.local` usando os nomes de `.env.example`.
2. Aplique as migrations da raiz em ordem, incluindo `202608020004_admin_foundation.sql`,
   `202608020005_editorial_concursos.sql` e `202608090001_editorial_import_pipeline.sql`.
3. Vincule o UUID do primeiro administrador pela seção SQL do Supabase:

```sql
insert into private.admin_users (user_id, role)
values ('UUID_DO_USUARIO', 'owner');
```

4. Execute `npm run dev` dentro desta pasta.

Para revisar apenas a interface vazia, execute `npm run dev:preview`. Esse modo não consulta
dados reais, não simula métricas ou concursos e só funciona no servidor de desenvolvimento.
Rascunhos criados nele ficam exclusivamente na sessão atual e não podem ser publicados.

## Concursos

O primeiro módulo editorial permite criar, editar, revisar, publicar, arquivar e excluir
concursos com cargos estruturados. No modo autenticado, todas as mutações passam por funções
transacionais protegidas por permissões e são registradas em `private.admin_audit_logs`.

Somente concursos com situação editorial `published` podem ser lidos pelo aplicativo. Enquanto
não houver conteúdo publicado no Supabase, o aplicativo preserva o acervo demonstrativo local.

## Importações do KAD Collector

O coletor pertence ao repositório separado `kad-collector`. Este painel recebe arquivos JSON,
JSONL ou NDJSON no contrato descrito em `docs/EDITORIAL_IMPORTS.md`; nenhuma captura de páginas é
executada pelo frontend.

Cada arquivo cria um lote privado de staging. O administrador pode inspecionar a fonte e o conteúdo
de cada concurso, corrigir o JSON, revalidar o registro, escolher como tratar duplicatas e importar
os itens aprovados como rascunhos. A publicação continua acontecendo somente no módulo
**Concursos**. Lotes importados também podem ser desfeitos enquanto o conteúdo não tiver sido
publicado ou alterado posteriormente.

## Banco de questões

Questões recebidas pelo mesmo contrato entram como rascunhos e podem ser revisadas no módulo
**Banco de questões** antes da publicação.

## Segurança

- O navegador utiliza somente a chave publicável.
- O acesso é decidido pelas funções e políticas do banco, não apenas pela interface.
- Chaves secretas e `service_role` não pertencem a este projeto web.
- Operações privilegiadas futuras devem passar por Edge Functions autenticadas.
