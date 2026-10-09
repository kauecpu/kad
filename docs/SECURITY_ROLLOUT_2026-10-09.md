# Segurança: correções e promoção dos ambientes

Base: `c2d371c4fb1ece971874b2302c3050a9083a48ec`, `main` consultada em
2026-10-09. Branch: `codex/security-rollout-hardening`. O commit final consta no PR.

**Produção não recebeu alterações.** O responsável autorizou durante a tarefa
somente a nova migration e `validate-google-purchase` na homologação, além de
testes com contas fictícias e posterior limpeza. Não houve compra, uso de
credenciais Google, ativação de CAPTCHA ou escrita na Cloudflare.

## Estado conferido por ambiente

| Item | Homologação `npaoyezfwmgauirrlyog` (`kad-prod`) | Produção `tknxtwwwoqwbzddplzzg` (`kad-dev`) |
| --- | --- | --- |
| Migrations antes desta tarefa | 36, até `20261008215543` | 20, até `20260828220803` |
| Rate limit novo | RPC e tabelas presentes | RPC e tabelas ausentes |
| Nova migration Google | `20261009210911` aplicada e conferida | Não aplicada |
| `validate-google-purchase` | v1 → **v2**, `verify_jwt=true` | Não publicada |
| `delete-account` | v2, `verify_jwt=true` | v17, `verify_jwt=false` no gateway |
| `cancel-subscription` | v13, JWT ativo | v15, JWT ativo |
| `create-payment-checkout` | v12, JWT ativo | v17, JWT ativo |
| `mercado-pago-webhook` | v14, assinatura própria | v17, assinatura própria |
| `reconcile-payment-checkout` | v10, JWT ativo | Ausente |

Versões de funções pertencem a cada projeto; número maior não significa código
mais recente entre ambientes. Nesta tarefa só o validador Google mudou de versão.
A configuração de gateway de `delete-account` em produção não prova exclusão
anônima: o handler legado também verifica identidade e senha. A divergência de
deploy e a ausência do rate limit precisam de correção controlada.

No site público, GET de `/inicio` e `/auth/captcha` retornou o mesmo HTML.
Faltavam CSP, HSTS, X-Frame-Options e nosniff nessas páginas. O JSON de
`/api/public-config` não incluía `captchaEnabled`. Não foi possível identificar
o commit/Worker implantado pelo painel. Portanto, não atribuímos tudo a cache.

## Defeitos reproduzidos e correções

### Worker e cabeçalhos

Com a configuração anterior, navegação (`Sec-Fetch-Mode: navigate`) para
`/auth/captcha` retornou a SPA **mesmo usando o build novo**. O roteador de assets
executava antes do Worker. O teste de controle local usou portas 4187 (antes) e
4186 (corrigido); nenhuma chamada chegou à Cloudflare remota.

`assets.run_worker_first=true` garante execução do middleware. O binding ASSETS
recebe a URL original, preservando arquivos, tipos MIME, cache, códigos e fallback
SPA. Reescrever qualquer URL para `/` quebraria os assets nesse novo modo.
GET/HEAD da API e do desafio têm respostas próprias. Exceções de assets retornam
503 sem detalhes internos. Redirecionamentos e erros também recebem os cabeçalhos.

`site/server/security-headers.ts` configura:

- CSP: scripts, fontes e assets próprios; conexões HTTPS/WSS para o projeto
  Supabase exato. Com `KAD_ENV` ausente, admite somente os dois hosts canônicos
  para manter builds legados com configuração Vite. Não aceita host arbitrário.
- `style-src-attr 'unsafe-inline'` é a única exceção inline: barras de progresso,
  cores de baralhos e anéis existentes usam atributos de estilo. Não permite
  scripts inline, `unsafe-eval` ou elementos `<style>` inline na página comum.
- Imagens próprias/data/blob e Storage dos hosts exatos; nenhum CDN externo de
  fontes, analytics ou scripts é necessário no código inspecionado.
- Frame ancestors `none`/X-Frame-Options DENY na página comum. A página CAPTCHA
  conserva CSP por nonce, SAMEORIGIN, no-store, no-referrer e os destinos Turnstile.
- Referrer-Policy, nosniff e Permissions-Policy bloqueiam sensores/recursos que
  o site não usa. O widget continua dentro de iframe same-origin.

HSTS exige `SECURITY_HSTS_MAX_AGE` no Worker. Ausente significa não ativar nesta
etapa; HTTP local não recebe o cabeçalho. Valores aceitos: 0 até 31536000 segundos.
Após validar HTTPS na homologação, começar com 300; ampliar para 86400 e depois
31536000 mediante aprovação. `0` permite remover uma política já ativa em clientes
que revisitem via HTTPS. Não configuramos `preload` ou `includeSubDomains`.

Worker-first também faz arquivos estáticos passarem pelo Worker. Conferir custo,
latência e métricas do plano antes da publicação. Não liberar origens amplas para
resolver falhas: identificar a dependência e incluir somente a origem necessária.

### Google Play e banco

Os testes anteriores aceitavam ON_HOLD como acesso válido. Antes da correção,
as novas regressões falharam para ON_HOLD, PAUSED, estado desconhecido e nomes
herdados do protótipo no helper. O handler já filtrava os IDs com `Object.hasOwn`;
a proteção foi estendida ao helper, sem alegar exploração pública desse caminho.

- ACTIVE/IN_GRACE_PERIOD: acesso apenas com expiração futura válida.
- CANCELED: mantém o período pago; não renova.
- ON_HOLD/PAUSED: resultado não elegível; desconhecidos também falham fechados.
- PENDING: HTTP 409, sem aplicar compra. Expirados não concedem acesso.
- A identidade vem de `getUser()`, antes de consultar a configuração Google.
  Sem autenticação retorna 401 mesmo quando o provedor ainda não está configurado.
- A migration mantém assinatura/grants da RPC. Normaliza `past_due + entitled=true`
  de handlers antigos para não elegível. Validade finita e futura é obrigatória.
- Locks por token/usuário e chave única preservam idempotência. Token de outro
  usuário/produto é rejeitado. Somente service_role executa a RPC pública.
- Resultado negativo expira a assinatura correspondente, sem substituir outra
  assinatura válida. Pode manter outra compra Google já verificada, ainda elegível
  no ledger. O upsert reavalia a condição sob lock, inclusive diante de escritores
  de outros provedores. A resposta descreve a compra solicitada, não outro direito.

Não houve backfill ou exclusão de histórico. Estados desconhecidos que o código
antigo gravou como `active` não podem ser inferidos pela migration: exigem nova
consulta ao provedor. Não adicionamos RTDN/agendamento; expiração e revalidação
não substituem um canal de atualização do estado Google em produção. Essa
limitação deve entrar no gate antes de habilitar vendas reais.

## Ordem exata das migrations ainda pendentes em produção

São **17** arquivos no estado conferido. Isto é inventário, não autorização para
aplicar o lote. A baseline concede acesso a funções das migrations anteriores;
pular essas dependências faz a implantação falhar ou ficar incompleta.

| Ordem | Migration | Dependência/verificação principal |
| --- | --- | --- |
| 1 | `20260828230000_flashcards.sql` | Auth; RLS de baralhos, cartões e revisões |
| 2 | `202608300001_google_play_billing.sql` | Tabelas de pagamento; catálogo/ledger/RPC Google |
| 3 | `20260902040533_payment_checkout_diagnostics.sql` | Checkout; contrato de status/motivo |
| 4 | `20260902052712_study_levels.sql` | Auth/progresso; idempotência dos eventos |
| 5 | `20260902150000_payment_checkout_reconciliation.sql` | Checkout; claims e reconciliação |
| 6 | `20260903013128_payment_checkout_reconciliation.sql` | Arquivo de compatibilidade sem SQL; manter histórico canônico |
| 7 | `20260903014225_payment_atomic_status_reason.sql` | Transições atômicas após reconciliação |
| 8 | `20260903043158_payment_legacy_terminal_compatibility.sql` | Compatibilidade com checkout legado |
| 9 | `20260903082519_get_latest_open_payment_checkout.sql` | Retomada do checkout próprio |
| 10 | `20260903220504_payment_webhook_claims.sql` | Claims/repetições de webhook |
| 11 | `20260903220508_payment_lifecycle_ordering.sql` | Ordenação de eventos financeiros |
| 12 | `20260903220512_subscription_observed_state.sql` | Estado observado; overload/RPC e clientes antigos |
| 13 | `20260906104313_gamification_ranking_achievements.sql` | Níveis, tentativas e opt-in; RLS/ranking |
| 14 | `202610080001_production_security_baseline.sql` | RPCs anteriores devem existir; allowlist/grants/índices |
| 15 | `202610080002_security_advisor_followup.sql` | FK de conquistas; índice |
| 16 | `20261008215543_abuse_protection.sql` | Auth; contador privado/RPC antes dos handlers novos |
| 17 | `20261009210911_google_play_entitlement_revalidation.sql` | Ledger/RPC Google; mesma assinatura, grants restritos |

Antes de produção, ensaiar a sequência completa partindo de banco descartável no
estado antigo, com fixtures de pagamentos/estudo. Rodar os pgTAP existentes,
clientes antigos/novos e Advisors. Os testes focados desta tarefa não demonstram
compatibilidade integral dessas 17 migrations de produtos distintos.

## Plano operacional, sem executar produção

1. Identificar projeto por ref, confirmar responsáveis, exportar inventário de
   schema/migrations/grants/funções e registrar versões dos clientes/Worker.
   Obter backup lógico consistente e protegido, sem arquivos no Git, e provar
   restauração em ambiente isolado autorizado. Não presumir PITR/backup pelo nome
   do plano nem reutilizar um backup antigo como gate atual.
2. Aprovar uma janela e o ensaio do lote acima. Parar se houver migration apenas
   remota, drift, dado incompatível, falha de RLS ou restauração não comprovada.
   Não usar `migration repair`, `--include-all`, seeds ou roles para ocultar erro.
3. Aplicar somente o lote aprovado, por ordem. Após cada grupo, conferir histórico,
   schema e regressões: conteúdo/estudo, pagamentos, gamificação, baseline/limites.
   Registrar latência/locks sem coletar dados pessoais. Se falhar, não publicar os
   handlers dependentes nem avançar para o próximo grupo.
4. Publicar handlers compatíveis **depois** das RPCs: cancelamento/exclusão/Google
   precisam do limitador; checkout/reconciliação/webhook precisam dos contratos
   financeiros. Verificar JWT das funções de cliente; preservar a assinatura
   própria do webhook. Não publicar send-auth-email sem seus secrets/configuração.
5. Publicar o Worker correto após a homologação HTTPS. Cloudflare Workers Build
   deve usar o build do site e `site/dist/server/wrangler.json`, não só o diretório
   estático. Conferir conta, commit, domínio, bindings e respostas públicas.
6. Somente após esses gates, propor promoção separada para produção com autorização
   explícita. Merge da main dispara publicação segundo informação do responsável:
   **não fazer merge deste PR antes de liberar a janela e os gates**.

### Interrupção e recuperação

- Preferir correção adiante com operações afetadas suspensas. Revogar EXECUTE de
  `apply_google_play_purchase(...)` de service_role bloqueia novas aplicações;
  testar em homologação e restaurar o grant pela migration validada. Não retornar
  ao helper que aprovava estados suspensos e não apagar ledger/assinaturas.
- Para falha do limitador, usar o procedimento de `ABUSE_PROTECTION.md`; handlers
  novos falham com 503. Não contornar voltando a funções antigas sem limite.
- Manter o backup e o histórico das versões. Restauração de produção exige plano
  de conciliação das escritas posteriores; não restaurar snapshot sobre dados novos
  como rollback automático.
- Não desligar apenas a flag do cliente enquanto Auth exige CAPTCHA. Primeiro
  corrigir widget/host/secret. Suspender a exigência no Auth exige aprovação,
  avaliação de risco e controles compensatórios, antes de distribuir cliente sem token.
- Manter last-known-good **seguro** do Worker. Uma reversão que retire proteções
  não pode ser tratada como solução permanente.

## Cloudflare/Turnstile: configuração ainda manual

Conta candidata informada: `f8ffc559c1f97bf3a8431246db05fbde`. Não verificamos
membership/zone/Worker pelo painel. Worker de produção no repo: `kad-concursos`.
Preparar Worker separado de homologação, sem domínio ou secrets de produção,
somente após autorizar esse recurso na conta correta.

1. Conferir builds automáticos e permissões. Para CLI/API, obter acesso mínimo ao
   Worker de homologação e Turnstile, sem permissão global de conta/DNS. Se o
   provedor não permitir restringir o token a um Worker, registrar essa limitação
   e pedir aprovação para o escopo efetivo. OAuth/token ficam no cofre/CLI, não no chat.
2. Criar widget com hosts HTTPS exatos, sem wildcard. `TURNSTILE_SITE_KEY` é pública;
   secret vai somente no Supabase Auth do ambiente correspondente.
3. Publicar a página e os clientes compatíveis mantendo inicialmente Auth sem
   exigência. Worker: `KAD_ENV`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`,
   `AUTH_CAPTCHA_ENABLED`, `TURNSTILE_SITE_KEY`; app: `EXPO_PUBLIC_AUTH_CAPTCHA_ENABLED`
   e `EXPO_PUBLIC_AUTH_CAPTCHA_URL`. Ver `ABUSE_PROTECTION.md`.
4. Testar challenge/token reais no site e na WebView Android/iOS, incluindo erro,
   expiração, cancelamento e nova tentativa. Só então exigir no Auth de homologação
   e provar aceitação de token válido e rejeição de token ausente/expirado/reutilizado.
5. Definir atualização mínima do app antes de exigir CAPTCHA em produção. Builds
   antigos sem token perderiam login/cadastro/recuperação/confirmação de senha.
6. Revisar WAF/bots, limites Auth, SMTP, redirects e MFA com o proprietário. Não
   desafiar callbacks ou a própria rota de desafio em loop. Regras de domínio
   Cloudflare não protegem chamadas diretas a `*.supabase.co`.

## Evidências e limites

- Regressões novas antes das correções: 17 falhas de helper/cabeçalhos/roteamento,
  mais 1 falha de persistência por aceitar `past_due + entitled=true`.
- `npm run check`: 538 testes, tipos e lint aprovados.
- `npm --prefix site run check`: 134 testes, tipos e build aprovados. Uma tentativa
  de build encontrou EPERM porque o Wrangler local mantinha arquivos abertos;
  encerrado o servidor, a execução completa passou sem mudança de dependências.
- Deno 2.2.6 (mesma versão do CI): 58 cenários HTTP com fetch externo simulado, incluindo Google, rate limit,
  429/Retry-After e confirmação de senha. Nenhuma aprovação fictícia entrou no produto.
- PGlite: RPC real, revogação, outra compra válida, produto/usuário incompatível,
  escrita direta negada, repetição e reaplicação da migration sem apagar histórico.
- PostgreSQL nativo 18.4 em `127.0.0.1:55441`, cluster novo: 12 chamadas concorrentes
  com token igual resultam em uma compra/assinatura; revogação concorrente com token
  novo preserva acesso válido; suspensão/restauração do grant preserva histórico.
  Rate limit: 24 conexões, 5 permitidas/19 negadas; limpeza concorrente sem deadlock.
- Chromium + Worker compilado/Miniflare: login, cadastro e recuperação encaminham
  token de widget fictício, JS/CSS/imagens carregam, sem violação de CSP ou erro JS.
  Teste separado cobre origem/nonce forjados, cancelamento, timeout, expiração,
  retry e limpeza. Toda comunicação externa do navegador foi interceptada/bloqueada.
- Homologação HTTP real: 36 PASS, 0 FAIL, 1 BLOCKED (Google real), 83 requisições;
  nova validação de RPC Google com duas contas reais **fictícias**, 31 requisições.
  Requisições representando usuários usaram JWT próprio, sem privilégio administrativo.
  Admin foi restrito a criação/limpeza de fixtures e RPC interna com estados simulados.
- Quatro contas fictícias removidas. Consulta confirmou zero usuários, compras e
  assinaturas remanescentes dos runs desta tarefa. Nenhum usuário real foi alterado.
- Advisors remotos antes/depois: permanecem avisos de SECURITY DEFINER autenticado
  e proteção contra senhas vazadas, e INFO de RLS sem policy. Conferimos grants e
  search_path da RPC alterada: anon/authenticated negados, service_role só na pública.
  Aviso de RPC executável exige revisão da autorização interna, não prova exploração.

Docker instalado, mas daemon Linux indisponível: não rodamos Supabase local completo.
Postgres nativo não substitui Auth/gateway; os testes remotos autorizados complementam
essa lacuna, mas não provam o ensaio completo da atualização de produção.

Reprodução local: `npm run check`, `npm --prefix site run check` e o comando Deno
em `.github/workflows/payment-regression.yml`. Para navegador, disponibilizar
Playwright/Chromium fora das dependências do produto e definir `PLAYWRIGHT_MODULE`
com o caminho absoluto de seu módulo. Compilar o site antes de iniciar o servidor.
Dentro de `site/`, iniciar somente o Worker local:

```text
npx --no-install wrangler dev --config dist/server/wrangler.json --local --ip 127.0.0.1 --port 4186 --var AUTH_CAPTCHA_ENABLED:true --var TURNSTILE_SITE_KEY:fixture-public-key --var KAD_ENV:staging --var SUPABASE_URL:https://npaoyezfwmgauirrlyog.supabase.co --var SUPABASE_PUBLISHABLE_KEY:sb_publishable_fixture
```

Na raiz, rodar `node --no-warnings site/scripts/test-security-browser.mjs` e
`node --no-warnings site/scripts/test-auth-captcha-browser.mjs`. As chaves acima
são fictícias: o teste intercepta o provedor e não comprova autenticação real.
Encerrar o Wrangler antes de reconstruir o site no Windows para liberar os arquivos.
`scripts/test-google-staging.mjs --confirm-staging` exige autorização nova por
execução e chaves de homologação em memória em `KAD_TEST_STAGE_KEYS`; não colocar
essas chaves na linha de comando, em arquivos ou logs. O script recusa outro ref.

## Arquivos alterados

- HTTP do site: `site/server/index.ts`, `site/server/security-headers.ts`,
  `site/wrangler.jsonc`.
- Google/servidor: `supabase/functions/_shared/google-play.ts`,
  `supabase/functions/validate-google-purchase/index.ts`,
  `supabase/migrations/20261009210911_google_play_entitlement_revalidation.sql`.
- Testes: `tests/google-play-billing.test.ts`, `tests/google-play-database.test.ts`,
  `supabase/functions/validate-google-purchase/index.test.ts`,
  `site/tests/security-headers.test.ts`, `site/tests/structure.test.ts`,
  `site/scripts/test-security-browser.mjs`, `scripts/test-google-staging.mjs`.
- CI: `.github/workflows/payment-regression.yml` (inclui o teste Google; não publica).
- Documentação: este arquivo, `docs/ABUSE_PROTECTION.md`, `docs/PRODUCTION_SECURITY.md`.

## O que ainda falta

| Ação | Ambiente/acesso | Risco de adiar | Evidência para concluir |
| --- | --- | --- | --- |
| Worker HTTPS + widget/configuração Turnstile | Homologação Cloudflare; autorização de escrita na conta/recurso | CAPTCHA continua indisponível no site publicado | Rota dedicada, CSP, token real e fluxos Auth validados |
| Testar WebView e clientes antigos | Android/iOS físicos; builds compatíveis | Bloqueio de login ao exigir CAPTCHA | Matriz de dispositivos e versão mínima aprovada |
| Ensaiar 17 migrations desde estado antigo e restaurar backup | Banco descartável completo; autorização se remoto | Deploy parcial, incompatibilidade ou recuperação inviável | Ensaio, pgTAP, RLS e restauração aprovados |
| Revisar Auth/SMTP/MFA/redirects/senhas vazadas | Proprietário Supabase, por ambiente | Abuso de login/envio, recuperação falha | Valores aprovados e testes com contas fictícias |
| Validar Google real e estratégia de revalidação/RTDN | Conta Play/configuração de teste; autorização separada | Estado suspenso pode ficar desatualizado até próxima consulta | Testes de licença e atualização do estado no servidor |
| Promover banco/funções/Worker e HSTS | Produção; backup/janela/autorização explícita | Proteções corrigidas não alcançam usuários atuais | Gates, smoke controlado e monitoramento pós-publicação |

**Veredito:** código pronto para revisão do PR após gates verdes; publicação em
produção ainda não aprovada. Sem aprovação global de segurança ou alegação de que
Cloudflare, Google real e dispositivos já foram homologados.

## Próximos passos, em ordem

1. Revisar PR/CI. Não fazer merge enquanto houver gate de publicação pendente.
2. Autorizar e configurar Worker HTTPS de homologação + widget; validar Turnstile
   real e dispositivos. Interromper se houver erro de Auth/CSP/nonce/host.
3. Ensaiar atualização e recuperação do banco desde o estado de produção; revisar
   avisos remanescentes e versões antigas. Interromper em falha de isolamento ou perda de dados.
4. Aprovar janela/backup, promover migrations e funções, depois site/app e HSTS.
   Ativar CAPTCHA somente após compatibilidade e tokens reais comprovados.
5. Manter Google real bloqueado até concluir sua homologação e política de atualização.

Primeira ação operacional: obter autorização/acesso ao **Worker de homologação**
na conta Cloudflare correta, para testar a página HTTPS sem tocar na produção.

Referências oficiais:
[roteamento Worker-first](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/),
[CSP Turnstile](https://developers.cloudflare.com/turnstile/reference/content-security-policy/),
[CAPTCHA Supabase](https://supabase.com/docs/guides/auth/auth-captcha),
[estados Google](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.subscriptionsv2#SubscriptionState),
[advisory SECURITY DEFINER](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
[senhas vazadas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
