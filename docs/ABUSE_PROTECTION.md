# Proteção contra abuso — implementação e ativação

Base auditada: `f5b94c32f0bd66ad542911a05392a95bdc8f636f` (`main`, 2026-10-08).
Branch: `codex/abuse-protection`. Nenhuma migration, configuração ou função remota
foi alterada nesta tarefa. Não confundir este código com proteção já publicada.

## Cobertura auditada

| Operação | Identidade exigida | Limite no código | Lacuna / prioridade restante |
| --- | --- | --- | --- |
| Criar checkout | JWT validado; RPC interna `service_role` | Existente: 5/15 min/usuário + 10 s entre tentativas + lease | Preservado; confirmar migrations implantadas, P1 |
| Reconciliar checkout | JWT + proprietário; RPC interna | Existente: 10 s/checkout | Preservado; não é uma cota global de consultas, P2 |
| Feedback | `auth.uid()` no RPC | Existente: 5 mensagens/hora/usuário; 3–2.000 caracteres | Preservado, inclusive chamada direta; confirmar implantação, P2 |
| Login | Supabase Auth; usuário ainda não autenticado | Limites nativos do Auth; CAPTCHA preparado | Valores efetivos não consultados nesta tarefa; ativação manual, P1 |
| Cadastro | Supabase Auth; público | Limites nativos + confirmação; CAPTCHA preparado | SMTP, CAPTCHA e política de cadastro devem ser verificados, P1 |
| Recuperação / reenvio | Supabase Auth; público | Limites nativos de envio; cooldown da recuperação web preservado | CAPTCHA preparado; revisar cotas por destinatário/IP no painel, P1 |
| Verificar OTP / renovar sessão | Supabase Auth | Limites nativos; sem proxy adicional | Conferir cotas no projeto; não colocar desafio em auto-refresh, P1 |
| Validar Google Play | `getUser()`; nunca `userId` do corpo | **Novo: 30/5 min/usuário** | Sem limite confiável por IP; Google real não testado, P1 |
| Cancelar renovação | `getUser()` + assinatura do usuário | **Novo: 5/15 min/usuário** | Confirmar funcionamento no ambiente completo, P1 |
| Excluir conta | `getUser()` + senha atual confirmada no Auth | **Novo: 5/15 min/usuário**; token CAPTCHA na confirmação da senha | Conferir JWT do gateway publicado e Auth real, P1 |
| `sync_essay_document`, `sync_simulation_session`, `record_question_attempt` | `auth.uid()`; dados próprios | Sem cota temporal; validações e sincronização existentes | Não impor throttling genérico no autosave; medir antes de limitar, P2 |
| `record_level_activity`, `set_ranking_opt_in` | `auth.uid()` | Idempotência/validação; evento de nível limitado a 64 KiB | Idempotência não limita frequência; medir custo, P2 |
| `get_ranking` | Autenticado | Página de até 100; sem cota temporal | Agregação/offset podem custar caro; medir e planejar cota, P2 |
| `question_community_accuracy` | Autenticado | 1–100 IDs/chamada; sem cota temporal | Agregação ainda pode ser repetida, P2 |
| `is_username_available` | Público (`anon`) | Formato 3–24 caracteres; consulta sem cota temporal | Username é público; tabela permite leitura dessa coluna, então limitar só RPC não basta, P2 |
| Leituras de assinatura / checkout | Autenticado + proprietário | Sem cota temporal; leitura não chama provedor | Não confundir polling de estado com reconciliação; monitorar, P2 |
| `admin_*` | Autenticado + permissão administrativa interna | Sem cota temporal geral | MFA administrativo e controle operacional; fora da interface pública, P2 |
| Tabelas de estudo, favoritos, flashcards, comentários e Storage | RLS/permissões específicas | Sem rate limit geral por usuário | RLS não impede excesso autorizado; inventariar tráfego antes de alterar, P2 |

Evidências: migrations `20260812024756`, `20260902150000`, `20260816010000`,
`202610080001`; chamadas em `lib/`, `providers/` e `site/src/services/supabase.ts`.
Os limites novos priorizam ações raras que chamam serviços externos. A cota maior
do Google acomoda restaurações e eventos repetidos da loja sem permitir chamadas
ilimitadas. Janela fixa, não deslizante: pode haver duas cotas próximas da virada.
Valores são padrões iniciais, não resultado de benchmark de produção.

## Arquitetura e caminhos alternativos

1. A Edge Function verifica a identidade com Supabase Auth.
2. Rejeita entrada inválida e chama `consume_abuse_limit` com o UUID validado.
3. O Postgres serializa por usuário/operação com advisory lock e lock da linha.
4. Apenas se permitido, chama Google, Mercado Pago ou confirmação de senha.
5. O resultado financeiro continua passando pelos RPCs existentes.

`consume_abuse_limit` só aceita `service_role`. As tabelas em `private` têm RLS e
nenhum acesso direto das roles de cliente, nem da própria `service_role`.
Essa role executa a função restrita; os clientes não escolhem cota, relógio ou
identidade. A função não concede assinatura nem exclui usuário.

Não existe rota pública alternativa para `apply_google_play_purchase` ou
`sync_mercado_pago_subscription`: os grants do backend continuam exclusivos.
Escrita financeira direta permanece negada; exclusão administrativa continua
exigindo segredo do servidor. Os testes de banco verificam acesso direto a
RPC/contadores; os testes HTTP chamam os handlers sem passar pela interface.
Isso **não substitui** teste do gateway/Auth/PostgREST completos.

Falhas do provedor e de confirmação de senha consomem tentativa. O contador é
confirmado em uma transação separada antes da operação custosa, portanto o erro
posterior não devolve a cota. Uma resposta ambígua pode consumir tentativa sem
executar o provedor; isso é preferível a liberar uma operação desprotegida.

- Esgotamento: HTTP **429**, `code=rate_limited`, `Retry-After` em segundos.
- RPC ausente, timeout, resposta inválida ou erro do contador: **503**,
  `code=abuse_protection_unavailable`, `Retry-After: 30`. Não prossegue.
- Clientes mostram mensagem e não fazem retry automático. A restauração Google
  interrompe em 429/503, preserva resultados confirmados e deixa as demais
  compras sem `finish`, disponíveis para nova tentativa explícita.
- Checkout/reconciliação/feedback mantêm os contratos existentes, inclusive
  exceção SQL `P0001` do feedback; não foram convertidos para outro protocolo.

### Configuração e retenção

`private.abuse_limit_policies` armazena `max_attempts` (1–1.000) e
`window_seconds` (10–86.400), por operação. Somente administração do banco pode
alterar. Planejar mudanças de janela e validar em ambiente descartável antes do
rollout; os clientes não podem fornecer esses valores. Reaplicar a migration
não redefine políticas já configuradas nem zera tentativas.

Há no máximo três contadores por usuário existente, com FK e exclusão em cascata
ao remover a conta. Expiram ao final da janela + 24 horas. Cada consumo remove
até 32 linhas expiradas, com `SKIP LOCKED`. É retenção oportunista: em ausência de
tráfego, linhas expiradas permanecem inativas. Para uma exigência de remoção em
horário fixo, um administrador pode agendar a função privada de limpeza com o
agendador já disponível, após aprovação; nada foi agendado nesta tarefa.
Não armazenamos IP, token de compra, senha, JWT nem corpo no contador.

O consumo bloqueia e atualiza seu próprio contador **antes** da limpeza. Nenhum
novo bloqueio de linha ocorre depois dela. Isso evita que duas limpezas em lotes
removam os contadores uma da outra e travem os inserts seguintes. O relógio é
consultado novamente após obter o bloqueio da linha, inclusive se houve espera.

## IP e Cloudflare

Não foi comprovada uma cadeia de proxies confiáveis até as Edge Functions.
Por isso **não usamos** `X-Forwarded-For` ou `CF-Connecting-IP` enviados ao
Supabase como identidade: qualquer cliente pode forjá-los acessando a origem
diretamente. O limite autenticado independe deles.

Recomendações manuais, sem mudança na conta Cloudflare:

- Revisar WAF/bots e limites do domínio do site com observação antes do bloqueio.
- Não desafiar arquivos estáticos, callbacks de autenticação/pagamento ou o
  carregamento de `/auth/captcha`; evitar loops de desafios.
- Configurar hosts exatos do widget Turnstile e métricas de erros no painel.
- Conferir política de preview/build antes de qualquer push. Nesta tarefa o
  responsável confirmou que publicação ocorre somente após merge na `main`.
- O navegador e o app acessam `*.supabase.co/auth/v1`, `/rest/v1`, `/functions/v1`
  e Storage diretamente. **Essas chamadas não passam pelo domínio Cloudflare do
  site**. Regras nesse domínio não protegem o Supabase contra acesso direto.
- Um limite por IP próprio exigiria gateway autenticado com origem fechada e
  sobrescrita dos cabeçalhos; isso não foi introduzido nem é pré-requisito para
  os limites por usuário desta mudança. Auth usa suas proteções nativas.

## CAPTCHA: configuração e ordem de ativação

Usamos Turnstile; somente Supabase Auth valida o token. Não há solver, token
aceito localmente como autenticação, chave secreta no cliente ou aprovação
simulada em produção.

| Local | Configuração | Natureza |
| --- | --- | --- |
| Worker do site | `AUTH_CAPTCHA_ENABLED=true` | Flag pública de rollout; padrão `false` |
| Worker do site | `TURNSTILE_SITE_KEY` | Chave **pública** do widget; nunca o secret |
| Build do app | `EXPO_PUBLIC_AUTH_CAPTCHA_ENABLED=true` | Flag pública; ausente/false mantém compatibilidade |
| Build do app | `EXPO_PUBLIC_AUTH_CAPTCHA_URL=https://kadconcursos.com.br/auth/captcha` | Página HTTPS, sem query, credencial ou fragmento configurados |
| Painel Supabase Auth | Provider Turnstile + secret do widget | **Segredo somente no servidor/painel**, nunca em `EXPO_PUBLIC_*`/`VITE_*` |

`/api/public-config` expõe apenas a flag adicional. `/auth/captcha` entrega página
dedicada, sem cache, sem indexação, com CSP por nonce e destinos limitados à
Cloudflare. A chave pública é validada antes de entrar no HTML. Configuração
inválida não libera o fluxo quando a flag está ativa.

Site: diálogo acessível com iframe do mesmo domínio. App: `react-native-webview`
**13.15.0**, compatível com Expo SDK54, autorizado pelo responsável; não exige
conta Google Play para implementar. O bundle Android local foi gerado, mas isso
não prova funcionamento em aparelho. Será necessário build compatível com a
dependência nativa, não apenas atualizar JavaScript de um binário antigo.

O bridge valida origem/página, emissor e nonce de correlação. Token só fica na
memória da tentativa. Expiração, erro, cancelamento e timeout (125 s) encerram o
desafio; o próximo clique cria outro. Site e app enviam `captchaToken` no login,
cadastro, recuperação, reenvio e confirmação de senha para exclusão. OTP,
troca de senha autenticada e renovação de sessão conservam contratos existentes.
Expo web usa iframe apenas se a página do desafio estiver no mesmo domínio;
caso contrário informa configuração incompatível. O KAD Site é o frontend web
oficial e já atende esse requisito.

No app, a conclusão também confere o nonce da tentativa ainda pendente. Eventos
ou timers atrasados de uma WebView fechada não encerram nem entregam token à
tentativa seguinte.

Ordem futura, **não executada**:

1. Reconciliar migrations pendentes conforme `PRODUCTION_SECURITY.md`; obter
   aprovação para ambiente remoto e identificar o projeto exato.
2. Aplicar migration e publicar funções em ambiente de homologação autorizado.
   Confirmar JWT do gateway, grants, RLS e teste de acesso direto.
3. Criar widget Turnstile para o host HTTPS exato; secret somente no Supabase.
   Preparar/publicar página do desafio, mantendo exigência do Auth desativada.
4. Distribuir ambos os clientes compatíveis, ativar as flags e testar token real
   no navegador e em Android/iOS. Validar também nova tentativa e acessibilidade.
5. Só então ativar CAPTCHA no Supabase. Builds antigos sem token deixarão de
   autenticar: definir atualização mínima/plano de migração antes da ativação.
6. Conferir limites reais do Auth, confirmação de e-mail, validade de OTP,
   SMTP com SPF/DKIM/DMARC, proteção de senhas vazadas e MFA administrativo.
   Registrar valores aprovados do painel; não inventar valores já ativos.

## Consumo e registros

| Rota | Corpo HTTP máximo | Campos relevantes |
| --- | --- | --- |
| Google | 16 KiB | Token até 4.096 caracteres; produto do catálogo existente |
| Cancelamento | 1 KiB | Corpo vazio permitido; nenhuma identidade aceita dele |
| Exclusão | 24 KiB | Senha até 4.096 caracteres; CAPTCHA até 2.048 |

Leitura efetiva de streams, inclusive chunked e `Content-Length` falso; 5 s para
ler o corpo. Respostas externas nas rotas alteradas: teto de 1 MiB e timeout de
8 s incluindo corpo. Cancelamento injeta fetch limitado no helper já existente,
sem mudar os demais consumidores. Sem retries adicionais/loops automáticos.
Autenticação deve ocorrer antes de obter uma cota por usuário; a consulta
`getUser()` prévia não está coberta por esse contador, e depende dos limites Auth.

Eventos novos: `event=abuse_protection`, `operation`, `reason`, `requestId` e `at`.
Bloqueios expõem correlação também em `X-Request-ID`/JSON; CORS libera leitura de
`Retry-After`. Nunca anexar erro bruto, corpo, senha, IP, e-mail, cookie, JWT ou
token da compra. Os testes verificam que marcadores sensíveis não aparecem.

No Logs Explorer já disponível: filtrar evento, agrupar contagem por operação e
motivo em janelas de 5 minutos. Picos de `rate_limited` sugerem repetição/abuso;
`limiter_unavailable` indica RPC/grants/banco/rede, não abuso do usuário. Usar o
`requestId` para investigação; não copiar payloads. Não foi contratado serviço
nem configurado alerta remoto. Conferir a política de retenção/redação de logs
da plataforma antes de ativar captura adicional de requisições.

## Rollback sem apagar dados

- Se houver problema no limitador, suspender as três operações (revogar apenas
  EXECUTE de `consume_abuse_limit(uuid,text)` de `service_role`). As versões novas
  retornam 503. Não voltar a um handler antigo sem proteção para contornar erro.
- Corrigir em homologação e restaurar o grant/migration; não apagar contadores,
  assinaturas, usuários ou histórico. Reaplicação preserva política/cota.
- Rollback do CAPTCHA exige coordenar Auth e clientes: desativar a exigência do
  Auth **antes** de distribuir um cliente sem token, somente com aprovação do
  responsável e controles compensatórios. Desligar só a flag do cliente com
  Auth exigindo CAPTCHA bloquearia login. Preferir corrigir a configuração.

## Evidências e limites da validação

Somente contas fictícias, clocks/serviços simulados e banco local foram usados.

- `npm run check`: **514 testes aprovados**, tipos e lint aprovados.
- `npm --prefix site run check`: **121 testes aprovados**, tipos e build aprovados.
- Deno: **41 testes aprovados** em `_shared/abuse-protection.test.ts`, `abuse-http.test.ts`, testes existentes
  de webhook/cancelamento; executar `deno test --allow-env` nesses quatro arquivos.
- `scripts/test-abuse-concurrency.mjs`: exige `PGHOST=127.0.0.1`, banco vazio
  `PGDATABASE=kad_abuse_test`, sem `PGSERVICE`. Confere endereço do servidor antes
  de escrever. Na CI confere também o ID, imagem e binding loopback do contêiner
  Docker criado pelo job, porque o servidor informa o IP interno após NAT; não
  aceita um IP esperado arbitrário. `psql` na CI; opcional `PG_TEST_DRIVER` aponta para módulo `pg`
  instalado externamente (não incluído no app).
- PostgreSQL nativo **18.4**, somente `127.0.0.1:55439`, confirmou **24 conexões =
  5 permitidas + 19 negadas**, usuários separados, janela expirada, reaplicação
  e negação de acesso direto. CI usa PostgreSQL17 e repete o teste em banco próprio.
- Revisão adicional em PostgreSQL18.4, `127.0.0.1:55440`, banco descartável vazio:
  dois lotes concorrentes com 64 contadores expirados reproduziram `40P01`
  (`deadlock detected`) antes da correção. Depois, ambas as requisições passaram,
  mantendo as duas tentativas novas. O teste usa uma pausa somente em trigger de
  fixture e também está no script de concorrência da CI. Migration ainda não
  publicada: a correção altera o arquivo deste PR, sem mudança remota.
- Callback/timer antigo do CAPTCHA reproduziu encerramento indevido da tentativa
  seguinte antes da correção; a regressão passa após vincular a conclusão ao nonce.
  Testes do serviço web agora executam os cinco fluxos reais com Auth simulado,
  flag desativada, desafio cancelado e troca de conta antes da exclusão.
- Advisors executados **apenas nessa base de fixtures**, não nos projetos remotos:
  segurança retornou dois INFO de RLS sem policies nas tabelas privadas
  (negação intencional de acesso direto) e um WARN de `search_path` no helper
  fictício `private.set_updated_at` de `tests/helpers/payment-database.ts`, que
  não é criado pela migration deste PR. Performance não retornou WARN/ERROR.
  Isso não constitui auditoria do schema completo nem do Supabase hospedado.
- PGlite complementa permissões/retenção e regressão de checkout, reconciliação
  e feedback. Fixtures HTTP provam que bloqueio não chama o provedor custoso.
- `site/scripts/test-auth-captcha-browser.mjs`: Playwright externo via
  `PLAYWRIGHT_MODULE` (arquivo do módulo), `BROWSER_EXECUTABLE` opcional. Testa
  diálogo real + página real, widget simulado, mensagens forjadas, expiração,
  cancelamento, timeout, nova tentativa e limpeza. Toda rede externa bloqueada.
- `expo export --platform android` com dotenv desativado: bundle local; não APK,
  instalação ou publicação. Inspeção de segredos é complementar, não certificação.
  Bundle legível Android (`--no-bytecode`) e arquivos web gerados não apresentaram
  padrões de chave privada, `sb_secret_` com material de chave ou JWT completo.
  O marcador literal `sb_secret_` faz parte do SDK Supabase; strings adjacentes do
  bytecode Hermes geraram um alerta que não se reproduziu no JavaScript legível.

**Bloqueados/não comprovados:** Supabase completo (Docker indisponível), Auth e
Turnstile reais, SMTP real, WebView em dispositivo Android/iOS e configurações
Cloudflare/Supabase remotas. Mocks não demonstram que um token real é aceito pelo
provedor. Não declarar aprovação completa para ativação em produção.

O `npm ci` da CI também informou 52 avisos de vulnerabilidade nas dependências
(19 moderados, 32 altos, 1 crítico), sem triagem de alcançabilidade nesta tarefa.
Não representam 52 falhas confirmadas do produto; exigem análise separada antes
de uma aprovação global de segurança. Não foram feitas atualizações em massa.

Pendência separada encontrada na base: `_shared/google-play.ts` ainda permite
acesso para ON_HOLD/PAUSED e usa fallback ativo para estado desconhecido. Não
pressupor incorporação das correções do PR109; este trabalho não altera regras
de assinatura. Revisar essa correção separadamente antes de habilitar Google Play.

Referências: [Supabase Auth rate limits](https://supabase.com/docs/guides/auth/rate-limits),
[Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha),
[Turnstile mobile](https://developers.cloudflare.com/turnstile/get-started/mobile-implementation/),
[WebView Expo54](https://docs.expo.dev/versions/v54.0.0/sdk/webview/).
