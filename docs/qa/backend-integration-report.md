# Relatório da auditoria de integração do KAD

Data: 31/08/2026  
Branch: `codex/backend-integration-audit`  
Escopo: aplicativo, site, painel administrativo e funções Supabase. O `kad-collector` ficou fora do escopo.

## Resultado

O código local passa a distinguir explicitamente catálogo local, conexão em andamento,
catálogo remoto vazio, conteúdo remoto carregado e falha de conexão. Quando o site está
configurado e não consegue consultar o catálogo, ele limpa o fallback demonstrativo e
mostra a indisponibilidade. Assim, o usuário não confunde dados de exemplo com dados do
banco.

O cadastro web agora grava `user_metadata.name`, igual ao app e ao trigger do banco, e
aceita `full_name` legado ao exibir o perfil. O logout web usa escopo local explícito.

O webhook do Mercado Pago não encerra mais eventos sem correlação. Ele os mantém
pendentes com `not_correlated`, permitindo replay depois que o checkout aparecer no
banco. Eventos correlacionados continuam idempotentes.

## O que foi confirmado

| Área | Evidência | Resultado |
| --- | --- | --- |
| Ambientes | Checks dos dois perfis e REST com chave publicável | Staging aponta para `kad-prod`; produção aponta para `kad-dev` |
| Conteúdo publicado | REST de produção | 758 questões e 15 concursos |
| Homologação | REST de staging | Projeto acessível, sem questões ou concursos publicados |
| Isolamento | REST anônimo para `profiles` e `subscriptions` | Bloqueado com HTTP 401 |
| Auth | `/auth/v1/settings` | Endpoint disponível nos dois projetos |
| Checkout | Funções de produção sem sessão | HTTP 401, sem criar cobrança |
| Webhook | Corpo vazio em produção | HTTP 400, validação de entrada ativa |
| Funções não publicadas | `send-auth-email` em produção e pagamentos em staging | HTTP 404 |

## Fluxos que ainda precisam de validação manual

- Cadastro, confirmação de e-mail, login, recuperação e logout com uma conta descartável
  e caixa de e-mail controlada na homologação.
- Checkout Mercado Pago com credenciais sandbox, usuário de teste, Pix, cartão aprovado,
  rejeitado, pendente, cancelamento, renovação, estorno e replay do mesmo webhook.
- Segredos, domínio HTTPS, tópicos e entrega do webhook no painel do Mercado Pago.
- Deploy da função `send-auth-email`, domínio/remetente Resend e Send Email Hook.
- Aplicação da migration de Google Play e confirmação dos seis produtos no Play Console.

Nenhum desses testes foi simulado com conta pessoal, pagamento real ou segredo inventado.

## Validação automatizada

- `npm run check`: 388 testes do app, tipagem e lint aprovados.
- `npm --prefix site run check`: 38 testes, tipagem e build aprovados.
- `npm run site:build:staging` e `npm run site:build:production`: aprovados.
- `npm run build:staging`: exportação Expo para iOS, Android e web aprovada.
- `npm run admin:build:staging`: build do painel aprovado após instalar as dependências locais.
- `npx deno check` nas funções de webhook alteradas: aprovado.
- `npx supabase test db`: bloqueado porque o daemon do Docker Desktop não estava disponível
  em `127.0.0.1:54322`. Nenhum container local foi iniciado e nenhuma base remota foi alterada.

Os relatórios locais de dependências apontaram 23 vulnerabilidades no pacote raiz
(14 moderadas e 9 altas), 7 no site (1 baixa e 6 altas) e 1 alta no painel. Não
apliquei atualização automática; o próximo passo deve tratar cada cadeia com revisão.

## Riscos restantes

1. Staging está sem conteúdo e sem funções de pagamento publicadas. Isso impede o teste
   integrado completo até a configuração externa existir.
2. Produção tem funções publicadas, mas respostas sem sessão não comprovam a presença dos
   segredos do Mercado Pago. A validação sandbox continua obrigatória.
3. O projeto ainda possui vulnerabilidades de dependências reportadas pelo `npm audit`.
   O relatório não aplicou correções automáticas porque elas podem alterar versões e
   comportamento fora deste escopo.
4. O build Expo emite o aviso preexistente de rota `flashcards` extraneous. O build termina
   com sucesso, mas a rota deve ser revisada em uma tarefa própria.

## Arquivos de evidência

O diagnóstico inicial com endpoints, contagens e severidades está em
`docs/qa/backend-integration-baseline.md`. Os arquivos `.env.*.local` usados nos checks
continuam ignorados e nenhum valor secreto foi registrado.
