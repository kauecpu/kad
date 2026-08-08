# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Frontend do KAD

Este repositório é a fonte oficial do aplicativo/frontend do KAD. O coletor de
questões pertence ao repositório separado `kad-collector` e não deve ser
implementado aqui.

## Fluxo obrigatório para tarefas de implementação

- Antes de alterar arquivos, confira se a árvore de trabalho está limpa e
  atualize a referência da `main`.
- Nunca desenvolva diretamente na `main`. Crie uma branch curta com o prefixo
  `codex/`, baseada na versão mais recente da `main`.
- Preserve alterações de outras pessoas e não inclua mudanças sem relação com a
  tarefa.
- O escopo normal do frontend inclui `app/`, `components/`, `assets/`,
  `constants/`, `hooks/`, `providers/`, `types/`, código cliente em `lib/` e os
  testes correspondentes.
- Não altere `supabase/`, `admin/`, `.github/`, arquivos de ambiente, ingestão de
  dados ou infraestrutura sem pedido explícito do responsável pelo projeto.
- Nunca inclua `.env`, senhas, tokens, cookies, chaves privadas ou a chave
  `service_role` em commits, logs, testes ou Pull Requests.
- Adicione ou atualize testes relevantes e execute `npm run check` antes de
  concluir. Se a tarefa alterar `admin/` com autorização explícita, execute
  também `npm run admin:build`.
- Ao terminar, faça commit, push e abra um Pull Request para `main`, descrevendo
  mudanças e verificações executadas.
- Não faça merge do Pull Request. O merge depende de aprovação do responsável
  pelo projeto.
