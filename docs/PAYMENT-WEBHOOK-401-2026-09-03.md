# Webhook Mercado Pago: divergência de ambiente

## Diagnóstico comprovado

Escopo exclusivo: Supabase de homologação `npaoyezfwmgauirrlyog`.
Base: `main` com o PR #87 integrado (`7406f98`).

O registro da função `mercado-pago-webhook` v11 mostrou
`category=unexpected_environment` e `eventType=payment`. No código publicado,
essa categoria ocorre depois da aprovação da assinatura HMAC e retorna HTTP 401.
Os registros separados de `invalid_webhook` retornam 400 e não comprovam a mesma
causa; continuam pendentes de análise do contrato dos eventos de Assinaturas.

Uma consulta administrativa, somente de leitura, foi executada diretamente contra
`GET /v1/payments/{id}`, `GET /preapproval/{id}` e `GET /users/me`, usando a
credencial já armazenada na homologação. Apenas o resultado sanitizado foi exibido:

- configuração anterior `MERCADO_PAGO_LIVE_MODE=false`;
- pagamento aprovado existente com `live_mode=true`;
- identificadores consultados iguais aos recursos esperados;
- vendedor do pagamento, da assinatura e da credencial iguais ao vendedor sandbox;
- conta da credencial identificada pela API como `test_user`;
- aplicação da assinatura igual à aplicação do vendedor sandbox;
- referências externas do pagamento e da assinatura iguais.

A função temporária de auditoria exigiu JWT validado pelo gateway e autorização
`service_role` do próprio projeto. Foi removida imediatamente após a consulta,
incluindo seu arquivo local. Nenhuma credencial ou resposta completa foi armazenada.
Não houve alteração dos recursos do Mercado Pago ou das tabelas financeiras.

## Correção

Separar dois conceitos anteriormente acoplados:

- `MERCADO_PAGO_ACCOUNT_MODE=test`: exige comprador `testuser.com` e permite HTTP
  somente em loopback para desenvolvimento local.
- `MERCADO_PAGO_LIVE_MODE=true`: exige esse valor exato no webhook, conforme a
  consulta do recurso. Eventos `live_mode=false` continuam recusados com 401.

`production` exige `live_mode=true` e retorno HTTPS, inclusive em loopback. Valores
ausentes, desconhecidos ou ambíguos falham fechados. O HMAC, JWT das funções de
usuário, RLS, correlação, preço, moeda e regras de crédito permanecem inalterados.

## Verificação e limites

Contagens antes e depois da configuração e das sondagens negativas: 1 checkout,
1 transação, 1 assinatura, 0 eventos. O período permanece até
`2026-10-03T07:52:25Z`, sem nova concessão de crédito.

Verificações executadas:

- `npm run check`: 443 testes, typecheck e lint aprovados;
- `npm --prefix site run check`: 70 testes, typecheck e build aprovados;
- verificação Deno das quatro funções financeiras aprovada;
- 3 testes Deno do handler real: HTTP 400 para corpo inválido, 401 para HMAC
  inválido e 401 para evento corretamente assinado de ambiente divergente;
- 80 asserções pgTAP do arquivo de segurança financeiro em transação com rollback,
  incluindo isolamento entre usuários, RLS, preço/moeda/correlação e idempotência;
  zero usuários sintéticos restantes após o teste;
- sondagens no endpoint de homologação: corpo inválido HTTP 400 e assinatura
  inválida HTTP 401, sem identificadores de pagamentos reais.

O coletor temporário das asserções pgTAP só concedeu INSERT nos próprios resultados
de teste aos papéis usados na simulação; tabela, permissões e fixtures foram
desfeitas pelo rollback. Nenhuma permissão financeira foi alterada.

O CI `Qualidade` do commit `2d44c28` foi concluído com sucesso (execução 198).
Ainda é obrigatório comprovar a entrega oficial 2xx e seu segundo reenvio idempotente
e comparar novamente contagens e período.
Testes locais ou diagnóstico da API não substituem essa evidência.

## Simulação oficial autorizada — 03/09/2026, 11:10:03 UTC

Após login na conta vendedora de teste, o painel confirmou a aplicação sandbox
esperada. O detalhe do evento histórico mostrava 401 e não oferecia uma ação de
reenvio. O usuário autorizou separadamente o uso de **Simular notificação**; esse
teste não é apresentado como reenvio da entrega histórica.

Foi enviada uma única simulação de `payment` com o identificador do pagamento
já aprovado, exclusivamente para o endpoint de homologação
`https://npaoyezfwmgauirrlyog.supabase.co/functions/v1/mercado-pago-webhook`.
O seletor do painel chama esse destino de **URL de produção**, mas o projeto
Supabase é o de homologação autorizado. Nenhuma configuração foi salva no painel.

Evidências sanitizadas:

- o simulador exibiu `live_mode: false` no corpo gerado, mesmo com esse destino;
- a resposta exibida foi `401 - Unauthorized`;
- a invocação do Supabase confirmou HTTP 401 às `11:10:03 UTC`;
- o log da função às `08:10:03` no fuso local mostrou
  `category=unexpected_environment`, `eventType=payment`, `durationMs=2`;
- como a verificação de ambiente ocorre depois do HMAC, a assinatura passou;
- depois do teste: 1 checkout, 1 transação, 1 assinatura, 0 eventos de webhook;
- o período Diamond continua em `2026-10-03T07:52:25Z`, sem novo crédito.

O `false` enviado pelo simulador não equivale ao `true` do pagamento consultado
diretamente na API. Não houve troca de segredo, mudança do ambiente esperado,
aceitação dos dois ambientes nem segunda simulação para forçar uma resposta 2xx.
Esse resultado comprova a recusa de um evento assinado de ambiente divergente,
não a homologação positiva da compra existente.

Permanece necessária uma nova entrega do evento original pelo provedor, por
tentativa automática ou mecanismo de reenvio confirmado pelo suporte do Mercado
Pago. Um contato com suporte depende de autorização específica; nenhuma mensagem
foi enviada. O PR permanece em rascunho e não está liberado para produção.

Referência: [simulador oficial de notificações](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/payment-notifications).

## Publicação e rollback

Aplicado nessa ordem: cadastro de `MERCADO_PAGO_ACCOUNT_MODE=test`, publicação somente
de `create-payment-checkout` e ajuste de `MERCADO_PAGO_LIVE_MODE=true`. A configuração
do webhook continua com JWT de gateway desabilitado e HMAC próprio obrigatório;
nenhuma outra função perde a validação JWT.

A listagem após a atualização dos segredos informa `create-payment-checkout` v12,
`mercado-pago-webhook` v13, `cancel-subscription` v11 e
`reconcile-payment-checkout` v9. A alteração de segredos também incrementa versões
sem alterar o conteúdo. Somente o código do checkout foi republicado; o webhook
mantém o conteúdo com diagnóstico do PR #87. JWT continua ativo nas três funções
de usuário. A função temporária de auditoria não está mais publicada.

Rollback: antes de voltar ao checkout anterior, restaurar `MERCADO_PAGO_LIVE_MODE=false`.
Isso volta a rejeitar o webhook conhecido, mas mantém as proteções do checkout antigo.
Restaurar o código anterior de `create-payment-checkout`; o novo modo de conta pode
permanecer sem uso. Não excluir nem alterar registros financeiros para fazer rollback.

Não publicar o site, não fazer merge e não acessar produção. Antes da promoção,
substituir todas as credenciais usadas na homologação, concluir os cenários pendentes
e obter revisão humana.

Referência oficial: [consulta de assinatura e identificação de aplicação/vendedor](https://www.mercadopago.com.br/developers/en/reference/online-payments/subscriptions/get-preapproval/get).
