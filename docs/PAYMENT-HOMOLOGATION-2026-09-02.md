# Homologação do checkout web — Mercado Pago

> Relatório histórico do PR #84. A continuação, com publicação em homologação,
> testes reais de PostgreSQL e bloqueios atualizados, está em
> [PAYMENT-HOMOLOGATION-2026-09-03.md](PAYMENT-HOMOLOGATION-2026-09-03.md).

## Resultado desta execução

O código do checkout web e do backend foi concluído sem alterar produção e sem criar
cobrança. A camada automatizada de TypeScript, site, build administrativo e validação
das quatro Edge Functions passou. A homologação integrada não está concluída: faltam
uma sessão autenticada do Supabase CLI, credenciais próprias de teste do Mercado Pago,
comprador/vendedor de teste e uma conta KAD descartável.

O destino canônico local de homologação é o projeto legado `kad-prod`, ref
`npaoyezfwmgauirrlyog`. A produção continua sendo `kad-dev`, ref
`tknxtwwwoqwbzddplzzg`. A tentativa de listar projetos falhou por ausência de
`SUPABASE_ACCESS_TOKEN`; conforme a trava de segurança, nenhum comando remoto de
leitura posterior, deploy ou alteração foi executado.

## Diagnóstico e correções

| Área | Diagnóstico | Correção |
| --- | --- | --- |
| Confirmação atrasada | O retorno dependia somente do webhook e podia ficar pendente | Reconciliação autenticada consulta assinatura e faturas no provedor, com limite de 10 s por sessão |
| Rede do provedor | As chamadas não tinham limite explícito de duração | Timeout de 8 s e categoria segura `provider_unavailable` |
| Polling do navegador | Uma resposta antiga podia atualizar a tela após rota, logout ou troca de conta | Cada resposta confirma checkout, rota e usuário atuais antes de alterar estado |
| Assinatura Platina | A web convertia `platinum` em Básico | Mapeamento estrito dos planos legados e atuais |
| Período vencido | Estado remoto `active` podia permanecer visível depois da data final | Acesso é calculado com `current_period_end` e falha fechado |
| Mensagens | Falha técnica podia parecer pagamento recusado | Estados separados para configuração, indisponibilidade, pendência, recusa, cancelamento, expiração, estorno e chargeback |
| Cancelamento | Falhas eram sempre genéricas | Erros de configuração, loja externa e rate limit agora têm mensagens próprias |
| Webhook irrelevante | Evento assinado fora do contrato ficava eternamente não processado | Tipo válido, mas não suportado, recebe sucesso com `ignored: true` |
| Observabilidade | Logs podiam carregar mensagens internas não estruturadas | Somente operação, categoria, duração e identificadores técnicos validados são registrados |

O catálogo e os preços continuam exclusivos do servidor. A web oferece Diamante nos
três ciclos; Platina continua reconhecido na leitura de assinaturas existentes. O KAD
não recebe dados de cartão e a URL de retorno nunca concede acesso.

## Matriz de cenários

| # | Cenário | Evidência automatizada | Homologação integrada |
| --- | --- | --- | --- |
| 1 | Usuário não autenticado | Funções exigem JWT e usuário; testes de contrato | Bloqueada por credenciais/conta |
| 2 | Plano ou ciclo inválido | Catálogo server-side testado | Bloqueada |
| 3 | Mensal, trimestral e anual | Valores e frequência testados | Bloqueada |
| 4 | Pix aprovado e pendente | Pendência não libera acesso no contrato | Bloqueada pelo sandbox Mercado Pago |
| 5 | Cartão aprovado, recusado e pendente | Estados e mensagens testados | Bloqueada pelo sandbox Mercado Pago |
| 6 | Retorno antes do webhook | Reconciliação autenticada e UI testadas | Bloqueada |
| 7 | Webhook antes do retorno | Leitura posterior usa banco autoritativo | Bloqueada |
| 8 | Replay do mesmo webhook | SQL idempotente e testes versionados | Execução PostgreSQL bloqueada pelo Docker |
| 9 | Eventos fora de ordem | Regras terminais e testes versionados | Execução PostgreSQL bloqueada pelo Docker |
| 10 | Pagamento inicialmente sem correlação | Evento permanece para nova tentativa | Bloqueada |
| 11 | Preço ou moeda divergente | Parser estrito e RPC recusam divergência | Execução PostgreSQL bloqueada pelo Docker |
| 12 | Cancelamento da renovação | Código preserva `current_period_end` | Bloqueada |
| 13 | Estorno e chargeback | Regras e testes SQL versionados | Execução PostgreSQL bloqueada pelo Docker |
| 14 | Timeout e rate limit | Timeout, categorias e limites testados | Bloqueada |
| 15 | Dados financeiros de outro usuário | RLS/RPC e testes SQL versionados | Execução PostgreSQL bloqueada pelo Docker |
| 16 | Novo login após alteração | Mapeamento remoto e expiração testados | Bloqueada |

## Validações locais

- Testes automatizados do repositório: aprovados.
- Typecheck e lint do aplicativo: aprovados.
- Typecheck, testes e build do site: aprovados.
- Build do painel administrativo: aprovado; permanece apenas o aviso pré-existente de
  chunk maior que 500 kB.
- `deno check` nas funções `create-payment-checkout`, `cancel-subscription`,
  `mercado-pago-webhook` e `reconcile-payment-checkout`: aprovado.
- Testes pgTAP/Supabase: não executados. O executável Docker existe, mas o daemon não
  está em execução.
- Auditoria do `npm`: informa vulnerabilidades transitivas já presentes nas árvores de
  dependências; nenhuma correção forçada foi aplicada neste PR para evitar upgrades
  fora do escopo.

## Como desbloquear a homologação

1. Fazer login local no Supabase CLI com uma credencial administrativa de curta duração:
   `npx supabase login`. Não enviar o token no chat, em arquivo versionado ou no PR.
2. Executar `npx supabase projects list --output json` e parar se o projeto de
   homologação não tiver exatamente o ref `npaoyezfwmgauirrlyog`.
3. No painel desse projeto, cadastrar credenciais exclusivas do vendedor de teste e
   verificar apenas a presença de `MERCADO_PAGO_ACCESS_TOKEN`,
   `MERCADO_PAGO_WEBHOOK_SECRET`, `MERCADO_PAGO_LIVE_MODE=false`,
   `MERCADO_PAGO_TEST_PAYER_EMAIL`, `KAD_WEB_APP_URL` e `ALLOWED_WEB_ORIGINS`.
4. Iniciar o Docker Desktop e executar `npx supabase test db` localmente.
5. Aplicar primeiro a migration em homologação e publicar as quatro funções listadas
   abaixo. Não usar `--project-ref` diferente do ref confirmado.
6. Criar comprador e vendedor de teste no Mercado Pago, no mesmo país, e uma conta KAD
   descartável.
7. Executar os 16 cenários e registrar somente ids técnicos, estados e contagens. Não
   registrar e-mail, token, dados de cartão nem payload integral.

## Plano de publicação e rollback

### Antes de qualquer deploy

1. Obter autorização humana e confirmar backup recente do banco de destino.
2. Confirmar novamente o project ref. Para produção, exigir autorização separada e o
   ref exato `tknxtwwwoqwbzddplzzg`.
3. Revisar migrations pendentes; esta entrega adiciona
   `20260902150000_payment_checkout_reconciliation.sql`.
4. Confirmar os seis segredos do ambiente sem exibir valores.

### Funções e JWT

| Função | JWT | Observação |
| --- | --- | --- |
| `create-payment-checkout` | obrigatório | Cria/reutiliza checkout autenticado |
| `cancel-subscription` | obrigatório | Cancela somente a renovação do usuário |
| `reconcile-payment-checkout` | obrigatório | Consulta pendência do checkout pertencente ao usuário |
| `mercado-pago-webhook` | desativado na borda | Valida HMAC do Mercado Pago dentro da função |

Depois do deploy, executar uma verificação sem cobrança: CORS, 401 sem JWT, rejeição de
plano inválido, rejeição de webhook sem HMAC e leitura isolada do checkout. Somente
depois disso usar comprador de teste.

Rollback de código: republicar as versões do commit anterior das quatro funções e
reimplantar o site anterior. A migration é aditiva; a coluna nova pode permanecer sem
uso. Se for indispensável remover a RPC, primeiro revogar a execução e confirmar que
nenhuma função publicada ainda a chama. Nunca apagar transações, assinaturas, sessões
ou eventos financeiros durante rollback.

## Critério para marcar homologação como aprovada

A homologação só pode mudar de “bloqueada” para “aprovada” quando o Docker/pgTAP passar,
os 16 cenários integrados forem executados no ref de homologação confirmado, as
contagens idempotentes forem verificadas e nenhuma cobrança real tiver sido usada.
