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

