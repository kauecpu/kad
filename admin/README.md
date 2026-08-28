# KAD Administração

Painel web separado do aplicativo Expo. Ele usa o mesmo Supabase, mas possui build, dependências e controle de acesso próprios.

## Executar

1. Crie `.env.staging.local` e `.env.production.local` na raiz a partir dos exemplos. Esses arquivos guardam apenas a chave publicável e ficam fora do Git.
2. Aplique as migrations da raiz em ordem, incluindo `202608020004_admin_foundation.sql`,
   `202608020005_editorial_concursos.sql`, `202608090001_editorial_import_pipeline.sql` e
   `202608270001_editorial_question_import_v2.sql`.
3. Vincule o UUID do primeiro administrador pela seção SQL do Supabase:

```sql
insert into private.admin_users (user_id, role)
values ('UUID_DO_USUARIO', 'owner');
```

4. Na raiz, execute `npm run admin:staging`. Produção só deve ser aberta com
   `npm run admin:production` quando houver uma ação explicitamente aprovada.

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
**Banco de questões** antes da publicação. Contratos v1 e v2 são aceitos; no v2, uma questão pode
ser revisada e publicada sem explicação. Se houver comentário, sua origem e revisão ficam
registradas. Reimportar a mesma questão sem comentário não apaga um comentário existente.

Selecione questões e use **Aprovar**, **Publicar** ou **Retirar**. Toda ação abre uma prévia
individual com os impedimentos encontrados. Publicação exige `content.publish`; retirada arquiva
sem apagar. Se o conteúdo for editado depois da aprovação, a aprovação é invalidada e precisa ser
feita novamente.

## Segurança

- O navegador utiliza somente a chave publicável.
- O acesso é decidido pelas funções e políticas do banco, não apenas pela interface.
- Chaves secretas e `service_role` não pertencem a este projeto web.
- Operações privilegiadas futuras devem passar por Edge Functions autenticadas.
