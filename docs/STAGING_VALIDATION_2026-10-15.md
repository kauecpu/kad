# Validação do KAD em staging

Em 15/10/2026, a migration corretiva foi aplicada e os fluxos principais do backend
foram exercitados no Supabase real. Resultado HTTP: **28 grupos aprovados e 1
reprovado**, em 107 requisições das execuções finais. As asserções adicionais de
billing por SQL passaram. **A versão ainda não está liberada para produção**:
Google Play retorna `500 server_not_configured`, e faltam as provas completas dos
provedores, e-mail e interfaces.

Staging é `npaoyezfwmgauirrlyog`, chamado **kad-prod** no painel. Produção é
`tknxtwwwoqwbzddplzzg`, chamada **kad-dev**. Todas as escritas desta validação foram
direcionadas ao primeiro ref. Não houve deploy em produção nem merge dos PRs.

## Continuação de e-mails e interface

Google Play e pagamentos sandbox foram **adiados por solicitação do responsável**
em 15/10/2026, enquanto as contas e credenciais dos provedores não estiverem
disponíveis. O erro Google continua pendente; adiamento não equivale a aprovação
de compra ou de cobrança para produção.

Na continuação sobre `042c43b`, `npm run check` passou novamente com 523 testes,
ensaio de migrations, TypeScript e lint. `npm --prefix site run check` passou com
145 testes, TypeScript e build. A suíte cobre contratos e transporte de e-mails,
assinatura do hook, redirecionamentos, recuperação de senha e estados de sessão;
os provedores dos testes automatizados são simulados.

A leitura pública de `/auth/v1/settings` em staging retornou HTTP 200: autenticação
por e-mail habilitada, cadastro habilitado e confirmação de e-mail obrigatória.
`send-auth-email` não aparece entre as funções publicadas nesse projeto. Isso não
determina se o SMTP padrão ou um SMTP personalizado entrega mensagens; o envio
real aguarda um endereço controlado indicado pelo responsável. Não houve envio
nem alteração de SMTP, hook ou secrets nesta continuação.

A validação visual não foi executada: a ferramenta de navegador negou acesso a
`http://localhost:5173`. Mesmo após autorização explícita do responsável, a nova
tentativa foi rejeitada por uma permissão salva ou política gerenciada. Não foram
usados outros navegadores, portas ou automações para contornar esse bloqueio.
Liberar a origem na configuração de acesso antes de retomar a inspeção visual;
os testes automatizados e o build não comprovam layout, teclado ou responsividade.

## Banco e funções publicados

O histórico de staging passou de 39 para **40 migrations**, com
`20261015150205_restore_abuse_limit_execute`. O Supabase atribuiu esse timestamp
na aplicação; o arquivo local foi renomeado para corresponder ao histórico remoto,
substituindo o identificador provisório `202610150001`. Não manter as duas cópias.
As 16 lacunas de produção continuam no [plano de rollout](RELEASE_READINESS_2026-10-15.md).

Permissões verificadas após a aplicação:

| Operação | service_role | authenticated | anon |
| --- | --- | --- | --- |
| Executar `consume_abuse_limit(uuid,text)` | Permitido | Negado | Negado |
| SELECT direto em `private.abuse_limit_counters` | Negado | Sem nova concessão | Sem nova concessão |

O limite real retornou cinco tentativas permitidas e a sexta negada. A Edge
Function de cancelamento também retornou `429` com `Retry-After` na sexta chamada.

As fontes foram comparadas com a composição local `main@61b2bbf` +
[#113](https://github.com/kauecpu/kad/pull/113) (`8e1b745`) +
[#115](https://github.com/kauecpu/kad/pull/115) (`f6584a1`), commit de ensaio
`2fb3262`. Quatro bundles tinham helpers divergentes e foram alinhados:

| Função | Versão após validação | JWT no gateway | Resultado |
| --- | ---: | --- | --- |
| create-payment-checkout | 13 | Sim | Publicada; 5/5 arquivos conferidos |
| mercado-pago-webhook | 15 | Não, mantém assinatura própria | Publicada; 4/4 arquivos conferidos |
| reconcile-payment-checkout | 11 | Sim | Publicada; 6/6 arquivos conferidos |
| validate-google-purchase | 3 | Sim | Publicada; 4/4 arquivos conferidos |
| cancel-subscription | 13 | Sim | Já correspondia ao candidato; preservada |
| delete-account | 3 | Sim | Já correspondia ao candidato; preservada |

A divergência Google estava no tratamento de estados sem direito de acesso; as
três funções Mercado Pago tinham o helper anterior à injeção opcional de HTTP
para testes. Os entrypoints já correspondiam à integração. As opções de JWT
foram preservadas. Os bundles anteriores foram guardados na workspace local,
fora do Git. Os hashes e a conferência dos bundles publicados estão na
[evidência estruturada](evidence/staging-validation-2026-10-15.json).

## Fluxos exercitados no ambiente real

Os testes usaram três contas descartáveis, identificadas por metadata e e-mail
`example.invalid`. O provisionamento SQL confirmou previamente os e-mails;
portanto estes resultados não validam cadastro público nem entrega de mensagens.
O login, refresh, PostgREST e as Edge Functions foram acessados por HTTP real,
usando somente chave pública e tokens das próprias contas.

| Área | Evidência | Resultado |
| --- | --- | --- |
| Auth e perfil | Login, senha inválida, refresh, getUser, edição própria, isolamento entre usuários e logout invalidando refresh | Aprovado |
| Questões e favoritos | Catálogo publicado, correção no servidor, tentativa de forjar resposta por escrita direta, favorito e isolamento | Aprovado |
| Flashcards | Deck/card, revisão, alteração, exclusão em cascata e tentativa de vincular card a deck alheio | Aprovado |
| Redação | Sincronização, documento antigo não sobrescreve o novo, leitura/escrita entre usuários negadas | Aprovado |
| XP e ranking | XP calculado pelo servidor, evento repetido não premia novamente, opt-out inicial e opt-in/consulta/opt-out | Aprovado |
| Acesso administrativo | Usuário comum negado; conta temporária de suporte consulta dashboard | Aprovado para leitura de suporte |
| Feedback | Envio pela RPC pública autenticada | Aprovado |
| Simulado | Gratuito bloqueado; premium sintético cria, pausa e conclui; snapshot antigo não reverte estado; isolamento | Aprovado por API |
| Proteção Edge | Cinco endpoints sensíveis rejeitam anônimo; checkout e reconciliação rejeitam entrada inválida | Aprovado antes de operação no provedor |
| Cancelamento | Conta sem assinatura retorna 404; sexta tentativa retorna 429 e Retry-After | Aprovado sem assinatura no provedor |
| Webhook | Requisição sem assinatura rejeitada | Aprovado; entrega assinada real pendente |
| Exclusão | CORS exato com/sem www, origem com sufixo malicioso negada, senha errada negada, conta descartável removida | Aprovado |
| Google Play Edge | Requisição autenticada chega ao gate de configuração | Reprovado: HTTP 500, `server_not_configured` |

Resultados por fase: estudos **13/0**, premium **6/0**, Edge **9/1**
(aprovados/reprovados). As contagens incluem login e encerramento de sessões em
cada fase; não representam 29 jornadas independentes de interface.

`npm run check` passou após o alinhamento da migration: 523 testes Node, ensaio
offline de migrations, TypeScript e lint. As validações anteriores do conjunto
dos PRs (546 raiz, 146 site e 94 HTTP Deno) estão no plano de lançamento.

## Billing no PostgreSQL real

Chamadas às RPCs como `service_role`, com asserções privilegiadas de leitura:

- Google: ativa compra sintética; `past_due` com flag legada de acesso verdadeira
  expira; token não troca de dono; expirar uma compra antiga preserva outra
  elegível; expiração final e repetição não restauram acesso nem duplicam compras.
- Mercado Pago: duas aprovações do mesmo pagamento criam uma linha no ledger e
  um período; reembolso seguido de aprovação atrasada preserva `canceled` e
  `payment_refunded`.
- Webhook: primeiro claim obtém lease, novo claim retorna `busy`, finalização
  válida permite que repetição retorne `duplicate`.

O ensaio Mercado Pago terminou com `ROLLBACK`. Google usou tokens exclusivamente
sintéticos para liberar a fase premium, depois expirados e removidos. Nenhuma
cobrança, assinatura ou compra foi criada em provedor externo. Os testes de lease
foram sequenciais na mesma transação; concorrência entre sessões permanece
coberta pelo CI PostgreSQL, não por esta prova remota.

## Limpeza e repetição

A conta C foi excluída pela Edge Function real após confirmação de senha. As
contas A/B foram removidas por SQL restrito aos IDs e metadata desta execução.
As sessões foram encerradas e os dados associados removidos. A verificação final
registrou **zero resíduos em 25 consultas** de Auth, perfis, estudos, billing,
feedback, acesso administrativo e limitadores. O teste não alterou contas reais.

O runner manual [test-staging-smoke.mjs](../scripts/test-staging-smoke.mjs) é fixado
no ref de staging e exige `--confirm-staging`. Não faz parte do CI automático,
pois altera dados de teste no ambiente remoto. Requer Node com `fetch` e uma
`.env.staging.local` ignorada pelo Git, contendo `SUPABASE_PUBLISHABLE_KEY`.

Para repetir, provisionar um novo UUID de execução e três contas A/B/C isoladas,
com metadata `validation_fixture` igual ao UUID, e-mails
`kad-stage-<UUID>-<a|b|c>@example.invalid`, senhas aleatórias de pelo menos 30
caracteres e e-mail confirmado. C precisa de acesso temporário `support` em
`private.admin_users`. Enviar `{run, users:[{id,label,email,password}]}` por stdin;
nunca gravar credenciais em arquivo, histórico, log ou Git.

Executar `node scripts/test-staging-smoke.mjs --confirm-staging study`, depois
atribuir por RPC uma assinatura Google sintética ativa exclusivamente a A e
executar a fase `paid`; por último, executar `edge`. Esta última exclui C. B deve
continuar sem assinatura e com contador de cancelamento novo. Usar fixtures novas
em cada execução completa: os testes de XP, ranking e limites esperam estado
inicial. O runner encerra sessões, mas **a limpeza das contas e dados restantes
é responsabilidade do operador**, mesmo em falhas. Validar metadata antes da
exclusão e conferir zero resíduos após a limpeza.

## Gates restantes para lançamento

1. **Google Play, se Android fizer parte da versão:** configurar
   `GOOGLE_PLAY_PACKAGE_NAME` e `GOOGLE_SERVICE_ACCOUNT_JSON` no staging. Pelo
   código e pelo erro, ao menos uma dessas variáveis está ausente; não foi lido
   seu conteúdo. Validar conta de serviço/permissões, produtos e compra de teste,
   restauração, renovação e perda de direito. Usar o painel de secrets, sem
   compartilhar chaves em chat ou Git.
2. **Mercado Pago:** confirmar modo sandbox e credenciais de teste; executar
   checkout válido, entrega de webhook assinada, reconciliação, liberação do
   plano, cancelamento e reembolso. Entradas inválidas e SQL sintético não
   substituem esta prova. O modo das credenciais atuais não foi confirmado.
3. **Auth e interfaces:** testar cadastro/confirmar e-mail, recuperação de senha,
   navegação e estados de erro no navegador; executar build instalado e fluxos
   nativos quando aplicáveis. Não houve validação visual nesta etapa.
4. **Candidato final:** aprovar merges, congelar o SHA integrado e repetir os
   gates relevantes. O deploy de staging usa a composição revisada; a `main`
   ainda não contém os dois PRs.
5. **Produção:** seguir o preflight, recuperação e lote 16 + 1 do plano. Reavaliar
   o [risco residual de dependências](DEPENDENCY_SECURITY_EXPO54.md) antes da
   decisão de lançamento.

Os advisors de staging seguem com 14 tabelas com RLS sem policy, 28 funções
SECURITY DEFINER executáveis por authenticated e proteção contra senhas vazadas
desabilitada. Esses avisos não autorizam abrir tabelas privadas; requerem revisão
da intenção e da exposição. Referências de remediação:
[RLS sem policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy),
[SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[proteção de senhas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
