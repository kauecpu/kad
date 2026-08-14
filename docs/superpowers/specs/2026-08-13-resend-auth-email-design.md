# Integração de e-mails de autenticação com Resend

**Data:** 13 de agosto de 2026

**Status:** desenho e documento aprovados pelo responsável do projeto

**Escopo:** e-mails gerados pelo Supabase Auth

## Contexto

O aplicativo usa `supabase.auth.signUp`, `supabase.auth.resend` e
`supabase.auth.resetPasswordForEmail`. O Supabase Auth envia as mensagens pelo
provedor configurado fora do repositório. O código não possui cliente Resend,
função de e-mail, outbox ou rastreamento de entrega.

O projeto Supabase remoto não receberá mudanças nesta entrega. A equipe ainda
não definiu o nome final da marca nem registrou um domínio. O código deve ficar
pronto para ativação posterior sem incluir nomes, remetentes ou chaves no bundle
Expo.

## Objetivo

Criar uma integração server-side que receba os eventos do Send Email Hook do
Supabase Auth, valide a assinatura do evento, gere uma mensagem em português e
envie o conteúdo pela API do Resend. A integração deve cobrir os eventos atuais
que possuem destinatário vinculável no payload, falhar fechado nos demais e
permitir que a equipe altere marca, remetente e reply-to por configuração.

## Fora do escopo

- E-mails de marketing, lembretes e campanhas.
- Mensagens de boas-vindas ou eventos de produto.
- E-mails e mudanças relacionados a pagamentos.
- Webhook de entrega do Resend, tabela de eventos, fila ou outbox.
- Registro de domínio, criação da conta Resend e envio real.
- Mudança do esquema `kad://` ou do nome do aplicativo Expo.
- Alterações no repositório `kad-collector`.

## Alternativas consideradas

### Send Email Hook com Edge Function e API Resend

O Supabase Auth chama uma Edge Function por HTTPS. A função valida uma
assinatura Standard Webhooks e usa a API do Resend. Essa opção preserva os
fluxos de autenticação do aplicativo, mantém os segredos no servidor e permite
versionar templates e testes. Este desenho adota essa opção.

### Resend como SMTP do Supabase

A configuração SMTP exige menos código, mas não atende ao pedido de usar a API
do Resend. Ela também oferece menos controle sobre idempotência, tratamento de
erros e evolução dos templates.

### Edge Function chamada pelo aplicativo

Um endpoint chamado pelo Expo precisaria recriar a geração de links e códigos
do Supabase Auth. Esse endpoint aumentaria a superfície de abuso e exigiria
autorização de negócio para impedir envio arbitrário. O desenho rejeita essa
opção.

## Arquitetura

```text
Aplicativo Expo
  -> Supabase Auth
    -> Send Email Hook HTTPS
      -> send-auth-email
        -> valida assinatura e contrato
        -> resolve destinatário e template
        -> renderiza HTML e texto
        -> Resend Email API
```

O aplicativo mantém as chamadas de autenticação atuais. A Edge Function não
expõe um endpoint de envio ao cliente. O Supabase Auth controla o destinatário,
o código, os hashes e o tipo do evento.

Os templates atuais em `supabase/templates` permanecem como fallback para SMTP.
O Send Email Hook usa os templates da Edge Function quando estiver habilitado.

### Componentes

1. **Entrada HTTP:** aceita `POST`, aplica limite de 64 KiB e deadline total de
   1.000 ms, cancela streams lentos sem aguardar o cancelamento e preserva o
   corpo bruto para a validação da assinatura.
2. **Verificador do hook:** remove o prefixo de transporte `v1,whsec_` do
   segredo e valida `webhook-id`, `webhook-timestamp` e `webhook-signature`.
3. **Contrato de evento:** valida os campos usados da pessoa e de `email_data`.
4. **Planejador de mensagem:** transforma um evento em uma ou duas mensagens,
   sem aceitar destinatário ou conteúdo fornecido pelo aplicativo.
5. **Templates:** produzem assunto, HTML e texto puro a partir de dados
   validados e escapados.
6. **Transporte Resend:** envia pela API oficial, aplica idempotência e converte
   respostas do provedor em erros internos tipados.
7. **Handler testável:** recebe verificador, relógio, logger e transporte por
   injeção. O arquivo `index.ts` contém apenas a ligação com Deno e os segredos.

Os módulos puros não importam APIs de Deno. Os testes do repositório podem
executá-los com o Node Test Runner atual.

## Configuração

A função lê estas variáveis do ambiente hospedado:

| Variável | Obrigatória | Uso |
| --- | --- | --- |
| `RESEND_API_KEY` | sim | autenticar a chamada à API Resend |
| `SEND_EMAIL_HOOK_SECRET` | sim | validar a assinatura do Supabase Auth |
| `EMAIL_BRAND_NAME` | sim | nome exibido no remetente e no conteúdo |
| `EMAIL_FROM_ADDRESS` | sim | mailbox pertencente ao domínio verificado |
| `EMAIL_REPLY_TO` | não | endereço que recebe respostas |
| `EMAIL_ALLOWED_REDIRECT_PREFIXES` | sim | lista de prefixos permitidos para redirects |
| `SUPABASE_URL` | sim | base do endpoint oficial de verificação |

`EMAIL_ALLOWED_REDIRECT_PREFIXES` começará com `kad://`. A equipe poderá
adicionar origens HTTPS depois de configurar links web. A função encerra o
pedido com erro de configuração se faltar uma variável obrigatória. O código
não fornece marca, remetente ou chave padrão.

Nenhuma variável usa o prefixo `EXPO_PUBLIC_`. O repositório documenta somente
os nomes e formatos esperados, sem valores reais.

## Eventos e conteúdo

| `email_action_type` | Destino | Conteúdo principal |
| --- | --- | --- |
| `signup` | e-mail da conta | código de confirmação com seis dígitos |
| `email` | e-mail da conta | código de acesso por e-mail |
| `recovery` | e-mail da conta | link de redefinição de senha |
| `magiclink` | e-mail da conta | link de acesso único |
| `invite` | e-mail convidado | link para aceitar o convite |
| `reauthentication` | e-mail da conta | código temporário de reautenticação |
| `email_change` | endereço atual e novo | confirmação da mudança segura de e-mail |
| `password_changed_notification` | e-mail da conta | aviso de senha alterada |
| `email_changed_notification` | e-mail anterior (`old_email`) | aviso de e-mail alterado |
| `phone_changed_notification` | e-mail da conta | aviso de telefone alterado |
| `identity_linked_notification` | e-mail da conta | aviso de identidade vinculada |
| `identity_unlinked_notification` | não entregue | `422 unsupported_action`; o payload atual não vincula o destinatário anterior |
| `mfa_factor_enrolled_notification` | e-mail da conta | aviso de fator MFA adicionado |
| `mfa_factor_unenrolled_notification` | e-mail da conta | aviso de fator MFA removido |

O planejador rejeita tipos desconhecidos. Essa decisão impede que um evento
novo receba um template com instruções ou links incorretos.

O planejador também rejeita `identity_unlinked_notification`. O Supabase captura
o destinatário antes da desvinculação em seu fluxo nativo, mas o payload atual do
Send Email Hook não expõe esse valor; `user.email` pode já apontar para uma
identidade promovida. A notificação opcional deve permanecer desabilitada enquanto
o hook estiver ativo, até que o contrato upstream forneça o destinatário vinculável.

### Mudança segura de e-mail

O Supabase usa nomes de hashes contraintuitivos por compatibilidade. O
planejador segue o mapeamento oficial:

- endereço atual: `token` com `token_hash_new`;
- endereço novo: `token_new` com `token_hash`.

Se o projeto desativar a mudança segura, o planejador envia uma mensagem ao
novo endereço com o par de token e `token_hash` presente no evento. Cada
mensagem recebe sua própria chave de idempotência.

### Links de ação

A função monta links sobre `SUPABASE_URL/auth/v1/verify` e inclui o hash, o tipo
de verificação e o redirect codificado. Ela aceita o redirect somente quando o
valor começa com um dos prefixos configurados. O endpoint do Supabase consome o
hash antes de redirecionar ao aplicativo.

O cadastro continua usando o OTP numérico na tela atual. A recuperação continua
retornando ao fluxo `kad://auth/nova-senha`.

### Regras de apresentação

- Conteúdo em português do Brasil.
- HTML em tabelas com estilos inline e largura máxima adequada a clientes de
  e-mail.
- Alternativa em texto puro com o mesmo conteúdo útil.
- Nome da marca escapado antes de entrar no HTML.
- Links visíveis no texto, além do botão.
- Mensagem para ignorar a ação quando a pessoa não a solicitou.
- Sem imagens externas, pixel de abertura ou rastreamento de cliques.

## Segurança

### Autenticação da função

O Send Email Hook não envia um JWT de usuário. A função terá
`verify_jwt = false` apenas no escopo `send-auth-email`. A assinatura Standard
Webhooks substitui o JWT para esse endpoint. A função rejeita o pedido antes de
interpretar o JSON quando a assinatura estiver ausente, inválida ou fora da
janela aceita pela biblioteca.

### Proteção de segredos e dados

- A função não usa `service_role`.
- O segredo simétrico do hook segue Standard Webhooks 1.0: base64 canônico de
  24 a 64 bytes, com prefixo `whsec_` e o prefixo opcional `v1,` do Supabase.
- O Expo não recebe chaves ou configurações privadas.
- O código não registra destinatário completo, OTP, hashes, links ou corpos.
- As mensagens de erro públicas não incluem respostas brutas do Resend.
- O parser recusa cabeçalhos, marca, remetente e reply-to com caracteres de
  controle.
- O renderer escapa conteúdo dinâmico e codifica parâmetros de URL.
- A função não aceita campos livres de remetente, destinatário, assunto ou HTML.

### Idempotência

Depois de validar a assinatura, a função calcula SHA-256 dos bytes UTF-8 exatos
do corpo bruto. Cada chamada ao Resend usa
`auth/<actionType>/<recipientRole>/<digest>`. A chave não inclui
`webhook-id`, e-mail, nome, token, hash ou o corpo em texto. O Supabase pode
gerar um novo `webhook-id` ao repetir a mesma serialização; o digest preserva
a chave durante a janela de 24 horas do Resend, enquanto qualquer mudança no
corpo assinado gera outra chave. A ação e o papel mantêm distintas as duas
mensagens de `email_change`.

O handler não executa loops próprios de retry. O transporte limita cada chamada
ao Resend a 1.250 ms, estritamente dentro do orçamento total de 5 segundos do
hook para acomodar até três tentativas e overhead. Uma falha transitória retorna
`503` com `Retry-After: 1`; uma nova tentativa reutiliza a proteção de
idempotência quando o corpo assinado é o mesmo.

## Respostas e erros

| Situação | Status | Comportamento |
| --- | --- | --- |
| sucesso aceito pelo Resend | `200` | resposta JSON vazia |
| método diferente de `POST` | `405` | inclui cabeçalho `Allow: POST` |
| assinatura ausente ou inválida | `401` | não interpreta o payload |
| corpo excessivo | `413` | não chama o verificador nem o Resend |
| corpo não concluído em 1.000 ms | `503` + `Retry-After: 1` | cancela o stream e permite nova tentativa segura sem efeitos parciais |
| payload ou evento inválido | `422` | retorna código interno sem dados pessoais |
| segredo ou configuração ausente | `500` | registra apenas os nomes ausentes |
| `4xx` determinístico do Resend, incluindo `409 invalid_idempotent_request`, quotas diária/mensal e `429` desconhecido | `502` | não repete a chamada |
| rede, timeout, `409 concurrent_idempotent_requests`, `429 rate_limit_exceeded` ou `5xx` do Resend | `503` + `Retry-After: 1` | permite nova tentativa segura |

A função só responde `200` depois que o Resend aceita todas as mensagens do
evento. No caso de mudança segura de e-mail, uma aceitação parcial retorna erro
e registra os IDs técnicos aceitos para investigação. A chave de idempotência
impede a duplicação da mensagem já aceita durante uma nova tentativa.

## Observabilidade

O logger produz registros estruturados com:

- `webhook_id`;
- `email_action_type`;
- quantidade de mensagens;
- etapa e código interno do erro;
- status HTTP do provedor;
- IDs retornados pelo Resend;
- latência total.

O logger mascara valores inesperados antes de serializar. Os testes inspecionam
os registros para impedir a presença de e-mail, token, hash, link ou segredo.

## Estratégia de testes

### Testes unitários

- Validar todos os tipos de evento entregáveis da matriz e a rejeição fechada de
  `identity_unlinked_notification`.
- Cobrir os modos seguro e simples de mudança de e-mail.
- Verificar links, redirects aceitos e redirects recusados.
- Confirmar HTML escapado e equivalência de conteúdo entre HTML e texto.
- Confirmar chaves de idempotência estáveis e sem dados pessoais.
- Classificar respostas `2xx`, `4xx`, `409`, cada código `429`, `5xx`,
  timeout e rede do Resend.
- Confirmar o timeout padrão de 1.250 ms e `Retry-After: 1` em toda resposta
  transitória `503`, inclusive após aceitação parcial.

### Testes do handler

- Assinatura válida, ausente, inválida e expirada.
- Métodos HTTP, limite do corpo, deadline total, cancelamento pendente e JSON malformado.
- Configuração ausente.
- Falha antes do transporte e sucesso com transporte falso.
- Alteração de e-mail com duas mensagens e aceitação parcial.
- Logs sem dados pessoais ou segredos.

### Verificações de entrega

- Executar os testes específicos.
- Executar `npm run check`.
- Validar imports e tipos da Edge Function com a ferramenta Deno/Supabase
  disponível no ambiente.
- Buscar padrões de chaves e segredos no diff.
- Executar revisão de segurança do diff.

O responsável aprovou que arquivos declarativos e documentação não recebam
testes por regex do próprio texto. `config.toml` e `deno.json` são validados
por parsing/typecheck e pelo Supabase CLI; o runbook passa por revisão de
conteúdo e scan de credenciais. O TDD permanece obrigatório para o código
TypeScript executável.

Os testes automatizados não chamam a API do Resend. A integração usa um
transporte falso e fixtures assinadas.

## Entrega nesta etapa

O Pull Request conterá código, testes e um guia de ativação. Ele não implantará
a função, não criará secrets, não habilitará o Send Email Hook e não enviará
mensagens reais. A branch parte da `main` e não inclui os commits ou o arquivo
pendente da atividade de pagamentos.

## Ativação posterior

1. Definir a marca e registrar um domínio.
2. Criar a conta Resend e verificar um subdomínio de envio.
3. Publicar SPF, DKIM e DMARC no DNS.
4. Desabilitar rastreamento de abertura e clique no domínio Resend.
5. Criar uma chave Resend com acesso de envio restrito ao domínio.
6. Definir todos os segredos da Edge Function, exceto o segredo ainda não
   gerado do hook.
7. Implantar `send-auth-email` com `verify_jwt = false`.
8. Manter o provedor de e-mail do Supabase habilitado, abrir a criação do Send
   Email Hook HTTPS e gerar/copiar o segredo sem salvar ou habilitar o hook.
9. Definir `SEND_EMAIL_HOOK_SECRET` em outro terminal e executar um canário
   assinado controlado contra a função já implantada.
10. Somente depois do canário, salvar/habilitar o hook. Se o Dashboard não
    permitir separar a geração do segredo do salvamento, usar uma janela de
    manutenção controlada com rollback imediato preparado.
11. Confirmar que a notificação opcional de identidade desvinculada permanece
    desabilitada e testar cadastro, reenvio, recuperação e um evento de segurança
    suportado.
12. Conferir logs do Supabase e do Resend sem copiar dados pessoais para o PR.

O hook habilitado substitui o caminho SMTP interno, por isso o responsável o
ativa por último. Em caso de falha, ele desabilita o hook;
com o provedor de e-mail do Supabase habilitado, o fluxo volta ao SMTP
configurado.

## Riscos e decisões

- O Supabase classifica Auth Hooks como Beta em agosto de 2026. O guia oficial
  documenta o Send Email Hook com Resend, mas uma mudança de contrato exigirá
  ajuste no parser.
- A entrega sem domínio não pode provar entrega em caixas reais. O guia de
  ativação mantém essa validação como condição para habilitar o hook.
- O Resend mantém idempotência por 24 horas. O escopo atual não inclui outbox
  durável porque os eventos são síncronos e gerados pelo Supabase Auth.
- Um evento futuro desconhecido interrompe o envio até a equipe adicionar um
  template. O erro explícito evita conteúdo incorreto em ações sensíveis.

## Critérios de aceitação

- O cliente Expo não contém referência à API key do Resend.
- A Edge Function rejeita pedidos sem assinatura válida.
- Os eventos entregáveis listados geram HTML e texto em português; o evento de
  identidade desvinculada falha fechado antes do transporte.
- A função trata corretamente os dois destinatários da mudança segura de
  e-mail.
- Marca, remetente, reply-to e redirects vêm do ambiente.
- Os logs não contêm e-mail, OTP, token, hash, link ou segredo.
- O transporte usa idempotência e classifica falhas transitórias.
- Os testes cobrem contrato, templates, handler e transporte sem rede.
- `npm run check` e a validação da Edge Function passam.
- O guia documenta configuração, ativação, verificação e rollback.
- O projeto Supabase remoto permanece inalterado nesta entrega.

## Referências oficiais

- [Supabase Send Email Hook](https://supabase.com/docs/guides/auth/auth-hooks/send-email-hook)
- [Supabase com React Email e Resend](https://supabase.com/docs/guides/functions/examples/auth-send-email-hook-react-email-resend)
- [Supabase Edge Function Secrets](https://supabase.com/docs/guides/functions/secrets)
- [Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/)
- [Expo Linking 8 para SDK 54](https://docs.expo.dev/versions/v54.0.0/sdk/linking/)
- [Resend Send Email API](https://resend.com/docs/api-reference/emails/send-email)
- [Resend Domains](https://resend.com/docs/dashboard/domains/introduction)
- [Resend Idempotency Keys](https://resend.com/docs/dashboard/emails/idempotency-keys)
