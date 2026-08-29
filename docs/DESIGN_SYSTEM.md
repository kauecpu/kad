# Design system do KAD

## Cores semânticas

- `primary`: identidade e ações principais.
- `insight`: análises, evolução e visualizações de dados.
- `success`: acertos e confirmações.
- `danger`: erros e ações destrutivas.
- `warning`: avisos que pedem atenção.

As versões `Soft` servem como fundo. As cores principais servem para texto, ícone e preenchimento. Não use turquesa para sucesso nem verde para análise.

## MetricOverview

Resumo para telas em que uma métrica responde à pergunta principal e as demais apenas explicam o resultado.

- Use uma única métrica dominante.
- Limite os indicadores de apoio aos valores necessários para interpretar o resultado.
- Use `progressLabel` para anunciar o gráfico a leitores de tela.
- Em telas estreitas ou com fontes ampliadas, os indicadores passam automaticamente para uma coluna.
- Não use como grade genérica de números nem repita a métrica dominante nos itens de apoio.

### Estados

| Estado | Comportamento |
| --- | --- |
| Com dados | Valor principal, progresso e indicadores de apoio |
| Vazio | A tela responsável deve explicar como gerar o primeiro dado |
| Carregando | A tela responsável deve manter o cabeçalho e anunciar o carregamento |
| Bloqueado | A tela responsável deve explicar o acesso necessário e oferecer a próxima ação |

## Destaque facetado

`FeaturedCard` continua usando a superfície neutra por padrão. A variante `visual="faceted"` é reservada para o destaque principal da tela e combina:

- `brandSurfaceStrong` e `brandSurfaceDeep` no fundo;
- `onBrand` e `onBrandMuted` para texto;
- arte geométrica decorativa em `KadCardArtwork`;
- `brandTrace` para linhas e transparências discretas.

A arte nunca carrega informação, não recebe toque e fica fora da árvore de acessibilidade. Use no máximo um destaque facetado por tela. Cards de lista, métricas e estados semânticos permanecem neutros.
`KadCardArtwork` oferece variações geométricas (`stack`, `wave`, `diamond`, `ribbon`, `layers` e `signal`); cada tela escolhe uma composição própria sem transformar a arte em ícone funcional.
