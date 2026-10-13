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

## Regressões de redação e pausa

O timer e o salvamento de redações aceitam apenas temas do catálogo e leem
somente propriedades próprias do mapa de rascunhos. Documentos novos carregam
`topicId` e `status`; rascunhos antigos sem esses campos são completados ao
escrever ou ao salvar o tempo, sem descartar o texto. A edição de um documento
submetido volta ao estado de rascunho sem manter `submittedAt` incompatível.
Estar autenticado não prova que o último texto chegou ao servidor: a interface
informa o salvamento local e a necessidade de conexão, sem afirmar sincronização
confirmada. Se uma tentativa falhar, o rascunho permanece local e uma nova
hidratação da conta (por exemplo, recarregar conectado) tenta sincronizá-lo.

Pausar um simulado bloqueia as alternativas e o handler de resposta. Retomar
preserva respostas e tempo. Eventos antigos de pausa/retomada não reabrem uma
sessão concluída. Isso protege o fluxo da interface, não substitui as regras
de autorização e integridade do servidor.

Os testes `essay-security.test.ts` e `simulation-pause.test.ts` executam os
handlers reais com dependências isoladas e entram no `npm --prefix site run check`.
Para repetir a jornada no navegador, a partir de `site/`:

```powershell
npm run build
npx --no-install wrangler dev --config dist/server/wrangler.json --local --ip 127.0.0.1 --port 5193 --inspector-port 9253
```

Em outro terminal, também em `site/`, use uma instalação existente de Playwright
com Chromium. Se ela estiver fora deste pacote, informe o caminho absoluto de
seu `index.mjs` em `PLAYWRIGHT_MODULE_PATH`. Não são necessárias credenciais:

```powershell
node --no-warnings scripts/study-regressions-browser.mjs
```

O roteiro intercepta a configuração pública e todas as chamadas externas;
somente o servidor de arquivos em `127.0.0.1:5193` recebe tráfego real. São 13
cenários com questões e contas fictícias: respostas, filtros, favoritos,
recuperação offline, isolamento entre contas, simulado completo, pausa,
sincronização/recuperação de redação e cinco temas inválidos. Em tela móvel,
usa eventos de toque. O processo retorna erro se algum cenário falhar e
informa a pasta temporária com relatório JSON e capturas das falhas.

Esta prova valida o navegador e os payloads contra fixtures; não comprova RLS,
RPC implantado, JWT real, Cloudflare nem um dispositivo físico. A correção do
tema reaproveita a proteção de redação proposta no PR #109, sem incorporar suas
migrations ou alterações de pagamentos. Ao integrar aquele PR, preservar estas
regressões e a recuperação dos rascunhos legados; não tratar este PR como
substituto da validação server-side pendente.
