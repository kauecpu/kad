# Reconciliação do PR #100

## Causa

O PR #100 partia de uma versão anterior das telas. A `main` recebeu depois
o PR #101 (design das cinco áreas), #104 (piloto), #105 (recuperação de senha),
#106 (domínio) e #107 (busca e estudo visitante).

A integração local com `origin/main` em `c9ec6c6` reproduziu conflitos em
`app.css`, `layout.ts`, `explore.ts`, `home.ts`, `profile.ts` e
`structure.test.ts`. Não era uma falha de execução do site.

## Resolução

- Preservadas as composições mais recentes do #101: navegação por cinco áreas,
  recursos de preparação, acesso rápido e organização do perfil/configurações.
- Preservados os fluxos de busca visitante e recuperação já integrados.
- Mantida a limpeza restante do #100 em `base.css`: retirada das variáveis da
  barra inferior removida, rolagem móvel com margem de 24px e avisos respeitando
  a área segura do dispositivo.
- Regressões verificam que os estilos base não dependem mais da barra removida.

A diferença de código em relação à `main` limita-se a `base.css` e ao teste
correspondente. O checkout principal com alterações locais não foi modificado.
Não houve alteração de dados, permissões ou configuração do Supabase.

## Validação em 07/10/2026

- `npm --prefix site run check`: 109 testes aprovados, tipos e build aprovados.
- `npm run check`: 492 testes aprovados; tipos e lint executados na raiz.
- `git diff --check` e `git diff --cached --check`: sem erros.
- Chromium headless: estilos base reais em uma página de teste isolada, nas
  larguras 1440, 1024, 768 e 390px, em claro/escuro e movimento reduzido.
  O aviso permanece dentro da tela; no celular fica a 16px da borda, sem o
  espaço da barra antiga. Foco por teclado e ausência de overflow verificados.
  Essa checagem de CSS não representa uma nova homologação de login ou catálogo.
- Avisos existentes de build: chunk acima de 500 kB e URL absoluta de SEO
  dependente de `VITE_SITE_URL` no deploy. Nenhum deploy realizado.
