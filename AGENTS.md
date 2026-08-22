# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing any code.

# Frontends do KAD

Este repositório é a fonte oficial dos dois frontends do KAD:

- `app/` e os módulos React Native associados formam o **KAD App** (Expo).
- `site/` forma o **KAD Site** (HTML, CSS e JavaScript para navegadores).

O coletor de questões pertence ao repositório separado `kad-collector` e não
deve ser implementado aqui.

## Limites entre aplicativo e site

- Uma tarefa do app não autoriza alterações em `site/`; uma tarefa do site não
  autoriza alterações em `app/`, `components/`, `hooks/` ou `providers/`.
- O site possui `package.json`, dependências, build, testes, estilos, componentes
  e integrações próprios dentro de `site/`. Não instale dependências web no
  pacote Expo da raiz.
- O site pode consumir os catálogos puros de `data/` e contratos estáveis de
  `contracts/`. Não importe componentes React Native, providers Expo ou módulos
  que dependam de APIs nativas.
- Mudanças em dados ou contratos compartilhados exigem validação dos dois
  frontends. Prefira adaptadores específicos em cada frontend a condicionais de
  plataforma espalhadas pelo código compartilhado.
- Integrações com Supabase devem usar somente a chave pública/`anon` no cliente.
  Nunca exponha `service_role` ou lógica administrativa no app ou no site.
- Consulte também o `AGENTS.md` mais próximo do diretório alterado.

## Fluxo obrigatório para tarefas de implementação

- Antes de alterar arquivos, confira se a árvore de trabalho está limpa e
  atualize a referência da `main`.
- Nunca desenvolva diretamente na `main`. Crie uma branch curta com o prefixo
  `codex/`, baseada na versão mais recente da `main`.
- Preserve alterações de outras pessoas e não inclua mudanças sem relação com a
  tarefa.
- O escopo normal do frontend inclui `app/`, `components/`, `assets/`,
  `constants/`, `hooks/`, `providers/`, `types/`, código cliente em `lib/`,
  `site/` e os testes correspondentes, respeitando os limites acima.
- Não altere `supabase/`, `admin/`, `.github/`, arquivos de ambiente, ingestão de
  dados ou infraestrutura sem pedido explícito do responsável pelo projeto.
- Nunca inclua `.env`, senhas, tokens, cookies, chaves privadas ou a chave
  `service_role` em commits, logs, testes ou Pull Requests.
- Adicione ou atualize testes relevantes e execute `npm run check` antes de
  concluir. Para alterações em `site/`, execute também `npm --prefix site run
  check`. Se a tarefa alterar `admin/` com autorização explícita, execute também
  `npm run admin:build`.
- Ao terminar, faça commit, push e abra um Pull Request para `main`, descrevendo
  mudanças e verificações executadas.
- Não faça merge do Pull Request. O merge depende de aprovação do responsável
  pelo projeto.
