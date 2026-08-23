# Segurança de dependências no Expo 54

Data da revisão: 2026-08-23

## Escopo e decisão

Esta revisão atualiza somente versões compatíveis com o Expo SDK 54. Não foi
usado `npm audit fix --force`, não foram adicionados `overrides` não suportados
e não houve migração para outro SDK.

O Expo 54 permanece alinhado a React Native 0.81 e React 19.1. O comando
`npx expo install --check` é a fonte de compatibilidade das dependências nativas
declaradas pelo aplicativo.

## Resultado

| Medição | Antes | Depois |
| --- | ---: | ---: |
| `npm audit` | 23 (12 altos, 11 moderados) | 20 (9 altos, 11 moderados) |
| `npm audit --omit=dev` | 22 (12 altos, 10 moderados) | 19 (9 altos, 10 moderados) |
| Críticos | 0 | 0 |

As correções seguras atualizaram, entre outras dependências:

- `expo`: 54.0.36 para 54.0.37;
- `expo-constants`: 18.0.13 para 18.0.14;
- `@expo/cli`: 54.0.26 para 54.0.27;
- `brace-expansion`: 1.1.18, 2.1.4 e 5.0.9 nas respectivas cadeias;
- `js-yaml`: 3.15.1 e 4.3.1;
- `nanoid`: 3.3.18;
- `ws`: 8.21.3 na cadeia do Expo.

A faixa declarada de `@react-navigation/drawer` foi normalizada para a faixa
recomendada pelo Expo 54 (`^7.5.0`). O lockfile continua resolvendo 7.13.9.

## Alertas residuais

Os 20 pacotes marcados restantes são propagação de três dependências-base nas
ferramentas do Expo/Metro:

| Dependência-base | Severidade do npm | Caminho no KAD | Situação no Expo 54 |
| --- | --- | --- | --- |
| `image-size@1.2.1` | alta | `metro` | não há correção aceita pelo audit sem migração principal do Expo |
| `postcss@8.4.49` | alta | `@expo/metro-config` | a correção automática propõe Expo 57 |
| `uuid@3.4.0` e `uuid@7.0.3` | moderada | `xcode` e `@expo/ngrok` | a correção automática propõe Expo 57 |

Esses caminhos pertencem principalmente a empacotamento, configuração,
prebuild e túnel de desenvolvimento. A contagem com `--omit=dev` ainda inclui
parte dessas ferramentas porque o pacote `expo` as declara em sua própria
árvore de dependências; portanto ela não equivale ao código JavaScript que roda
no aplicativo instalado.

## Controles mantidos

- usar o lockfile versionado e `npm ci` na integração contínua;
- não executar builds privilegiados com assets não confiáveis;
- acompanhar novos patches do Expo 54 e repetir `npm audit fix` sem `--force`;
- tratar a futura atualização de SDK como uma migração própria, com validação
  nativa e regressão completa;
- não usar `npm audit fix --force` nesta linha do produto.

## Verificações desta revisão

- `npx expo install --check`: dependências atualizadas;
- `npx expo-doctor`: 18 de 18 verificações aprovadas;
- `npm run check`: testes, TypeScript e lint;
- `npx expo export --platform web`: exportação web de produção;
- `npm audit` e `npm audit --omit=dev`: risco residual medido acima.

