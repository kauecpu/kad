# Pagamentos e assinaturas

## Escopo desta entrega

A integração de checkout web está implementada, mas a compra sandbox ainda não foi
homologada de ponta a ponta. O preço e o período são definidos exclusivamente no
backend; o aplicativo nunca envia o valor a ser cobrado. O Mercado Pago hospeda a
coleta do meio de pagamento, então o KAD não recebe nem armazena dados completos do
cartão. A disponibilidade de Pix depende da modalidade de Assinaturas e do ambiente;
não tratá-la como comprovada antes do teste com o provedor.

Os aplicativos Android e iOS não abrem o checkout web. Compras de conteúdo digital
dentro dos apps precisam ser implementadas com Google Play Billing e Apple In-App
Purchase antes da publicação nas lojas.

## Fluxo

1. O usuário autenticado escolhe mensal, trimestral ou anual na web.
2. `create-payment-checkout` valida a conta, escolhe o preço no catálogo do servidor e
   cria uma assinatura pendente no Mercado Pago.
3. A web redireciona para uma URL HTTPS validada do Mercado Pago.
4. O webhook valida a assinatura HMAC, consulta o recurso diretamente na API do
   provedor e confere correlação, preço e moeda.
5. Uma função transacional e idempotente registra o pagamento e libera ou estende o
   período da assinatura.
6. Se o webhook demorar, `reconcile-payment-checkout` permite que o próprio usuário
   autenticado solicite uma consulta limitada ao provedor. A função valida novamente
   assinatura, referência, preço e moeda antes de aplicar qualquer mudança.
7. O app lê somente a linha de `subscriptions` pertencente ao usuário. Cancelar encerra
   cobranças futuras e mantém o acesso até o fim do período pago.

Eventos repetidos não estendem o acesso duas vezes. Pagamentos rejeitados, estornados
ou contestados atualizam o estado sem confiar nos dados enviados pelo navegador.

O retorno da web consulta `get_payment_checkout_status` com o usuário autenticado. A
URL do navegador contém somente o UUID da tentativa e nunca libera acesso. A sessão
guarda uma categoria sanitizada em `status_reason`, permitindo distinguir falha de
configuração, credencial recusada, erro do provedor e pagamento recusado sem persistir
respostas, e-mails ou segredos.

## Configuração do Supabase

Confira o histórico antes de aplicar migrations financeiras pendentes, inclusive
`20260902150000_payment_checkout_reconciliation.sql`,
`20260903014225_payment_atomic_status_reason.sql` e
`20260903043158_payment_legacy_terminal_compatibility.sql`.
Não reaplique versões antigas sobre funções mais novas. As Edge Functions são:

```text
create-payment-checkout
cancel-subscription
mercado-pago-webhook
reconcile-payment-checkout
```

O arquivo `supabase/config.toml` desativa a validação JWT apenas para o webhook. As três
funções chamadas pelo site continuam autenticando o usuário e nunca expõem a chave
`service_role`.

Todas as chamadas à API do Mercado Pago possuem timeout. Falha temporária não aprova
checkout e aparece na web como estado consultável novamente. A reconciliação manual
possui intervalo mínimo por sessão no banco para impedir abuso e cliques repetidos.

Cadastre os segredos abaixo no projeto Supabase, sem colocá-los em `.env`, commits,
logs ou Pull Requests:

```text
MERCADO_PAGO_ACCESS_TOKEN=<credencial privada do ambiente>
MERCADO_PAGO_WEBHOOK_SECRET=<assinatura secreta do webhook>
MERCADO_PAGO_LIVE_MODE=false
MERCADO_PAGO_TEST_PAYER_EMAIL=test_user_...@testuser.com
KAD_WEB_APP_URL=https://app.exemplo.com
ALLOWED_WEB_ORIGINS=https://app.exemplo.com
```

Em produção, altere `MERCADO_PAGO_LIVE_MODE` para `true`. `KAD_WEB_APP_URL` precisa usar
HTTPS. `ALLOWED_WEB_ORIGINS` aceita uma lista separada por vírgulas quando houver mais de
uma origem oficial.

Somente com `MERCADO_PAGO_LIVE_MODE=false`, o código aceita retorno HTTP em
loopback para testes locais. Isso não comprova que o Mercado Pago aceita a URL:
essa exigência deve ser verificada no checkout sandbox. Nunca publique a prévia
em produção para contornar a falta de um endereço HTTPS de homologação.

As ações manuais do site (consultar, cancelar e iniciar checkout) são vinculadas
à conta, rota e tentativa que as iniciaram. Logout, troca de conta, navegação,
retry e timeout invalidam respostas antigas; mutações usam a sessão capturada do
proprietário, ainda verificada pelo backend. Timeout não desfaz uma requisição já
recebida pelo servidor: consulte a assinatura antes de repetir uma operação.

A compatibilidade de registros legados recupera motivos ausentes somente quando
as transações correlacionadas comprovam estorno ou contestação sem ambiguidade.
Não altera transações, períodos pagos ou regras de crédito; casos com motivos
mistos ou outro crédito válido permanecem sem inferência automática.

Em homologação, `MERCADO_PAGO_TEST_PAYER_EMAIL` deve ser uma conta Comprador criada na
área de testes do Mercado Pago e usar o domínio reservado `testuser.com`. Vendedor e
comprador devem pertencer ao mesmo país e ao conjunto de testes da mesma integração.
O código recusa um e-mail comum quando `MERCADO_PAGO_LIVE_MODE=false`.

O backend envia a URL pública de `mercado-pago-webhook` no campo `notification_url`
durante a criação da assinatura. Esse é o modo exigido para notificações de Assinaturas.
No painel do Mercado Pago, gere a assinatura secreta correspondente ao ambiente e
confirme no painel de notificações a entrega destes tópicos:

```text
payment
subscription_preapproval
subscription_authorized_payment
```

## Validação antes de cobrar

- Use credenciais e usuários de teste do Mercado Pago em um projeto de homologação.
- Confirme cartão aprovado, rejeitado, pendente, cancelamento, renovação e estorno.
- Teste Pix somente se suportado pela modalidade e pelo ambiente; documente a limitação.
- Reenvie o mesmo webhook e verifique que o período não é estendido novamente.
- Confirme que preço/moeda divergentes são rejeitados e que outro usuário não consegue
  consultar ou cancelar a assinatura.
- Valide a URL de retorno e as origens CORS do domínio final.
- Confirme que uma consulta manual de checkout pendente não concede acesso sem um
  pagamento confirmado diretamente pelo provedor.
- Faça uma compra real de baixo valor somente depois da homologação completa e do aceite
  dos textos legais/comerciais pelo responsável do KAD.

## Pendências para as lojas

Evidências e bloqueios atuais: [homologação integrada de 03/09/2026](PAYMENT-HOMOLOGATION-2026-09-03-INTEGRATED.md).

Para lançar assinaturas nos aplicativos será necessário cadastrar os produtos nas lojas,
integrar o SDK de compra compatível com Expo Development Build, validar recibos no
servidor, receber notificações da Apple e do Google, oferecer restauração de compras e
abrir o gerenciamento da assinatura da loja. Até isso existir, a interface móvel informa
que o pagamento está em preparação e não direciona o usuário ao checkout web.

## Google Play Billing (Android)

Esta branch prepara somente a base nativa para testes internos. O projeto usa
`expo-dev-client` e `expo-iap` com os identificadores `com.kad.app`; o perfil
EAS `development` aponta exclusivamente para o Supabase de homologação.

O adaptador `lib/billing.ts` carrega `expo-iap` somente em runtime nativo e expõe
conexão, catálogo, compra por eventos, restauração, observação e finalização de
transações. `lib/subscriptions.ts` envia apenas o SKU e o `purchaseToken` para a
Edge Function `validate-google-purchase`. O app só chama `finishStorePurchase`
depois que o servidor confirma a compra.

A Edge Function autentica o usuário, consulta a API Google Play Developer com a
credencial guardada nos segredos do Supabase, confere pacote, SKU, estado e validade
do token e chama `apply_google_play_purchase`. Essa operação grava o token uma única
vez e atualiza `subscriptions` de forma idempotente. Tokens pendentes ou inválidos
não liberam acesso nem são finalizados. A tela de planos habilita Platina e Diamante
no Android; na web, o checkout Mercado Pago continua separado.

O catálogo nativo não contém o Círculo. O valor legado `circle` permanece aceito
apenas na leitura de assinaturas antigas para não invalidar registros existentes;
ele não pode criar produtos ou compras novas.

### Segredos da validação Google

Cadastre no projeto Supabase, fora do repositório:

```text
GOOGLE_PLAY_PACKAGE_NAME=com.kad.app
GOOGLE_SERVICE_ACCOUNT_JSON=<JSON da conta de serviço com acesso à API Google Play Developer>
```

Os SKUs esperados pela função são:

```text
kad_platinum_monthly
kad_platinum_quarterly
kad_platinum_annual
kad_diamond_monthly
kad_diamond_quarterly
kad_diamond_annual
```

Conceda à conta de serviço a permissão mínima necessária no Play Console. Nunca
coloque o JSON, a chave privada ou tokens de compra no app, em `.env`, commits ou
logs. Publique `validate-google-purchase` e a migration
`202608300001_google_play_billing.sql` antes de testar compras reais.

Para validar a camada nativa, gere um Development Build Android com EAS e teste
em dispositivo físico ou emulador com Google Play, usando uma conta de teste
licenciada. Expo Go não carrega o módulo nativo. Ainda é necessário criar e
publicar os seis produtos, configurar a conta de serviço e, para produção,
adicionar notificações de renovação do Google (RTDN) e um processo de reconciliação.
