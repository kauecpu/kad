# Auditoria Mercado Pago — 2 de setembro de 2026

## Resultado

A integração existente foi preservada. O checkout continua sendo criado por
`/preapproval`, a cobrança é confirmada somente por recurso consultado no Mercado
Pago e o acesso é aplicado pela rotina transacional e idempotente do banco.

Produção continua sem alterações. A migration de diagnóstico e as três Edge
Functions foram publicadas somente na homologação `npaoyezfwmgauirrlyog`.

## Causa das dez falhas históricas

As dez sessões `failed` foram criadas antes de o segredo
`MERCADO_PAGO_ACCESS_TOKEN` ser cadastrado na produção. A última falha ocorreu antes
da configuração do token, feita em 13 de agosto de 2026 às 02:47 UTC. A primeira
sessão `pending` surgiu aproximadamente um minuto depois. O pagador de teste também
só foi cadastrado durante essa janela.

O código antigo persistia apenas `status = failed` e os logs de Edge Functions não
retêm esse período. A correlação temporal entre os registros e a configuração dos
segredos é a evidência disponível; não há payload histórico do provedor, e nenhum
dado pessoal foi consultado ou incluído neste relatório.

## Segredos (somente presença)

| Segredo | Homologação `kad-prod` | Produção atual `kad-dev` |
| --- | --- | --- |
| `MERCADO_PAGO_ACCESS_TOKEN` | ausente | configurado |
| `MERCADO_PAGO_WEBHOOK_SECRET` | ausente | configurado |
| `MERCADO_PAGO_LIVE_MODE` | ausente | configurado |
| `MERCADO_PAGO_TEST_PAYER_EMAIL` | ausente | configurado |
| `KAD_WEB_APP_URL` | ausente | configurado |
| `ALLOWED_WEB_ORIGINS` | ausente | configurado |

Os segredos padrão do Supabase estão disponíveis nos dois projetos. Valores e
digests não foram copiados para o repositório, logs, testes ou PR.

## Diferenças entre código local e produção

- `create-payment-checkout` publicado correspondia à implementação local anterior
  à auditoria; o catálogo compartilhado de produção ainda não tinha o plano Platina.
- `cancel-subscription` correspondia ao código local anterior à auditoria.
- `mercado-pago-webhook` publicado ainda marcava evento não correlacionado como
  processado; o `main` local já continha a correção para permitir nova tentativa.
- Homologação não possuía nenhuma Edge Function antes desta auditoria.

## Correções desta branch

- categoria segura `status_reason` em cada sessão de checkout;
- classificação de falha de configuração, credencial, requisição, limite,
  indisponibilidade e resposta inválida;
- RPC autenticada que expõe somente o status da própria sessão;
- estado real no site para preparando, aguardando, confirmado, recusado, expirado,
  cancelado e configuração ausente;
- validação do comprador de homologação pelo domínio reservado `testuser.com`;
- testes de catálogo, ciclo, URL de retorno, URL oficial, HMAC, idempotência,
  eventos fora de ordem, estorno, chargeback, cancelamento, rate limit e interface.

## Revisão de conclusão do checkout web

A revisão posterior acrescentou uma reconciliação autenticada e limitada para sessões
pendentes, timeout nas chamadas ao Mercado Pago, logs sanitizados por categoria e
proteção do polling da web contra troca de rota, logout ou troca de usuário. O site
também passou a reconhecer corretamente assinaturas Platina e a encerrar localmente o
acesso quando `current_period_end` já venceu.

Nesta execução, a consulta remota foi interrompida antes de qualquer alteração porque
o Supabase CLI não possuía uma sessão autenticada. Portanto, a tabela de presença de
segredos acima permanece evidência histórica da auditoria anterior; ela não foi
revalidada nesta branch. Consulte `PAYMENT-HOMOLOGATION-2026-09-02.md` para o estado
atual, matriz de cenários e plano de promoção.

## Bloqueio da homologação

O teste integrado não pode prosseguir enquanto os seis segredos personalizados
estiverem ausentes e não existir uma conta KAD descartável. Nenhuma credencial de
produção deve ser copiada. Depois da configuração, executar nesta ordem:

1. cadastrar uma conta Comprador de teste no Mercado Pago, no mesmo país do
   Vendedor de teste;
2. cadastrar os seis segredos na homologação;
3. criar uma conta KAD descartável;
4. abrir o checkout mensal e validar que a URL pertence ao Mercado Pago;
5. concluir cenários aprovado, recusado e pendente;
6. reenviar o mesmo webhook e confirmar um único período de acesso;
7. validar cancelamento, estorno, chargeback e divergência de preço/moeda;
8. comparar apenas contagens e estados sanitizados no banco;
9. validar também o retorno antes do webhook por `reconcile-payment-checkout`.

## Publicação em produção

Não publicar esta branch em produção antes de concluir a homologação acima. Após a
aprovação humana do PR, fazer backup, aplicar a migration, publicar as quatro funções
com suas configurações JWT atuais e executar uma verificação sem cobrança. Qualquer
cobrança real ou alteração de segredo de produção exige autorização explícita.
