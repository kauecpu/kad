# KAD: preparação da versão de lançamento

Revisão em 15/10/2026. Base: `main@61b2bbf05a0958aa86c7f22dd19dd184103faa56`.
Este documento registra a revisão, as correções e o plano de execução em produção.
A etapa inicial não publicou migrations ou funções. Na validação posterior,
staging recebeu a correção e quatro funções; resultados e bloqueios estão em
[validação de staging](STAGING_VALIDATION_2026-10-15.md). Produção não foi alterada.

## Decisão

Os PRs [113](https://github.com/kauecpu/kad/pull/113) e
[115](https://github.com/kauecpu/kad/pull/115) podem seguir para aprovação de merge
nos commits revisados, com os testes descritos abaixo. Não foi encontrado novo
defeito bloqueante nos diffs efetivos. Isso não libera a publicação da versão:
produção ainda não tem o banco e as funções exigidos pelo código atual.

O ensaio das 16 migrations pendentes revelou um bloqueador de implantação:
`202610080001_production_security_baseline.sql` revoga `EXECUTE` de todas as
funções, incluindo `consume_abuse_limit`, que já existe em produção. Sua lista
de concessões não restaura essa RPC. Exclusão de conta, cancelamento e validação
Google passam a falhar de forma fechada no limitador.

Foi preparada a migration adicional
`20261015150205_restore_abuse_limit_execute.sql`. Ela concede execução somente a
`service_role`, mantém `anon` e `authenticated` sem execução e não concede acesso
às tabelas privadas. São **16 pendências históricas + 1 correção**, sem reescrever
migrations já aplicadas. A correção já entrou em staging; o arquivo local passou
a usar o timestamp efetivamente registrado pelo Supabase, sem duplicar a versão.

## Revisão dos PRs

| PR / commit | Verificação | Parecer |
| --- | --- | --- |
| #113 / `8e1b7458becc3b049a64fde232d9fc9fa42bd3e2` | Autenticação antes de Google/OAuth e do uso de identidade no limitador; catálogo com `Object.hasOwn`; entitlement fechado para estados desconhecidos; CAPTCHA explicitamente desligado; testes HTTP e de classificação | Apto para aprovação do código. Manter CAPTCHA desligado até validar a configuração real. A migration de revalidação Google já está na `main` via #110; não duplicá-la. |
| #115 / `f6584a1288a2bf2b209edc8fe018868c73700b0c` | Origens exatas apenas em `delete-account`; preflight e respostas de erro; preservação de `Retry-After`, correlação e cache; nenhuma alteração na autorização por usuário/senha | Apto para aprovação do código. Priorizar a integração para evitar que um deploy da `main` antiga remova a correção já publicada. |

Os dois heads tinham `quality` e `payment-regression` aprovados no GitHub.
A composição local `main + #113 + #115` integrou sem conflitos e passou em:

- 546 testes Node da raiz;
- 146 testes do site;
- 94 testes Deno dos contratos HTTP de pagamentos, abuso, exclusão e Google.

Os testes HTTP usam provedores simulados; não comprovam cobrança, compra Google,
CAPTCHA ou entrega de e-mail reais. O ensaio conjunto utilizou as dependências
da workspace corrigida. Reexecutar CI no commit resultante dos merges.

Ordem recomendada: aprovar #115, aprovar #113 e integrar este pacote de preparação;
em seguida congelar o SHA candidato e validar o conjunto em staging. O #110 já
está integrado. Não há motivo para reaplicá-lo como outro PR.

## Estado remoto verificado por leitura

Os nomes dos projetos estão invertidos em relação ao uso; conferir sempre o ref:

| Uso | Nome no Supabase | Project ref | Histórico antes desta alteração |
| --- | --- | --- | ---: |
| Staging | kad-prod | `npaoyezfwmgauirrlyog` | 39 |
| Produção | kad-dev | `tknxtwwwoqwbzddplzzg` | 23 |

Produção tem as primeiras 20 migrations até `20260828220803`, além de:

- `20261008003639_enforce_simulation_entitlements`;
- `20261008215543_abuse_protection`;
- `20261009231430_preserve_simulation_sync_version`.

Não executar essas três novamente: a última preserva o cursor offline e faz
backfill de `persisted_at`. O ensaio confirmou que as 16 faltantes não substituem
a definição final de `sync_simulation_session`.

A inspeção do catálogo confirmou ausência das tabelas de flashcards, níveis e
gamificação e das RPCs novas de Google, ranking e reconciliação em produção.
`consume_abuse_limit` existe com execução exclusiva do backend. Há 11 checkouts,
1 assinatura e 0 transações no instante da consulta; portanto o ambiente não é
descartável. Esses totais devem ser recolhidos novamente na janela de execução.

Funções que exigem reconciliação antes do lançamento:

| Função | Produção observada | Ação após o banco |
| --- | --- | --- |
| create-payment-checkout | v20, anterior às mudanças de setembro | Publicar o SHA aprovado e testar checkout sandbox |
| cancel-subscription | v18, anterior às mudanças de setembro | Publicar e validar cancelamento/limite |
| mercado-pago-webhook | v20, anterior às mudanças de setembro | Publicar com assinatura do provedor, idempotência e ordenação validadas |
| reconcile-payment-checkout | ausente | Publicar após as RPCs de reconciliação |
| validate-google-purchase | ausente | Publicar após billing + revalidação; testar Google Play sandbox |
| delete-account | v22, JWT obrigatório | Preservar o comportamento de #115 e validar no SHA integrado |
| send-auth-email | v3 | Preservar o hook e validar entrega; não republicar incidentalmente |

As versões de staging e produção não são comparáveis como número de release.
Registrar hash do bundle e SHA de origem em cada deploy. Os advisors ainda
reportam proteção contra senhas vazadas desabilitada e funções `SECURITY DEFINER`
acessíveis a usuários autenticados; conferir intencionalidade/RLS de cada caso.
Tabelas privadas com RLS e sem policies não devem receber policies permissivas
apenas para eliminar avisos.

Também foi baixado o código publicado de `delete-account` v22: o entrypoint e
os helpers `abuse-protection.ts` e `http.ts` coincidem com a integração revisada
do #115, normalizando apenas finais de linha e espaços nas extremidades.

## Ordem das 16 migrations históricas

Preservar os arquivos e identificadores completos. Cada etapa depende das
anteriores; os grupos são checkpoints de observação, não releases independentes.

| # | Arquivo em `supabase/migrations/` | Efeito / dependência | Critério de aceite |
| ---: | --- | --- | --- |
| 1 | `20260828230000_flashcards.sql` | Decks, cards e revisões privadas | RLS: usuário A não lê nem altera dados de B; revisão e arquivamento persistem |
| 2 | `202608300001_google_play_billing.sql` | Provedor Google, compras e RPC; depende de assinaturas | Token não pode mudar de proprietário; API de escrita exclusiva do backend |
| 3 | `20260902040533_payment_checkout_diagnostics.sql` | Motivo de status e retorno da consulta | Código/razão coerentes; consulta restrita ao dono |
| 4 | `20260902052712_study_levels.sql` | Contas/eventos de XP e RPC | XP derivado no servidor; repetição não duplica prêmio |
| 5 | `20260902150000_payment_checkout_reconciliation.sql` | Lease de reconciliação por checkout | Uma reconciliação por janela; concorrente recebe espera |
| 6 | `20260903013128_payment_checkout_reconciliation.sql` | Marcador histórico, arquivo intencionalmente sem SQL | Registrar a versão pelo fluxo de migrations; não copiar/reexecutar o SQL de #5 |
| 7 | `20260903014225_payment_atomic_status_reason.sql` | Estado e motivo atômicos em pagamento/cancelamento | Refund/chargeback não voltam a aprovado por entrega atrasada |
| 8 | `20260903043158_payment_legacy_terminal_compatibility.sql` | Backfill conservador de motivos legados | Comparar linhas candidatas e alteradas; preço, período e ledger preservados |
| 9 | `20260903082519_get_latest_open_payment_checkout.sql` | Recupera checkout aberto do usuário | Usuário vê só o seu; expiração coerente |
| 10 | `20260903220504_payment_webhook_claims.sql` | Lease/idempotência de eventos do webhook | Entregas repetidas e concorrentes creditam uma vez |
| 11 | `20260903220508_payment_lifecycle_ordering.sql` | Ordenação por instante observado no provedor | Evento velho não reabre nem estende período |
| 12 | `20260903220512_subscription_observed_state.sql` | RPC com timestamp + leitura de assinatura; mantém RPC antiga | Cliente antigo continua compatível; snapshot conflitante rejeitado |
| 13 | `20260906104313_gamification_ranking_achievements.sql` | Conquistas e ranking opt-in; depende de flashcards/XP | Opt-out padrão; nenhum dado privado exposto no ranking |
| 14 | `202610080001_production_security_baseline.sql` | Revogações, allowlist e índices; depende das RPCs anteriores | Revisar todas as permissões; manter operações sensíveis pausadas até a correção adicional |
| 15 | `202610080002_security_advisor_followup.sql` | Índice de FK de conquistas | Índice válido, sem alteração de linhas |
| 16 | `20261009210911_google_play_entitlement_revalidation.sql` | Revalidação/expiração Google sobre #2 | Revalidar a mesma compra é idempotente; compra sem direito não ativa plano |
| +1 | `20261015150205_restore_abuse_limit_execute.sql` | Restaura a concessão perdida em #14 | Backend executa o limitador; anônimo/autenticado e acesso direto às tabelas continuam negados |

As migrations #4, #10–13 contêm criações sem `IF NOT EXISTS`; um objeto já existente
com versão ausente exige comparação de definição antes da execução. Não reparar
histórico somente para fazer o comando passar.

## Execução futura e interrupção segura

1. **Preparar recuperação.** Exportar schema/histórico/permissões e snapshot dos
   dados; comprovar restauração em ambiente isolado. Confirmar a disponibilidade
   de backup/PITR no projeto, sem pressupor que o plano contratado os oferece.
   Salvar os bundles/configurações anteriores das funções e do site.
2. **Refazer preflight.** Executar `scripts/release-preflight.sql` por conexão
   explicitamente direcionada ao ref correto. Comparar os 23 registros esperados,
   objetos existentes, permissões e contagens. Capturar os checkouts candidatos
   ao backfill #8 em armazenamento restrito. Não exportar tokens para o Git.
3. **Ensaiar com dados representativos.** Restaurar cópia controlada em PostgreSQL
   compatível com produção, incluindo roles/RLS e dados legados. Rodar a ordem
   acima e os testes de concorrência. O ensaio PGlite deste pacote é complementar.
4. **Concluir staging.** A correção já foi aplicada (40 versões) e os testes de
   conta comum/suporte, estudos e exclusão passaram por API. Concluir os gates
   de provedores, e-mail e interfaces registrados no relatório de staging;
   repetir a validação no SHA integrado aprovado. Usar contas descartáveis.
5. **Conferir o lote.** Usar a CLI vinculada ao ref de produção e revisar
   `supabase db push --linked --include-all --dry-run`. Deve apresentar exatamente
   as 16 versões históricas acima e a correção adicional; staging não deve
   apresentar pendências. Parar se houver qualquer divergência. `--include-all` é
   necessário porque existem versões antigas ausentes antes das já registradas.
6. **Janela de implantação.** Pausar entradas de checkout/cancelamento/exclusão,
   coordenar retentativas de webhook e drenar operações em curso. Aplicar com
   limites de lock e duração definidos para a sessão, inspecionando cada resultado.
   Índices sem `CONCURRENTLY` e o backfill podem bloquear; medir no ensaio com dados.
   Não reabrir os fluxos entre #14 e a correção. Se uma etapa falhar, interromper o
   lote, verificar transação/histórico e corrigir antes de continuar.
7. **Verificar e publicar.** Esperado: 40 versões em ambos os ambientes; validar
   concessões, funções, RLS, cursor de simulado, contagens e backfill. Depois
   publicar as Edge Functions do SHA aprovado, validar os provedores e publicar
   os frontends com configuração de produção. Reabrir fluxos gradualmente.
8. **Acompanhar.** Conferir falhas de RPC/HTTP, limites 429/503, reconciliação,
   webhooks e entitlement; repetir teste de leitura/edição entre dois usuários.
   Registrar resultados e responsável pela decisão de abertura.

Não existe rollback universal dessas alterações. Antes de cada commit de
migration, uma falha deve abortar sua transação; arquivos sem transação explícita
dependem do executor e precisam ser ensaiados no mesmo caminho de implantação.
Após commits, preferir correção progressiva e rollback dos consumidores para
bundles compatíveis, preservando tabelas/colunas novas. A RPC antiga de assinatura
foi mantida justamente para compatibilidade. Não usar `db reset`, apagar versões,
excluir tabelas ou reverter o ledger em produção. Recuperação de dados via backup
exige janela, reconciliação com provedores e decisão explícita do responsável.

## Evidência local e limites

`npm run test:release-migrations` (também incluído em `npm run check`) executa SQL real em bancos PGlite
descartáveis: compara instalação cronológica com os 23 registros de produção
seguidos das 16 lacunas e da correção. Reproduz a perda de permissão; compara
definições e permissões de todas as funções `public/private`; comprova cinco
tentativas permitidas e a sexta bloqueada após a correção, sem acesso direto aos
contadores. Não usa URL, chave ou conexão remota.

O bootstrap representa apenas os objetos mínimos gerenciados por Supabase. Não
simula GoTrue, PostgREST, Storage API, volumes reais nem concorrência entre sessões.
Os testes PostgreSQL concorrentes constam aprovados no CI dos heads revisados;
não foram executados localmente nesta etapa (daemon Docker indisponível).

Dependências e medições detalhadas: [segurança no Expo 54](DEPENDENCY_SECURITY_EXPO54.md).
Testes de frontend, tipagem e lint devem permanecer verdes no SHA final. Avisos de
tamanho dos bundles e a configuração de SEO do build local permanecem tarefas
de lançamento; não bloqueiam a preparação do banco.

## Condições para fechar a versão

- [ ] Merges aprovados e CI verde no SHA integrado.
- [ ] Risco residual de dependências tratado ou aceito com responsável e prazo.
- [ ] Backup restaurável e ensaio PostgreSQL com dados representativos concluídos.
- [ ] Banco e permissões alinhados, incluindo a correção adicional.
- [ ] Edge Functions alinhadas com o schema; provedores e e-mail validados.
- [ ] Smoke tests de contas, estudos, pagamentos e isolamento de dados aprovados.
- [ ] Release nativa validada em Android/iOS, além da exportação web.

Fontes de compatibilidade e execução:
[Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/),
[migrations Supabase](https://supabase.com/docs/guides/deployment/database-migrations),
[Supabase db push](https://supabase.com/docs/reference/cli/supabase-db-push).
