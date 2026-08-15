# Reconciliação do Supabase do KAD

Data da auditoria: 14 de agosto de 2026  
Projeto auditado: `kad-dev` (`tknxtwwwoqwbzddplzzg`)  
Branch de trabalho: `codex/reconcile-supabase-schema`  
Base: `origin/main` em `e11ec9c49ec6adb0a91a2435e9e30a1e0fffd77d`

## Estado e limites da auditoria

A Fase 1 foi somente leitura. Foram consultados metadados, contagens agregadas,
histórico de migrations, catálogo PostgreSQL, advisors e bundles de Edge
Functions. Nenhum registro pessoal ou financeiro foi lido. Nenhuma migration,
função ou permissão foi alterada no `kad-dev`.

O projeto remoto contém dados reais. As contagens sanitizadas relevantes são:
5 perfis, 11 sessões de checkout, 4 eventos de webhook, 2 registros de limite de
checkout e nenhum registro nas tabelas de assinaturas ou transações. Essas
contagens servem apenas para estimar impacto e verificar preservação.

## Matriz local x remoto

| Artefato local | Registro remoto | Estado material no remoto | Decisão proposta |
| --- | --- | --- | --- |
| `202608010001_auth_profiles.sql` | ausente | equivalente presente | marcar como aplicada somente pelo comando oficial de repair |
| `202608010002_user_study_data.sql` | ausente | equivalente presente | marcar como aplicada após validação estrutural final |
| `202608020001_harden_database.sql` | ausente | equivalente presente | marcar como aplicada após validação estrutural final |
| `202608020002_profile_usernames.sql` | ausente | equivalente presente | marcar como aplicada após validação estrutural final |
| `202608020003_harden_auth_security.sql` | ausente | equivalente presente | marcar como aplicada após validação estrutural final |
| `202608020004_admin_foundation.sql` | ausente | equivalente presente | marcar como aplicada após validação estrutural final |
| `202608020005_editorial_concursos.sql` | ausente | equivalente presente | marcar como aplicada após validação estrutural final |
| `202608090001_editorial_import_pipeline.sql` | ausente | **não aplicado**: `questions`, lotes/itens privados e RPCs de importação não existem | aplicar esta migration conscientemente; não a marcar como aplicada antes disso |
| `202608110001_payments_subscriptions.sql` | ausente | equivalente presente | marcar como aplicada após validação estrutural final |
| `20260812024756_harden_payment_subscriptions.sql` | `20260812211105_harden_payment_subscriptions` | SQL remoto é exatamente igual ao arquivo local | criar espelho histórico local e marcar a versão local original como aplicada |
| migration do PR #9 | `20260812221545_grant_payment_edge_function_access` | migration intermediária existe apenas no remoto | adicionar espelho histórico com o SQL remoto exato |
| migration do PR #9 | `20260812225749_enforce_payment_edge_function_least_privilege` | SQL remoto é exatamente igual ao arquivo do commit `ede946d` | versionar o SQL canônico usando o timestamp remoto |
| nova reconciliação | ausente | privilégios padrão e cinco índices ainda precisam correção | criar uma migration nova e aplicá-la depois do pipeline editorial |
| complemento editorial | ausente | advisors após o pipeline revelaram três FKs adicionais sem índice | criar uma segunda migration mínima com os três índices |

Não há evidência de uma migration local parcialmente aplicada: o pipeline
editorial está totalmente ausente, e os demais grupos auditados estão
materialmente presentes. Os três registros remotos devem ser preservados; o
histórico não será editado diretamente por SQL.

## Edge Functions

| Função publicada | Versão | JWT do gateway | Correspondência de código | Situação |
| --- | ---: | --- | --- | --- |
| `delete-account` | 15 | desativado | arquivo idêntico a `origin/main` e `ede946d` | rastreável em `main` |
| `create-payment-checkout` | 15 | ativado | bundle idêntico ao commit `ede946d`; diferente de `main` | incorporar os arquivos canônicos ao novo PR; não fazer downgrade |
| `cancel-subscription` | 13 | ativado | idêntico ao commit `ede946d`, desconsiderando uma quebra de linha final | rastreável; sem mudança remota necessária |
| `mercado-pago-webhook` | 15 | desativado | bundle idêntico ao commit `ede946d`; diferente de `main` | incorporar os arquivos canônicos ao novo PR; não fazer downgrade |
| `send-auth-email` | não publicada | — | fonte existe em `main` | documentar como não publicada; não publicar nesta reconciliação |

O PR #9 permanece aberto, em draft e com conflito em 14 de agosto de 2026. O
commit canônico das funções publicadas é
`ede946d0c8d114d2570a4089f26756b4039bf280`. O lançamento continua bloqueado
até esses arquivos estarem em `main` por este PR ou pelo PR #9 corrigido.

## Segurança e desempenho

Todas as tabelas de aplicação auditadas possuem RLS habilitada. As tabelas
privadas e financeiras sem policies usam negação por padrão; isso é intencional.
As RPCs administrativas `SECURITY DEFINER` são executáveis por `authenticated`,
mas verificam permissão administrativa internamente. Os testes de reconciliação
devem provar essa fronteira novamente.

Foi encontrada uma fragilidade independente da RLS: default ACLs antigas deram
`TRUNCATE`, `REFERENCES` e `TRIGGER` a `anon`, `authenticated` e `service_role`
em tabelas públicas. RLS não protege `TRUNCATE`. A nova migration removerá essas
permissões atuais e futuras sem retirar o CRUD intencional.

Os advisors também apontaram índices ausentes nas FKs:

- `private.admin_audit_logs(actor_id)`;
- `private.admin_users(created_by)`;
- `public.concursos(created_by)`;
- `public.concursos(updated_by)`;
- `public.payment_transactions(checkout_session_id)`.

O Auth está com proteção contra senhas vazadas desativada. Essa configuração é
de painel e será um bloqueio de lançamento, não SQL da migration.

Referências dos advisors:

- [RLS habilitada sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
- [Funções SECURITY DEFINER executáveis](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
- [Proteção de senha](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
- [Índices de foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)

## SQL exato proposto

O pipeline editorial será aplicado usando exatamente
[`supabase/migrations/202608090001_editorial_import_pipeline.sql`](../supabase/migrations/202608090001_editorial_import_pipeline.sql),
SHA-256 `6D59A0AAC158494B26CDBC0D3443068E50A6885535352120BAFC897B8FEDDEA2`.
Esse arquivo tem 1.213 linhas, cria os objetos ausentes, habilita RLS, mantém as
importações no schema privado e expõe somente questões publicadas.

A nova migration de reconciliação conterá exatamente o bloco adicional abaixo:

```sql
revoke truncate, references, trigger
on all tables in schema public
from anon, authenticated, service_role;

alter default privileges for role postgres in schema public
revoke truncate, references, trigger on tables
from anon, authenticated, service_role;

create index if not exists admin_audit_logs_actor_id_idx
  on private.admin_audit_logs (actor_id);

create index if not exists admin_users_created_by_idx
  on private.admin_users (created_by);

create index if not exists concursos_created_by_idx
  on public.concursos (created_by);

create index if not exists concursos_updated_by_idx
  on public.concursos (updated_by);

create index if not exists payment_transactions_checkout_session_id_idx
  on public.payment_transactions (checkout_session_id);
```

Depois que o pipeline passou a existir, os advisors revelaram três FKs que não
podiam aparecer na auditoria inicial. Uma segunda migration contém exatamente:

```sql
create index if not exists editorial_import_batches_created_by_idx
  on private.editorial_import_batches (created_by);

create index if not exists questions_created_by_idx
  on public.questions (created_by);

create index if not exists questions_updated_by_idx
  on public.questions (updated_by);
```

O projeto descartável confirmou que as tabelas do KAD são criadas por
`postgres`, e que o executor não é membro de `supabase_admin`. Por isso a
migration altera somente os default privileges de `postgres`. Os defaults de
`supabase_admin`, usados por objetos gerenciados pela plataforma, permanecem
fora do escopo; tentar alterá-los faz a migration falhar com `42501`.

## Repair oficial proposto

Depois de comprovar novamente que os objetos equivalentes existem, e antes do
push, as versões locais materialmente presentes serão registradas com a CLI:

```powershell
npx supabase migration repair --linked --status applied `
  202608010001 202608010002 202608020001 202608020002 `
  202608020003 202608020004 202608020005 `
  202608110001 20260812024756
```

`202608090001` não entra nesse comando. Depois do repair, `migration list` e
`db push --dry-run` devem mostrar somente o pipeline editorial,
`reconcile_remote_schema` e `complete_editorial_fk_indexes` como pendentes. O
push real só poderá repetir exatamente essa lista de três migrations.

## Impacto, riscos e rollback

- Nenhuma instrução proposta atualiza ou exclui linhas existentes.
- O pipeline adiciona tabelas, colunas, índices, policies e funções. As funções
  de importação só alteram dados quando chamadas depois da migration.
- `ALTER TABLE public.concursos` adquire lock de schema por curto período; a
  tabela está vazia no momento da auditoria.
- Os oito índices adquirem locks breves. As tabelas afetadas têm entre zero e
  um registro, exceto as tabelas de pagamento não indexadas, que também estão
  vazias na coluna afetada.
- A revogação de privilégios é imediata. Ela remove apenas operações de DDL ou
  destrutivas não usadas pelo cliente, preservando SELECT/INSERT/UPDATE/DELETE
  já concedidos explicitamente.
- DDL transacional que falhar será revertido automaticamente pelo PostgreSQL.
- Depois de uma aplicação bem-sucedida, não será feito rollback destrutivo. Se
  surgir incompatibilidade, será criada uma migration corretiva. As tabelas do
  pipeline só poderiam ser removidas com segurança enquanto vazias e após nova
  aprovação explícita.
- O repair altera apenas o histórico, não o schema. Seu rollback oficial seria
  `migration repair --status reverted` apenas para uma versão comprovadamente
  marcada de forma incorreta; não será usado para desfazer DDL.

## Critérios de aprovação da Fase 2

1. Projeto descartável recebe todas as migrations do zero sem erro.
2. Testes provam leitura pública apenas de questões publicadas.
3. Usuários comuns não acessam importações, administração ou finanças alheias.
4. `anon` e `authenticated` não possuem `TRUNCATE`, `REFERENCES` ou `TRIGGER`.
5. Advisors são executados novamente, sem foreign keys não indexadas, e as
   diferenças restantes são justificadas.
6. Contagens do `kad-dev` antes e depois permanecem iguais nas tabelas existentes.
7. O dry-run lista somente as três migrations aprovadas.

## Evidência no projeto descartável

O proprietário aprovou a Fase 2 para o projeto `kad-reconciliation`
(`txqnvkovdstikgziczyk`). Antes da execução, o projeto estava saudável, sem
tabelas públicas/privadas e sem migrations.

Foram aplicados, em ordem, os dez arquivos originais, os três espelhos do
histórico remoto e as duas migrations novas. O histórico descartável terminou
com 15 registros.

Duas falhas de validação impediram que SQL incompatível avançasse:

1. O primeiro espelho de `20260812211105` repetia integralmente
   `20260812024756` e falhou com `42723`, pois a migration original não é
   idempotente para a assinatura de oito argumentos de
   `apply_mercado_pago_payment`. O espelho foi convertido em arquivo histórico
   sem SQL executável, referenciando o arquivo canônico e o MD5 remoto.
2. A primeira versão de `reconcile_remote_schema` tentou alterar os defaults de
   `supabase_admin` e falhou com `42501`. A auditoria comprovou que o executor e
   todas as tabelas do KAD usam o owner `postgres`; o executor não pertence a
   `supabase_admin`. A migration passou a alterar somente os defaults do owner
   correto.

Ambas as falhas ocorreram em migrations transacionais e foram revertidas pelo
PostgreSQL antes da versão corrigida ser aplicada.

Verificações executadas no descartável:

- teste estático de schema e webhook: 31/31;
- pgTAP de reconciliação: 29/29;
- pgTAP de pagamentos: 41/41;
- `anon` e `authenticated` visualizaram somente a questão sintética publicada,
  nunca o rascunho;
- acesso direto de `anon` e `authenticated` às importações privadas retornou
  `42501`;
- RPC administrativa chamada por usuário comum retornou
  `42501 Admin permission required`;
- zero grants perigosos atuais para roles de cliente;
- zero grants perigosos nos default privileges de `postgres`;
- os oito índices de foreign keys existem;
- `service_role` conserva SELECT/INSERT/UPDATE do checkout e EXECUTE da RPC de
  pagamento, mas não possui SELECT direto em `payment_transactions`;
- todos os arquivos das quatro Edge Functions publicadas são idênticos aos
  arquivos desta branch, normalizando apenas espaço final;
- advisor de desempenho: zero `unindexed_foreign_keys`; os 20 avisos restantes
  são `unused_index`, esperados em um banco recém-criado;
- advisor de segurança: oito INFO de RLS sem policy, usados como deny-all, e 14
  WARN de RPCs administrativas `SECURITY DEFINER`; todas as RPCs `admin_*`
  verificadas incluem `private.has_admin_permission`, e a chamada comum foi
  negada em execução.

As duas questões sintéticas usadas no teste de RLS foram removidas ao final.
Nenhum dado real foi inserido no projeto descartável.

## Próximo checkpoint

Nenhuma escrita foi feita no `kad-dev`. Antes do repair e do dry-run remoto, o
responsável deve aprovar novamente as três migrations pendentes e os nove
registros de histórico a reparar.
