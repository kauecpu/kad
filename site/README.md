# KAD Site

Versão web do ambiente de estudos KAD, construída em HTML semântico, CSS e
JavaScript modular com Vite. O projeto é independente do Expo e permanece
isolado dentro de `site/`.

## Executar localmente

```powershell
npm install
npm run dev
```

O endereço local é exibido pelo Vite. Para validar a versão de produção:

```powershell
npm run check
npm run preview
```

## Integração opcional com Supabase

O frontend funciona em modo demonstrativo com os catálogos compartilhados do
repositório e armazenamento local. Para apontá-lo ao mesmo projeto público do
KAD, forneça no ambiente de build:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SITE_URL` (domínio HTTPS de produção, usado no canonical e sitemap)

Somente a chave pública `anon` pode ser exposta no navegador. Sem essas
variáveis, autenticação e sincronização remota ficam desativadas de forma segura.

Quando `VITE_SITE_URL` é informado no build de produção, o pós-build gera um
canonical absoluto, `og:url` e `sitemap.xml`. Sem um domínio confirmado, o
projeto evita publicar URLs inventadas.

## Limite compartilhado

`src/data/catalog.js` é o único adaptador autorizado a importar os catálogos
puros de `../data/`. Componentes, providers e APIs nativas do aplicativo não são
compartilhados com o site.
