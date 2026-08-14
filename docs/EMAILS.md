# E-mails de autenticação

## Escopo e estado atual

O código da Edge Function `send-auth-email` está pronto para uso. O responsável não fez deploy da função, não criou ou configurou segredos, não criou, salvou ou habilitou o Send Email Hook, não registrou ou verificou domínio, não criou chave do Resend e não enviou e-mail real. A marca e o domínio de envio continuam pendentes.

## Arquitetura

`Supabase Auth -> signed hook -> send-auth-email -> Resend API`

O Supabase Auth chama a função por HTTPS. A função valida a assinatura do hook antes de ler o payload e só responde com sucesso após a aceitação do envio pela API do Resend.

## Segredos

Guarde valores somente em **Supabase Edge Function Secrets**. Não copie valores para o aplicativo, repositório, arquivo local, issue, PR ou log.

```text
RESEND_API_KEY=<defina-no-painel>
SEND_EMAIL_HOOK_SECRET=<defina-no-painel>
EMAIL_BRAND_NAME=<defina-no-painel>
EMAIL_FROM_ADDRESS=<defina-no-painel>
EMAIL_REPLY_TO=<defina-no-painel>
EMAIL_ALLOWED_REDIRECT_PREFIXES=<defina-no-painel>
SUPABASE_URL=<defina-no-painel>
```

`EMAIL_REPLY_TO` é opcional. Defina `EMAIL_ALLOWED_REDIRECT_PREFIXES` com os esquemas e origens HTTPS que o aplicativo pode abrir. Use o endereço base HTTPS do projeto em `SUPABASE_URL`.

## Domínio e remetente

Crie um subdomínio exclusivo de envio, como `email.seudominio`, e verifique-o no Resend. Publique os registros SPF e DKIM indicados pelo Resend. Publique DMARC com `p=none` no início, acompanhe os relatórios e aumente a política após corrigir fontes de envio não autorizadas.

Crie uma chave do Resend com permissão de envio e escopo para esse domínio. Desative o rastreamento de abertura e de clique no domínio de envio. Use o endereço verificado desse subdomínio em `EMAIL_FROM_ADDRESS`.

Use `resend.dev` apenas para testes com um destinatário controlado da própria conta Resend. Não use `resend.dev` para usuários finais.

## Validação antes da ativação

Execute a checagem Deno da função e os testes automatizados do repositório antes de configurar o hook.

```powershell
deno check supabase/functions/send-auth-email/index.ts
npm run test
```

Depois de verificar o domínio, envie uma mensagem de teste pelo Resend para um destinatário controlado. Revise a versão HTML e texto em caixas do Gmail e Outlook. Confirme a marca, remetente, assunto, códigos e links de confirmação, acesso, recuperação e avisos de segurança. Abra cada link em um ambiente controlado e confirme que o redirecionamento usa um prefixo permitido.

## Ativação sem janela de falha

1. Defina no Supabase Edge Function Secrets todos os segredos que não dependem do hook.
2. Publique `send-auth-email` com a configuração de verificação JWT já definida no repositório.
3. Mantenha o provedor de e-mail do Supabase habilitado. Abra o formulário HTTPS Send Email Hook no Dashboard, informe a URL da função e gere ou copie o segredo do hook sem salvar nem habilitar o hook.
4. Em outro terminal, grave o valor copiado em `SEND_EMAIL_HOOK_SECRET` nos Supabase Edge Function Secrets. Não o salve em arquivo local ou no histórico compartilhado do shell.
5. Faça uma chamada canário assinada, com destinatário controlado, para a função publicada. Verifique a resposta de sucesso, a mensagem recebida e os logs sem dados pessoais.
6. Salve e habilite o Send Email Hook somente depois do canário. Teste cadastro, reenvio, recuperação de senha e uma notificação de segurança.

Um hook habilitado substitui o caminho SMTP interno do Supabase. Caso o Dashboard não separe a geração do segredo do salvamento, abra uma janela de manutenção controlada. Confirme antes o SMTP de fallback e deixe o rollback pronto para execução imediata.

## Rollback

Desabilite o Send Email Hook e mantenha o provedor de e-mail do Supabase habilitado. Confirme o envio pelo SMTP de fallback com uma ação de autenticação controlada antes de declarar a recuperação. Registre o horário, o erro e o resultado do teste sem copiar destinatários, códigos, links ou segredos.

## Rotação

Crie uma chave nova do Resend com o mesmo escopo de envio. Atualize o segredo da função, verifique um envio controlado e só então revogue a chave anterior.

Troque o segredo do hook durante uma janela de manutenção controlada. Gere o novo valor no Dashboard, atualize `SEND_EMAIL_HOOK_SECRET`, execute um canário assinado e salve a nova configuração do hook. Deixe o rollback disponível durante a troca.

## Privacidade e logs

Não registre nem copie para tickets, PRs ou ferramentas de observabilidade: endereço de e-mail, OTP, token, hash, link de autenticação, corpo da mensagem, chave do Resend ou segredo do hook.

Os logs atuais guardam somente identificadores técnicos, tipo de ação, quantidade de mensagens, códigos de erro, status do provedor e duração. O projeto ainda não possui webhooks de entrega nem outbox durável. Consulte o painel do Resend e os logs da função para investigar uma entrega, sem exportar dados pessoais.
