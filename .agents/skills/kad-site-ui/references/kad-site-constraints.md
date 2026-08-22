# Restrições visuais do KAD Site

## Produto e escopo

- O KAD Site é um ambiente web de estudo para concursos, com foco principal em computador e uso completo em celular.
- O produto público apresenta o KAD e conduz para entrar ou criar conta. O ambiente de estudo contém questões, simulados, concursos, trilhas, redação, biblioteca, ranking e perfil.
- Alterar somente `site/`. Não editar `app/`, `components/`, `hooks/`, `providers/`, Expo ou React Native para uma tarefa do site.
- A stack é Vite com HTML gerado por JavaScript, CSS e JavaScript nativos. Não adicionar Tailwind ou framework visual por recomendação da skill externa.

## Fontes de verdade no código

- Tokens e estilos compartilhados: `site/src/styles/base.css`.
- Composição e estilos das telas: `site/src/styles/app.css` e `site/src/views/`.
- Componentes reutilizáveis: `site/src/ui/components.js`.
- Estrutura de navegação: `site/src/ui/layout.js`.
- Rotas e ações: `site/src/main.js` e `site/src/core/router.js`.
- Imagens oficiais: `site/public/assets/`.

Reutilizar essas fontes antes de criar variantes. Evitar CSS específico de página quando um token ou componente compartilhado resolve o problema.

## Identidade visual preservada

- Família tipográfica principal: Inter com fallbacks de sistema.
- Roxo principal: `#6d28d9`; hover: `#5b21b6`; forte: `#42158b`; suave: `#f1ebff`.
- Estados semânticos existentes: sucesso `#137a4e`, perigo `#b42318` e aviso `#8a5d00`, com equivalentes do tema escuro.
- Usar o mascote como apoio à tarefa e à marca, sem fazê-lo competir com a ação principal, cortar partes importantes ou simular dado funcional.
- Preferir ícones Lucide já usados no site. Não introduzir emojis como ícones estruturais nem misturar bibliotecas sem necessidade.
- Manter aparência profissional, amigável e focada. Evitar excesso de cards, gradientes repetidos, sombras pesadas, glassmorphism e visual infantilizado.

## Uso filtrado da UI/UX Pro Max

A auditoria da release `v2.15.0` produziu uma correspondência útil para `Flashcard & Study Tool`, mas sugeriu claymorphism, Varela Round/Nunito Sans e landing de demonstração. Essas decisões não substituem a identidade atual.

Aceitar como ponto de partida:

- roxo de estudo próximo ao já usado;
- Inter, hierarquia clara e densidade intermediária;
- movimento sutil com estado final imediato em `prefers-reduced-motion`;
- verde para acerto, vermelho para erro e progresso legível;
- foco visível, navegação completa por teclado e alvos de toque adequados.

Rejeitar sem autorização explícita:

- trocar a paleta ou as fontes atuais por uma recomendação automática;
- converter o site para claymorphism, Tailwind ou aparência de aplicativo infantil;
- transformar a entrada em landing genérica com depoimentos, vídeo ou métricas inventadas;
- adicionar GSAP ou qualquer dependência só para animações decorativas;
- persistir um design system gerado com `--force` ou sobrescrever decisões existentes.

## Regras por contexto

### Área pública

- Explicar rapidamente o valor do KAD e oferecer ações claras para entrar e criar conta.
- Não exibir métricas pessoais antes da entrada no ambiente de estudo.
- Não fabricar números de usuários, aprovações, notas ou depoimentos.
- Manter `/entrar`, `/cadastro`, recuperação e confirmação de acesso visíveis e navegáveis.

### Autenticação

- Usar rótulos visíveis, `autocomplete` correto e mensagens próximas ao campo.
- Permitir colar senhas e usar gerenciadores de senha.
- Preservar foco, leitura de erros e funcionamento por teclado.
- Não remover a tela de login nem substituir autenticação por entrada automática.

### Ambiente de estudo

- Exibir métricas somente quando derivadas do estado local ou remoto real; sem dados, usar estado vazio honesto.
- Priorizar ação atual, progresso e próxima decisão. Elementos de motivação não devem ocultar a tarefa.
- Diferenciar corretamente estados de questão, simulado e formulário sem depender apenas de cor.
- Em desktop, aproveitar largura para contexto e navegação; evitar apenas ampliar a composição mobile.

## Verificação visual mínima

- Larguras: 1440, 1024, 768 e 390 px.
- Tema claro e escuro.
- Navegação completa por teclado, foco não encoberto por barras fixas e link para pular ao conteúdo quando aplicável.
- Zoom de 200%, textos longos e ausência de rolagem horizontal.
- `prefers-reduced-motion: reduce` e ações disponíveis sem hover.
- Contraste WCAG 2.2 AA: 4.5:1 para texto normal e 3:1 para componentes/indicadores relevantes.
- Imagens sem deformação, corte acidental ou espaço vazio que prejudique a composição.
- Comparar capturas antes/depois em mudanças visuais amplas.
