# KAD Site

Versão web do ambiente de estudos KAD, construída em HTML semântico, CSS e
JavaScript modular com Vite. O projeto é independente do Expo e permanece
isolado dentro de `site/`.

## Executar localmente

```powershell
npm install
npm run site:staging
```

O endereço local é exibido pelo Vite. Para validar a versão de produção:

```powershell
npm run check
npm run preview
```

## Ambientes Supabase

Os comandos da raiz selecionam um único projeto e verificam sua chave antes de
iniciar ou compilar. Crie `.env.staging.local` e `.env.production.local` a partir
dos exemplos da raiz e use:

```powershell
npm run site:staging
npm run site:build:staging
npm run site:production
npm run site:build:production
```

Somente a chave moderna `sb_publishable_` pode chegar ao navegador. O validador
recusa chaves antigas, secretas e qualquer combinação de ambiente e projeto que
não esteja registrada em `contracts/deployment-environment.ts`.

`VITE_SITE_URL` continua opcional e define o domínio HTTPS usado no canonical e
sitemap.

Quando `VITE_SITE_URL` é informado no build de produção, o pós-build gera um
canonical absoluto, `og:url` e `sitemap.xml`. Sem um domínio confirmado, o
projeto evita publicar URLs inventadas.

## Limite compartilhado

`src/data/catalog.js` é o único adaptador autorizado a importar os catálogos
puros de `../data/`. Componentes, providers e APIs nativas do aplicativo não são
compartilhados com o site.

## Verificação de acesso a simulados

A configuração de simulados personalizados exige conta autenticada e assinatura
válida. Antes de criar cada simulado, o site consulta novamente a assinatura
remota: o plano guardado no navegador não autoriza a criação. Indisponibilidade
da consulta mantém o formulário em erro recuperável, sem criar ou substituir o
simulado. Troca de conta, saída, navegação e nova tentativa invalidam respostas
atrasadas. O simulado rápido e a leitura dos resultados existentes são preservados.

Esse controle do site não é uma fronteira de segurança para chamadas diretas à
API: a autorização de recursos pagos no backend precisa ser verificada e aplicada
separadamente. Não se deve anunciar um paywall inviolável baseado no JavaScript
do navegador, especialmente porque as questões do plano gratuito são públicas.

As proteções de pagamentos contra troca de conta e vencimento já existem na
`main`; os testes de regressão cobrem também a exibição da assinatura vencida.
Execute `npm --prefix site run check` e `npm run check` na raiz do repositório.

O cache de estudo continua separado por conta, mas persiste no navegador após
sair. Não o removemos automaticamente: isso poderia apagar redações e respostas
ainda não sincronizadas. Em dispositivo compartilhado, use um perfil de navegador
separado; isolamento por conta no app não equivale a criptografia do disco.
