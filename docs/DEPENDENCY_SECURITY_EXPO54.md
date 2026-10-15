# Segurança de dependências no Expo 54

Revisão: 15/10/2026, Node 24.20.0 / npm 11.19.0. Substitui a medição de agosto.

## Resultado e compatibilidade

| Pacote / medição | Antes | Depois |
| --- | ---: | ---: |
| App, `npm audit` | 52: 1 crítico, 32 altos, 19 moderados | 44: 0 críticos, 23 altos, 21 moderados |
| App, `npm audit --omit=dev` | não medido nesta revisão antes das alterações | 43: 23 altos, 20 moderados |
| Admin, `npm audit` | 2 altos | 0 |
| Site, `npm audit` | 0 | 0 |

As contagens são pacotes sinalizados, incluindo propagação para dependentes;
não representam 44 vulnerabilidades independentes. Não foi usado `--force` nem
alterada a linha do SDK: Expo 54.0.37, React Native 0.81.5 e React 19.1.0.

Correções versionadas:

- `shell-quote` 1.10.0 → 1.12.0, eliminando o alerta crítico;
- patches compatíveis de `brace-expansion`, `js-yaml`, `@xmldom/xmldom`,
  `compression`, `fast-uri`, `http-cache-semantics`, `source-map-js` e `undici`;
- atualizações de `@react-navigation/core` e `@react-navigation/routers` na linha 7;
- admin: `nanoid` 3.3.16 → 3.3.20 e `source-map-js` 1.2.1 → 1.2.2;
- override limitado a `@expo/metro-config > postcss`, 8.4.49 → 8.5.30. A faixa
  transitiva `~8.4.32` impedia a correção automática; a mudança preserva a API 8.

O mínimo de `react-native-reanimated` passa de `~4.1.1` a `~4.1.7`, preservando
o patch 4.1.7 que já estava no lockfile original. `npm audit fix` tentou voltar
para 4.1.6 por causa da propagação de um alerta de React Native nas peers; essa
troca não corrigia a dependência-base. O patch original foi restaurado e validado.

## Pendências de segurança para a decisão de lançamento

| Dependência-base | Caminho / exposição a avaliar | Correção pendente |
| --- | --- | --- |
| `braces@3.0.3` | Micromatch/Metro, padrões de arquivos durante build | Advisory ainda sem versão corrigida; limitar builds a fontes e padrões confiáveis |
| `node-forge@1.4.0` | CLI e certificados de assinatura do Expo | Advisory ainda sem versão corrigida; revisar uso de assinatura de updates antes da liberação |
| `sprintf-js@1.0.3` | argparse/js-yaml/ferramentas de testes | Advisory afeta até 1.1.3, sem patch disponível na consulta |
| `image-size@1.2.1` | Metro, processamento de assets | Correção está na linha 2; requer adaptação/upgrade validado do consumidor, pois a API muda |
| `decode-uri-component@0.2.2` | query-string/Expo Router | Correção 0.5.0 fora da faixa do consumidor; avaliar deep links/URLs malformadas, inclusive em runtime |
| `uuid@7.0.3` e `3.4.0` | xcode/prebuild e ngrok de desenvolvimento | Correção a partir de 11.1.1 exige mudança de versão principal e validação dos consumidores |

Não classificar todos os resíduos como ferramentas de build: o caminho do Router
pode processar entradas em runtime. Tampouco `--omit=dev` representa o bundle
instalado, pois o pacote Expo inclui ferramentas em suas dependências normais.
Uma migração de SDK deve ser planejada separadamente e não garante resolver
pacotes que ainda não têm patch upstream.

Antes do lançamento, o responsável precisa aprovar uma avaliação de exposição
dos resíduos com prazo de correção, ou bloquear os caminhos afetados/atualizar os
consumidores e repetir a regressão. Esta revisão não declara o app sem alertas.

Manter lockfiles e `npm ci`, evitar builds privilegiados com assets/padrões não
confiáveis e reavaliar os advisories antes de congelar o candidato. Remover o
override de PostCSS quando uma versão compatível do Expo resolver uma versão
corrigida por sua própria faixa.

## Validação

- `npx expo install --check`: compatível após as alterações finais;
- `npx expo-doctor`: 18/18 verificações;
- `npm run check`: testes, ensaio de migrations, TypeScript e lint;
- `npx expo export --platform web`: exportação concluída com configuração de staging;
- transformação CSS pelo `transformPostCssModule` do Metro: plugin executado com PostCSS 8.5.30;
- `npm --prefix site run check`: 145 testes, TypeScript e build;
- `npm run admin:build`: build concluído;
- integração isolada dos PRs 113/115: testes Node/site/HTTP documentados no
  [plano de lançamento](RELEASE_READINESS_2026-10-15.md).

Builds nativos Android/iOS e provas reais de provedores permanecem na próxima
etapa. Os logs completos de execução ficam na workspace local, fora do Git.

## Fontes consultadas

- [Matriz do Expo SDK 54](https://docs.expo.dev/versions/v54.0.0/).
- [Release PostCSS 8.5.30](https://github.com/postcss/postcss/releases/tag/8.5.30).
- [braces: profundidade de padrões](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).
- [node-forge: verificação de assinatura](https://github.com/advisories/GHSA-86w9-cpqp-85rv).
- [image-size: parsers de imagens](https://github.com/advisories/GHSA-5p2g-fcmc-qvqq).
- [decode-uri-component: entrada malformada](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr).
- Advisories adicionais e versões consultados via `npm audit --json` e registry npm
  em 15/10/2026: GHSA-w3rx-r6r6-pgpr, GHSA-hp3w-g68c-fv3c, GHSA-w5hq-g745-h8pq.

