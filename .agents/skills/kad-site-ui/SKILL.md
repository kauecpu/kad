---
name: kad-site-ui
description: "Revisar, planejar e implementar UI/UX exclusivamente no KAD Site em site/, incluindo estética, layout, componentes, autenticação web, acessibilidade, responsividade e polimento visual. Usar em toda tarefa visual do site; não usar para o aplicativo Expo/React Native."
---

# KAD Site UI

Tratar o KAD Site como produto web de estudos para concursos, não como site institucional nem cópia literal do aplicativo móvel.

## Fluxo obrigatório

1. Ler `AGENTS.md`, `site/AGENTS.md` e `references/kad-site-constraints.md` por completo.
2. Confirmar que o escopo está limitado a `site/`, salvo autorização explícita do usuário.
3. Inspecionar a tela, os componentes e os tokens existentes antes de propor outra direção visual.
4. Usar `$ui-ux-pro-max`, quando disponível, apenas como evidência consultiva:
   - resolver `scripts/search.py` a partir do diretório real da skill instalada;
   - usar buscas sem dados privados;
   - preferir domínios específicos (`ux`, `style`, `typography`, `color`, `icons`) para problemas pontuais;
   - para direção sistêmica, partir de `flashcard study tool exam`, com variância 4, movimento 3 e densidade 6;
   - verificar categoria e aderência antes de aceitar qualquer resultado.
5. Em redesign amplo, apresentar diagnóstico e proposta antes de modificar a interface. Em correções pontuais já autorizadas, implementar diretamente.
6. Traduzir recomendações para HTML semântico, CSS e JavaScript nativos. Não adicionar Tailwind, React ou outro framework.
7. Preservar rotas, estados de autenticação, conteúdo real e comportamento existente, a menos que a tarefa peça mudanças funcionais.
8. Validar em navegador nos tamanhos definidos na referência, por teclado e com movimento reduzido.
9. Executar `npm run check` em `site/` e depois na raiz.

## Hierarquia de decisão

Aplicar nesta ordem:

1. Pedido atual do usuário.
2. `AGENTS.md` e `site/AGENTS.md`.
3. `references/kad-site-constraints.md` e o código existente.
4. Acessibilidade e funcionamento verificados no navegador.
5. Recomendações da UI/UX Pro Max.

Nunca permitir que uma saída gerada substitua automaticamente a marca, a arquitetura ou os fluxos do KAD.
