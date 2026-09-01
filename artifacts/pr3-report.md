# KAD Site · PR 3 — identidade visual interna (revisão v3.1)

## Escopo

Alterações restritas ao `site/`. O KAD Collector, o app, a landing pública, autenticação, rotas, conteúdo demonstrativo e backend não foram alterados.

## O que mudou

- Criada a camada semântica interna `KAD Internal v3` com temas claro/escuro.
- Roxo (`#6d28d9`) passou a ser a cor de orientação das ações, navegação ativa, ícones e foco.
- Amarelo energia (`#f6c800`, `#ffd84a` no escuro) ficou restrito a progresso, metas e indicadores de avanço.
- Hero interno ganhou uma barra de assinatura dividida: amarelo curto + roxo contínuo.
- Navegação ativa recebeu sinalização roxa e um marcador amarelo discreto.
- Cards de ação, disciplinas, métricas, progresso, abas móveis e estados de foco compartilham os tokens internos.
- Corrigida a flexibilidade mobile do topbar e dos textos de apoio para evitar overflow em 390px.
- Perfil (`/perfil`) recebeu uma exceção neutra: preto/branco/cinza como base, com roxo reservado a estados semânticos e foco.
- Adicionados tokens de suporte semânticos, somente no `.app-shell`: informação (azul), sucesso (verde), atenção (âmbar) e perigo (vermelho), cada um com variantes `soft` e `strong` para claro/escuro.
- Classes semânticas existentes (`badge--success`, `badge--warning`, `badge--danger`, métricas e progresso) passaram a consumir os tokens de suporte, sem alterar rotas, textos ou comportamento.
- Criadas classes utilitárias contidas (`support-info`, `support-success`, `support-warning`, `support-danger`, `support-focus`) para estados novos sem espalhar valores hexadecimais.

## Figma

- Mantida a documentação anterior `KAD Site — Navegação e hierarquia v2`.
- Criada a área `KAD Site — Identidade visual interna v3` no arquivo conectado.
- Criada a área `KAD Site — Identidade interna v3.1 · cores de suporte`, preservando a v3 como referência.
- Exemplos criados: direção/tokens, workspace desktop 1440 e workspace mobile 390×844.
- Coleção criada: `KAD Internal v3 — semantic`, modos `Light` e `Dark`, com tokens de marca e 12 tokens de suporte (base/soft/strong) com sintaxe CSS validada.

## Validação

- `site`: typecheck passou.
- `site`: 46 testes passaram.
- `site`: build passou.
- raiz: lint executado (sem alterações fora de `site/`).
- Navegador: `/inicio` validado em desktop 1440×900 e mobile 390×844.
- Capturas: `pr3-inicio-desktop.png`, `pr3-inicio-mobile.png`, `pr3-profile-neutral-desktop.png`, `figma-v3-desktop.png`, `figma-v31-support.png` e `figma-before-navigation-v2.png`.

## Riscos restantes

- O ambiente local não injeta `VITE_SITE_URL`; o pós-build mantém o aviso esperado e deixa canonical/sitemap para o deploy.
- O exportador de screenshot do Figma reporta largura reduzida ao capturar isoladamente o frame mobile auto-layout; o viewport foi conferido no navegador real e o metadata do Figma confirma 390×844.
- Não foram executados fluxos autenticados contra dados de produção.
- A paleta de suporte foi validada estruturalmente e no protótipo Figma; recomenda-se uma rodada final com conteúdo real para calibrar densidade de badges em cada rota.
