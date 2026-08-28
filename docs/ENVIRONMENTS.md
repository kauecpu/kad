# Ambientes do KAD

Esta configuração é temporária e evita custo durante o MVP. Os dois projetos
Supabase permanecem independentes; nenhum dado é copiado automaticamente entre
eles.

## Mapa atual

| Papel | Projeto no Supabase | Project ref | Dados permitidos |
| --- | --- | --- | --- |
| Homologação | `kad-prod` | `npaoyezfwmgauirrlyog` | Somente contas e dados descartáveis |
| Produção atual | `kad-dev` | `tknxtwwwoqwbzddplzzg` | Dados reais existentes |

O nome `kad-prod` ficou reservado no Supabase antes de o limite de dois projetos
gratuitos ser identificado. Enquanto o plano permanecer Free, ele funciona
exclusivamente como homologação. O papel efetivo é definido pelo project ref e
pelas travas do código, não pelo nome exibido no painel.

`kad-dev` não foi renomeado, esvaziado nem reutilizado para testes. Ele continua
como ambiente real legado porque já contém usuários, conteúdo e histórico. O
backup lógico confirmado antes desta separação está fora do Git em:

`C:\Users\igord\Downloads\KAD-archives\pr51-20260827-203141\supabase\kad-dev-20260827.sql`

## Uso local

1. Copie `.env.staging.example` para `.env.staging.local` e informe a chave
   publicável do projeto de homologação.
2. Copie `.env.production.example` para `.env.production.local` e informe a chave
   publicável da produção atual.
3. Nunca adicione esses arquivos ao Git.

Comandos principais:

| Ação | Homologação | Produção |
| --- | --- | --- |
| Abrir aplicativo | `npm run start:staging` | `npm run start:production` |
| Abrir aplicativo web | `npm run web:staging` | `npm run web:production` |
| Gerar app web | `npm run build:staging` | `npm run build:production` |
| Abrir site | `npm run site:staging` | `npm run site:production` |
| Gerar site | `npm run site:build:staging` | `npm run site:build:production` |
| Abrir administração | `npm run admin:staging` | `npm run admin:production` |

Cada comando deriva o endereço do arquivo canônico
`contracts/deployment-environment.ts`, aceita apenas chave `sb_publishable_`
e consulta o projeto antes de iniciar. Um projeto não pode ser usado no perfil do
outro.

## Builds EAS

`eas.json` possui perfis separados `staging` e `production`. A chave publicável
deve ser cadastrada no ambiente EAS correspondente com o nome
`EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; ela não fica no repositório. A URL e o
papel já estão fixados no perfil.

## Banco e promoção

1. Toda mudança de banco nasce como migration versionada.
2. A migration entra primeiro na homologação.
3. Login, leitura, escrita e RLS são testados somente com dados descartáveis.
4. O Pull Request passa por `npm run check` e revisão humana.
5. A mesma migration pode ser aplicada à produção somente após aprovação e novo
   backup manual.
6. As 707 questões não fazem parte desta configuração e não são copiadas.

Auth, Storage, tabelas, usuários e Edge Functions são próprios de cada projeto.
Segredos de funções ficam no painel do respectivo ambiente. O app, o site e o
painel administrativo recebem somente chaves publicáveis.

As Edge Functions de pagamento continuam somente na produção. Elas não devem ser
publicadas na homologação até existirem credenciais de teste próprias do provedor;
credenciais reais nunca podem ser reutilizadas nesse ambiente. Login, leitura,
gravação e RLS já foram validados na homologação com uma conta descartável, removida
ao fim do teste.

## Limitação conhecida

O plano Free não oferece backup automático e limita a conta a dois projetos
ativos. Antes de escalar, o recomendado é migrar a produção para um projeto com
nome definitivo e backups diários, mantendo esta homologação separada.

A proteção contra senhas vazadas também precisa ser ativada manualmente na produção
quando o recurso estiver disponível no plano contratado. Essa pendência não altera
a separação dos ambientes, mas deve ser resolvida antes do lançamento público.
