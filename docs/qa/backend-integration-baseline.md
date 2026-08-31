# Baseline da integração de backend — 31/08/2026

Esta auditoria foi executada na branch `codex/backend-integration-audit`, a
partir de `origin/main`. O repositório `kad-collector` não faz parte do escopo.
Nenhuma consulta de auditoria alterou dados remotos e nenhum segredo foi
registrado.

## Matriz de evidências

| Item | Situação | Evidência | Gravidade | Ação necessária |
| --- | --- | --- | --- | --- |
| Mapeamento de ambientes | Funcionando | `npm run env:check:staging` validou `kad-prod`/`npaoyezfwmgauirrlyog`; `npm run env:check:production` validou `kad-dev`/`tknxtwwwoqwbzddplzzg` | — | Manter os checks obrigatórios |
| Chaves do cliente | Funcionando | `scripts/run-environment.mjs` aceita somente `sb_publishable_` e injeta `VITE_*`/`EXPO_PUBLIC_*`; nenhum cliente referencia `service_role` | — | Não expor variáveis privadas |
| Supabase Auth | Disponível | `/auth/v1/settings` respondeu HTTP 200 em staging e produção | — | Validar cadastro/login com conta descartável na homologação |
| Conteúdo publicado | Produção conectada | REST retornou 758 questões e 15 concursos publicados em produção | — | Atualizar documentação antiga que ainda cita 707 questões |
| Conteúdo de homologação | Vazio, mas acessível | REST retornou HTTP 200 e zero questões/concursos publicados | Média | A interface deve informar “conectado, sem conteúdo publicado”, sem mascarar como catálogo local |
| Dados privados/RLS | Bloqueados para anônimo | `profiles` e `subscriptions` responderam HTTP 401 com chave pública sem sessão | — | Testar isolamento com conta descartável |
| Checkout Mercado Pago | Endpoint publicado e protegido | `create-payment-checkout` e `cancel-subscription` responderam HTTP 401 sem sessão em produção | — | Testar somente com credenciais sandbox e usuário descartável |
| Webhook Mercado Pago | Endpoint publicado e validando entrada | `mercado-pago-webhook` respondeu HTTP 400 para corpo vazio | — | Exercitar HMAC/idempotência com payload de teste assinado |
| `send-auth-email` | Não publicado | Endpoint respondeu HTTP 404 em produção; fonte existe no repositório | Média | Não publicar até domínio, hook, segredo e remetente serem aprovados |
| Site sem `VITE_*` | Funciona em fallback local | `npm run dev` sem variáveis inicia o catálogo local, mas o estado não era visível para o usuário | Alta | Adicionar estado explícito offline/remoto e impedir confusão com dados reais |
| Metadados de cadastro | Divergência entre clientes | App grava `user_metadata.name`; site gravava `full_name`, enquanto o trigger do banco lê `name` | Média | Alinhar o payload e aceitar dados legados |
| Logout web | Escopo implícito | Site chamava `auth.signOut()` sem escopo; app já usa `scope: 'local'` | Média | Explicitar logout local no site |
| Webhook não correlacionado | Risco de perda de evento | O handler marcava `not_correlated` como processado; um evento recebido antes do checkout ser correlacionado não seria reprocessado | Alta | Manter o evento pendente para retry seguro |

## Fluxos já implementados

- Cliente web e app usam PKCE, renovação automática e armazenamento persistente;
  o app usa SecureStore no dispositivo.
- Questões e concursos são filtrados por `publication_status = 'published'`.
- Tabelas de progresso, favoritos, concursos salvos, perfis e assinaturas têm
  políticas de propriedade por `auth.uid()` nas migrations atuais.
- Checkout define preço, moeda e ciclo no servidor, usa lease para evitar
  chamadas concorrentes e valida a URL oficial do Mercado Pago no cliente.
- Webhook valida HMAC, ambiente, correlação, preço/moeda e usa RPCs protegidas
  para atualizar a assinatura de forma idempotente.
- Cancelamento preserva o acesso até o fim do período quando aplicável.

## Dependências externas ainda não validadas

- Conta descartável e confirmação de e-mail em homologação.
- Credenciais sandbox do Mercado Pago, segredo HMAC, URL HTTPS pública e tópicos
  de webhook.
- Publicação/configuração do hook de e-mail personalizado com Resend.
- Confirmação no painel de que a migração mais recente de billing do Google foi
  aplicada à produção; esta auditoria não executou migrações remotas.

## Segurança da auditoria

Os arquivos `.env.*.local` foram usados apenas localmente para os checks e
continuam ignorados pelo Git. Nenhum valor de chave, token, cookie ou segredo
aparece neste documento, nos logs versionados ou no PR.
