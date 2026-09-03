# Pagamentos: recebimento, repetição e ciclo da assinatura

## Escopo e estado

Base: `8c17497`, main com os PRs #87 e #88. Branch: `codex/payment-webhook-lifecycle`.
Este trabalho usa apenas a homologação `npaoyezfwmgauirrlyog`. Não libera produção.

| Item | Estado nesta revisão | Pendência |
| --- | --- | --- |
| Recebimento | Parcial: entrega original aceita e correlacionada | Repetição original depois da alteração |
| Crédito duplicado | Parcial: testes locais aprovados; teste multissessão no CI | Confirmar CI e repetição original |
| 400 em assinaturas | Parcial | Obter estrutura da entrega histórica; provar ambiente de preapproval quando ausente |
| Ciclo da assinatura | Parcial: testes isolados aprovados | CI e publicação controlada em homologação |

## 1. Entrega original do Mercado Pago

Durante a revisão, o painel do vendedor sandbox passou a mostrar `200 - Entregue`
para `payment.created`, recurso `176996612652`. O painel mantém a data de criação
original, `2026-09-03 07:52:26 UTC`; ela não informa o horário da tentativa aceita.

O banco registra recebimento às `14:50:49.775397 UTC` e processamento às
`14:50:50.642 UTC`, com `processed=true`, `error_code=null` e `live_mode=true`.
A consulta relacionou o recurso ao checkout, ao dono e à assinatura esperados.

| Evidência | Antes | Depois dessa entrega |
| --- | --- | --- |
| Checkouts | 1 | 1 |
| Transações | 1 | 1 |
| Assinaturas | 1 | 1 |
| Eventos | 0 | 1 |
| Fim do Diamond | 2026-10-03 07:52:25 UTC | 2026-10-03 07:52:25 UTC |

A conciliação já havia concedido esse crédito. A entrega não prolongou o período.
Não provocamos nova compra nem alteramos recursos no provedor. O detalhe do
evento continua sem botão de reenvio. Não fabricamos uma repetição assinada.

Conferimos por comparação de hashes, sem revelar valores, que a homologação usa
`ACCOUNT_MODE=test` e `LIVE_MODE=true`. O painel identifica a aplicação
`3495069234464376` como conta de teste e mostra o destino de homologação. A entrega
aceita também comprova a correspondência do segredo usado na validação HMAC.

## 2. Simulação oficial

Não repetimos o simulador. O teste de `11:10:03 UTC`, documentado em
`PAYMENT-WEBHOOK-401-2026-09-03.md`, trouxe `live_mode=false` e recebeu 401.
Esse resultado permanece separado da entrega original aceita.

## Defeitos e mudanças

- O handler consultava a notificação e depois fazia upsert, permitindo que outra
  tentativa apagasse `processed=true`. Agora a RPC obtém uma reserva de dois
  minutos sob bloqueio de linha. Só o token dessa tentativa pode finalizar o
  registro. Falhas liberam a reserva; uma interrupção permite retomada após o prazo.
- Evento concluído retorna `outcome=duplicate`; concorrente retorna 503 `busy`.
  Recurso sem correlação retorna 503 `not_correlated`, mantendo a tentativa
  recuperável. O handler não confirma uma notificação que ainda precisa processar.
- A concessão mantém a chave única do pagamento e o bloqueio transacional.
  Acrescentamos serialização por usuário para pagamentos distintos concorrentes.
  Uma recusa atrasada não sobrescreve um crédito mais recente. Crédito atrasado
  preserva um cancelamento de renovação confirmado depois dele.
- O recurso precisa constar na URL usada no HMAC. Parâmetros conflitantes ou
  divergência com o corpo causam 400. O handler verifica o ID retornado pela API,
  o vendedor da credencial e o tipo da conta antes de aplicar o recurso.
- O parser distingue campo ausente de valor falso nos tópicos de assinatura.
  Para faturas autorizadas, consulta também o pagamento correlacionado e valida
  seu ambiente. Sem prova do ambiente, retorna 401 `environment_unverifiable`.
  Não atribui `true` ou `false` a um campo ausente.
- Os logs antigos `invalid_webhook` não registraram a condição específica.
  Não há prova de qual campo causou cada 400. Os novos diagnósticos registram
  categorias sanitizadas, sem corpo, segredo ou dados pessoais.
- A sincronização recebe `last_modified` do recurso. O banco ignora versões
  anteriores e recusa snapshots conflitantes com o mesmo horário.
- Cancelamento só responde sucesso depois de validar ID, estado e data retornados
  pelo provedor e persistir a sincronização. Timeout mantém o fluxo de falha.
- `get_current_subscription()` calcula expiração no servidor e limita a leitura
  ao usuário autenticado. O site atualiza essa consulta ao recuperar foco ou
  visibilidade, sem sobrescrever uma ação financeira mais recente.

O parser não trata ausência de ambiente como autorização. A documentação consultada
exemplifica o envelope de `payment`, mas não garante o mesmo campo em todos os
tópicos. O recurso documentado de preapproval também não garante `live_mode`.
Esse caso permanece pendente de evidência do provedor. Não afirmamos corrigir
todos os 400 históricos com base apenas em exemplos sintéticos.

## 3. Testes automatizados, dados sintéticos

- Handler real capturado pelo Deno, rede substituída: 11 testes HTTP aprovados.
  Cobertura: 400, 401, 405, pagamento, duplicado, falha e retomada, sem correlação,
  fatura com ambiente resolvido pelo pagamento, preapproval, vendedor/ID incorretos.
- PostgreSQL local PGlite: reserva, expiração de reserva, token antigo, identidade
  conflitante, repetição de pagamento, renovação, pendente, recusado, aprovação
  posterior, ordem, cancelamento, expiração, preço/moeda e isolamento.
- PGlite executa comandos em uma conexão. Não o apresentamos como teste de
  concorrência entre sessões. O workflow `Payment regression` usa PostgreSQL 17
  descartável e 13 conexões sobrepostas para pagamento e notificação.
- Antes das migrações novas, 80 asserções pgTAP passaram na homologação dentro de
  transação com rollback. Nenhuma fixture permaneceu.
- Raiz: 446 testes, tipos e lint aprovados. Site: tipos, testes e build aprovados.
  Verificação Deno das quatro funções financeiras aprovada.

Os testes não substituem um reenvio original aceito. A RPC de leitura protege o
estado exibido; este PR não constitui auditoria de todas as permissões de recursos
premium do aplicativo. O site não foi publicado.

## Publicação e rollback

Antes da publicação, a homologação tinha webhook v13 (`verify_jwt=false`),
checkout v12, cancelamento v11 e conciliação v9 (três com JWT ativo).
Comparação com main: as últimas três funções coincidem; o webhook carregava a
versão antiga do módulo compartilhado de conta/ambiente. Sua lógica de recebimento
coincidia com a base. A nova publicação deve incluir os módulos compartilhados.

Ordem: aplicar as três migrações `20260903160000`, `20260903161000` e
`20260903162000`; verificar os testes SQL; publicar webhook, conciliação e
cancelamento com seus módulos. Não publicar checkout ou site sem necessidade.
Registrar as versões efetivas depois da publicação. CI e publicação ainda pendentes.

Rollback sem apagar dados: restaurar as três funções ao conteúdo da base
`8c17497`, mantendo JWT apenas desabilitado no webhook. Restaurar a definição de
`private.apply_mercado_pago_payment` da migração `20260903014225` se o defeito estiver
na aplicação de crédito. Preservar tabelas, períodos, transações, eventos e as
colunas novas. As RPCs adicionais podem permanecer sem chamadas. Manter
`ACCOUNT_MODE=test` e `LIVE_MODE=true`; não usar a orientação antiga de voltar
LIVE_MODE para false. Não desfazer migração mediante exclusão de dados financeiros.

## Referências consultadas

- [Webhooks: assinatura, tópicos e tentativas](https://www.mercadopago.com.br/developers/pt/docs/subscriptions/additional-content/your-integrations/notifications/webhooks)
- [Particularidades dos tópicos](https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/additional-info)
- [Consulta de assinatura](https://www.mercadopago.com.br/developers/pt/reference/online-payments/subscriptions/get-preapproval/get)
- [Consulta de fatura](https://www.mercadopago.com.br/developers/en/reference/online-payments/subscriptions/get-authorized-payment/get)
- [Testes de banco Supabase](https://supabase.com/docs/guides/database/testing)
