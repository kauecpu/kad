# Pagamentos e assinaturas

## Escopo desta entrega

O checkout de produção foi preparado para o KAD Diamante na versão web. O preço e o
período são definidos exclusivamente no backend; o aplicativo nunca envia o valor a ser
cobrado. O Mercado Pago hospeda a coleta de Pix e cartão, então o KAD não recebe nem
armazena dados completos do cartão.

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
6. O app lê somente a linha de `subscriptions` pertencente ao usuário. Cancelar encerra
   cobranças futuras e mantém o acesso até o fim do período pago.

Eventos repetidos não estendem o acesso duas vezes. Pagamentos rejeitados, estornados
ou contestados atualizam o estado sem confiar nos dados enviados pelo navegador.

## Configuração do Supabase

Aplique a migration `202608110001_payments_subscriptions.sql` e publique estas Edge
Functions:

```text
create-payment-checkout
cancel-subscription
mercado-pago-webhook
```

O arquivo `supabase/config.toml` desativa a validação JWT apenas para o webhook. As duas
funções chamadas pelo app continuam autenticando o usuário e nunca expõem a chave
`service_role`.

Cadastre os segredos abaixo no projeto Supabase, sem colocá-los em `.env`, commits,
logs ou Pull Requests:

```text
MERCADO_PAGO_ACCESS_TOKEN=<credencial privada do ambiente>
MERCADO_PAGO_WEBHOOK_SECRET=<assinatura secreta do webhook>
MERCADO_PAGO_LIVE_MODE=false
KAD_WEB_APP_URL=https://app.exemplo.com
ALLOWED_WEB_ORIGINS=https://app.exemplo.com
```

Em produção, altere `MERCADO_PAGO_LIVE_MODE` para `true`. `KAD_WEB_APP_URL` precisa usar
HTTPS. `ALLOWED_WEB_ORIGINS` aceita uma lista separada por vírgulas quando houver mais de
uma origem oficial.

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
- Confirme Pix e cartão aprovado, rejeitado, pendente, cancelamento, renovação e estorno.
- Reenvie o mesmo webhook e verifique que o período não é estendido novamente.
- Confirme que preço/moeda divergentes são rejeitados e que outro usuário não consegue
  consultar ou cancelar a assinatura.
- Valide a URL de retorno e as origens CORS do domínio final.
- Faça uma compra real de baixo valor somente depois da homologação completa e do aceite
  dos textos legais/comerciais pelo responsável do KAD.

## Pendências para as lojas

Para lançar assinaturas nos aplicativos será necessário cadastrar os produtos nas lojas,
integrar o SDK de compra compatível com Expo Development Build, validar recibos no
servidor, receber notificações da Apple e do Google, oferecer restauração de compras e
abrir o gerenciamento da assinatura da loja. Até isso existir, a interface móvel informa
que o pagamento está em preparação e não direciona o usuário ao checkout web.
