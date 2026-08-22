# Regras do KAD App

Este diretório contém apenas rotas do aplicativo Expo/React Native.

- Não altere `site/` em tarefas exclusivas do aplicativo.
- Use APIs compatíveis com Expo SDK 54 e leia a documentação exata dessa versão
  antes de escrever código.
- Não importe módulos internos de `site/`.
- Compartilhe apenas tipos, contratos e dados puros que não dependam do navegador
  nem de React Native.
- Preserve navegação por Expo Router, acessibilidade e suporte aos temas claro e
  escuro.
- Execute `npm run check` na raiz após alterações.
