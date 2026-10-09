# Correções prioritárias da auditoria de segurança

Estas alterações tratam a autorização de simulados no servidor, os estados de
assinatura Google Play e o parâmetro de tema da redação no site. O PR não aplica
migrations nem publica o site ou Edge Functions em produção.

## Atualização após o PR #114

A branch foi integrada à `main` `6e6a341` em 2026-10-09 sem reescrever o histórico.
Os dois conflitos (`site/src/main.ts` e `site/tests/essay-security.test.ts`) foram
resolvidos mantendo integralmente a versão mais recente do #114: validação de
temas, recuperação de rascunhos legados, sincronização com identidade válida,
mensagem sem confirmação falsa e bloqueio de respostas durante a pausa.

O escopo restante em relação à main é a proteção server-side dos simulados e o
classificador Google, com seus testes e esta documentação. Não há migração nova,
alteração de dependências ou aplicação de SQL em ambientes externos nesta
atualização. O teste de banco também aplica/reaplica as migrations de simulados e
limites de uso no mesmo PGlite descartável: a cota já esgotada, suas permissões e
o histórico devem continuar intactos.

O PR #113 continua separado. Ele complementa a revalidação financeira Google
(inclusive a preservação de outra assinatura válida) e a publicação segura do
Worker; este PR não incorpora nem substitui esses ajustes. Os cenários Google
abaixo usam fixtures e não demonstram integração com uma conta Play real.

Verificações repetidas nesta combinação:

- `npm run check`: 517 testes, tipos e lint aprovados.
- `npm --prefix site run check`: 129 testes, tipos e build aprovados.
- Contratos HTTP no Deno 2.2.6, conforme o workflow: 41 aprovados, serviços
  externos simulados.
- `site/scripts/study-regressions-browser.mjs`: 13 cenários aprovados, sem erros
  de página; Worker compilado em localhost e tráfego externo interceptado.
- Testes específicos de simulados, Google, limites, redação e pausa: 17 aprovados.

As dependências locais ausentes foram resolvidas reutilizando a instalação
compatível já existente; manifestos e lockfiles continuam iguais à main.
Os avisos prévios de bundle acima de 500 kB e `VITE_SITE_URL` ausente permanecem.
Esses resultados não aprovam aplicação de migrations ou publicação em produção.

## Simulados no servidor

A migration `20261008003639_enforce_simulation_entitlements.sql` mantém a assinatura
de `sync_simulation_session`, as tabelas, os registros e as políticas de leitura.
O servidor exige identidade autenticada igual a `p_user_id` e consulta
`subscriptions` antes de criar uma sessão. O cliente não decide o plano.

Para criar uma sessão, o usuário precisa de plano `platinum`, `diamond` ou
`circle` legado, status `active`, `past_due` ou `canceled` e período pago futuro.
O suporte a `circle` preserva contratos antigos, sem criar um produto novo.
A checagem precede a substituição de uma sessão aberta; uma tentativa sem
assinatura não apaga o simulado anterior.

O usuário pode continuar e concluir uma sessão que já existe após o vencimento.
O servidor impede trocar `config`, `questions`, a data de criação e reabrir uma
sessão concluída. O ID e o status do JSON devem corresponder aos parâmetros do RPC,
pois os clientes leem esse JSON. Atualizações antigas não sobrescrevem progresso mais recente.
O bloqueio por usuário preserva a regra existente de uma sessão aberta por conta.

Uma sessão criada offline que nunca chegou ao servidor conta como nova. Se o plano
vencer antes da primeira sincronização, o servidor retorna `subscription_required`.
O cliente mantém os dados locais; a data enviada pelo cliente não comprova que o
usuário tinha acesso no passado. Clientes antigos continuam usando o mesmo RPC,
mas recebem erro se tentarem alterar o conjunto de questões já salvo.

Esta proteção cobre a persistência remota. Ela não transforma conteúdo ou regras
distribuídas ao cliente em um ambiente inviolável, nem valida respostas ou notas.

## Assinaturas Google Play

O classificador concede acesso apenas a `ACTIVE`, `IN_GRACE_PERIOD` e `CANCELED`
com vencimento futuro válido. Cancelar renovação não remove o período já pago.
`ON_HOLD`, `PAUSED`, estados desconhecidos e estados sem acesso produzem o contrato
interno `expired`, com `entitled: false`. Esse valor interno expressa ausência de
direito de acesso, não uma tradução literal do estado Google.

A resposta não autorizada chega ao RPC existente `apply_google_play_purchase`,
que revoga o acesso anterior sem duplicar a assinatura. Compras `PENDING`
continuam retornando `purchase_pending`; credenciais e validação do token não mudam.
Veja o [ciclo de vida documentado pelo Google](https://developer.android.com/google/play/billing/lifecycle/subscriptions).

Um registro que o código antigo marcou como `past_due` não muda só com este PR.
Após publicar a função, o responsável deve revalidar essas compras pelo fluxo
autenticado e pela API Google. Não revogue todos os `past_due` em lote: esse status
pode representar outro provedor ou um período de tolerância válido.

## Tema da redação

O site inicia o cronômetro e persiste o texto apenas para IDs presentes no catálogo
de temas. A leitura do mapa de redações considera propriedades próprias.
Parâmetros como `__proto__`, `constructor` e temas inexistentes não iniciam timers,
alteram protótipos ou geram sincronizações. Temas válidos mantêm texto e tempo.

## Ativação e reversão

O responsável deve revisar o PR e validar em staging antes de publicar:

1. Aplicar a nova migration, conferir permissões e testar duas contas isoladas:
   assinante cria uma sessão; conta sem assinatura recebe erro; nenhuma lê a outra.
2. Publicar a Edge Function que importa `google-play.ts` e revalidar compras de
   teste suspensas. Conferir a revogação no banco, sem usar compras reais.
3. Publicar o site e testar tema válido e URL com tema inválido.

A migration não exige backfill e aceita reaplicação. Em caso de falha, prefira
suspender a escrita desse RPC sem restaurar a versão que dispensava assinatura.
Como há migrations posteriores na main, confira o histórico e a lista exata de
pendências de cada ambiente antes de planejar a aplicação dessa migration antiga.
Não use uma atualização indiscriminada do banco para contornar a ordem; esta
atualização do PR não aplica nem marca migrations remotamente.
Com autorização operacional, aplique em uma transação:

```sql
revoke execute on function public.sync_simulation_session(
  uuid, text, text, jsonb, timestamptz, timestamptz, timestamptz
) from public, anon, authenticated;
```

A medida pausa sincronizações, preserva registros e leitura do histórico. Após
corrigir o problema, reaplique a definição e os grants da migration. Para um
problema no classificador Google, suspenda a validação de novas compras até a
correção; restaurar o classificador anterior voltaria a conceder acesso indevido.

## Verificação e limites

Os testes reproduziram os três problemas antes das correções. A suíte de regressão
exercita o SQL real em PGlite descartável, incluindo autenticação, isolamento,
vencimento, imutabilidade, repetição, histórico e suspensão/restauração do RPC.
Outro teste liga o classificador Google ao RPC financeiro real usando fixtures.
Os testes do site executam as funções reais de timer e buffer com relógio simulado.

Execute `npm run check` na raiz e `npm --prefix site run check`. Não há chamadas
reais ao Google nem alterações em bancos externos nesses testes.
Repita também `site/scripts/study-regressions-browser.mjs` no servidor local
compilado, conforme `site/README.md`: ele cobre os 13 cenários de questões,
simulado e redação preservados do #114, com tráfego externo interceptado.

O Supabase local não estava ativo: `supabase db advisors --local --type security`
falhou por conexão recusada em `127.0.0.1:54322`. Antes do deploy, execute os
advisors e os testes via HTTP com Supabase em staging. PGlite comprova o SQL e as
permissões testadas, mas não substitui a validação do gateway, JWTs e configuração
do projeto implantado.

Este PR não atualiza dependências, retenção de dados locais ou workflows de CI;
esses achados da auditoria continuam fora desta correção prioritária.
