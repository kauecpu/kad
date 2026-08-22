# Regras do KAD Site

Este diretório contém exclusivamente a versão web do ambiente de estudos KAD.
Ela é uma aplicação HTML, CSS e JavaScript construída com Vite, independente do
aplicativo Expo.

## Escopo e segurança

- Em tarefas exclusivas do site, altere apenas `site/`, documentação/regras da
  raiz e contratos ou dados compartilhados quando isso for explicitamente
  necessário.
- Não altere `app/`, `components/`, `hooks/`, `providers/`, `supabase/`, `admin/`
  ou configurações Expo para implementar uma funcionalidade web.
- Não importe componentes React Native, providers do app ou módulos que usem
  APIs nativas. Catálogos puros de `../data/` e contratos de `../contracts/`
  podem ser consumidos por adaptadores do site.
- Dependências, scripts e lockfile do site ficam neste diretório.
- Integrações externas ficam em `src/services/` e devem falhar de forma segura
  quando não configuradas. Somente credenciais públicas destinadas ao navegador
  podem ser usadas; nunca registre chaves, tokens, cookies ou `service_role`.

## Qualidade web

- Use HTML semântico, navegação por teclado, foco visível, rótulos acessíveis e
  contraste compatível com WCAG 2.2 AA.
- O layout é desktop-first, mas deve continuar utilizável em telas pequenas e
  com toque. Evite conteúdo ou ações disponíveis apenas por hover.
- Preserve URLs navegáveis, títulos e descrições por tela, dados estruturados,
  `robots.txt` e manifesto. Conteúdo privado não deve ser indexado.
- Respeite `prefers-reduced-motion` e não dependa de animação para transmitir
  estado.
- Mantenha regras de domínio em módulos JavaScript puros e cobertos por testes.
- Execute `npm run check` dentro de `site/` e `npm run check` na raiz antes de
  concluir.
