# KAD Site — Ambiente de estudo v4

## Diagnóstico anterior

A interface interna estava organizada como um painel administrativo: navegação e cabeçalho consumiam muita atenção, as páginas repetiam blocos de apresentação e ações, e grades de cards com o mesmo peso visual dificultavam identificar a próxima ação de estudo. A cor funcionava mais como decoração do que como informação.

## Direção implementada

A experiência foi reorganizada em cinco arquétipos, escolhidos pela intenção da tela:

- **Mesa de estudo:** início com uma única próxima ação, plano curto, meta e histórico.
- **Catálogo:** questões e demais acervos como índices densos, fáceis de percorrer.
- **Sessão focada:** resolução de questões com navegação reduzida e foco no conteúdo.
- **Jornada:** trilhas e progresso apresentados como sequência, não como grade de cards.
- **Configurações:** perfil em grupos neutros, com ações destrutivas semanticamente separadas.

Os componentes novos reutilizam os tokens existentes e adicionam padrões pequenos: próxima ação, linha de plano, linha de disciplina e etapa de jornada. Roxo continua orientando a marca; amarelo indica energia/meta; azul, verde e vermelho são reservados a informação, sucesso e perigo.

## Escopo alterado

- Estrutura semântica do shell interno e identificação do arquétipo por rota.
- Início, Questões, Trilhas e Perfil redesenhados como exemplos completos dos cinco padrões.
- Camada de estilos responsiva e isolada em `.app-shell`; landing pública preservada.
- Testes estruturais atualizados para as novas responsabilidades da interface.
- Biblioteca e telas de referência documentadas no Figma em `KAD Site — Ambiente de estudo v4`.

## Validação

- Desktop: 1440 × 900.
- Tablet: 768 × 1024.
- Mobile: 390 × 844.
- Tema claro e escuro.
- Navegação por teclado, foco, seleção, sucesso, atenção e perigo.
- Ausência de rolagem horizontal nas rotas internas verificadas.
- Typecheck, testes, lint e build executados.
- A suíte específica do site passou integralmente (46/46). Na suíte geral, 387/388 testes passaram; a falha reproduzível restante pertence à troca de usuário Premium do app (`tests/app-rules.test.ts`) e nenhum arquivo fora de `site/` foi alterado neste PR.

## Capturas

- Antes no Figma: `figma-v3-before.png`
- Componentes v4: `figma-v4-components.png`
- Início v4 no Figma: `figma-v4-home.png`
- Sessão v4 no Figma: `figma-v4-session.png`
- Referências mobile no Figma: `figma-v4-mobile.png`
- Frontend desktop: `frontend-v4-home-desktop.png`
- Frontend mobile: `frontend-v4-session-mobile.png`

## Riscos restantes

- Densidade e ordem de conteúdo devem ser validadas com usuários reais e bases maiores.
- Estados autenticados e sincronizados dependem de integrações reais fora do escopo visual deste PR.
- Algumas rotas compartilham o arquétipo de catálogo por padrão e podem ganhar uma especialização posterior conforme o fluxo real amadurecer.
- O ambiente local não possui `VITE_SITE_URL`; o build usa o comportamento de fallback previsto.
- O gerenciador de pacotes reporta vulnerabilidades em dependências existentes; não foi aplicado `audit fix` automático para evitar alterações fora do escopo.
