# Como contribuir com o KAD

Este projeto usa um fluxo simples: a branch `main` deve estar sempre estável e toda
alteração entra por Pull Request.

## Organização recomendada

Para separar permissões de verdade, use uma organização no GitHub e repositórios
privados distintos:

- `kad-app`: aplicativo Expo, painel web e integração pública com o Supabase;
- `kad-collector`: scraping, normalização e importação de questões;
- `kad-infra` (opcional): migrações, funções e automações com acesso de produção.

O colaborador de frontend recebe `Write` apenas em `kad-app`. O responsável pelo
coletor recebe `Write` apenas em `kad-collector`. Fundadores responsáveis pela
operação ficam como `Owner` da organização; evite conceder `Admin` sem necessidade.

Uma pasta não é uma barreira de acesso. Se duas pessoas têm acesso ao mesmo
repositório, ambas conseguem ler todo o código dele. `CODEOWNERS` controla revisão,
mas não oculta pastas.

## Branches

Não faça alterações diretamente na `main`. Crie uma branch curta para cada tarefa:

```bash
git switch main
git pull --rebase
git switch -c feat/nome-curto-da-tarefa
```

Prefixos sugeridos:

- `feat/`: funcionalidade nova;
- `fix/`: correção de erro;
- `chore/`: configuração ou manutenção;
- `docs/`: documentação.

Exemplos: `feat/tela-ranking`, `fix/login-android` e
`chore/atualizar-dependencias`.

## Salvando e enviando o trabalho

```bash
git status
git add caminho/do/arquivo
git commit -m "feat: adiciona ranking de usuários"
git push
```

Depois do `push`, abra um Pull Request para `main`, aguarde os testes automáticos e
peça a revisão de outro sócio. Prefira **Squash and merge** para manter um commit
claro por tarefa.

## Atualizando uma branch em andamento

```bash
git fetch origin
git rebase origin/main
git push --force-with-lease
```

Use `--force-with-lease` somente na sua própria branch. Nunca faça force push na
`main`.

## Antes do Pull Request

```bash
npm ci
npm run check
npm ci --prefix admin
npm run admin:build
```

## Segurança

- Nunca envie `.env`, senha, token, cookie ou chave `service_role` ao GitHub.
- O coletor usa credenciais somente no servidor e por meio de GitHub Secrets.
- O aplicativo recebe apenas chaves públicas permitidas para clientes.
- Dados coletados entram primeiro em uma área de revisão; somente conteúdo aprovado
  deve ser publicado para o aplicativo.
- Respeite termos de uso, direitos autorais, limites de requisição e regras das
  fontes consultadas pelo coletor.
