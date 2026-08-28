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
