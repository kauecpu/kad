# Guia rápido de Git e GitHub do KAD

## Git e GitHub não são a mesma coisa

`Git` registra versões no computador. `GitHub` hospeda o repositório, Pull Requests,
revisões, permissões e testes automáticos.

## Fluxo diário

1. Abra uma tarefa pequena e bem definida.
2. Atualize a `main` com `git pull --rebase`.
3. Crie uma branch com `git switch -c feat/minha-tarefa`.
4. Faça alterações e acompanhe com `git status` e `git diff`.
5. Crie commits pequenos e objetivos.
6. Envie a branch com `git push`.
7. Abra um Pull Request, espere o teste `quality` e solicite revisão.
8. Faça **Squash and merge** e apague a branch remota.

## Comandos essenciais

| Objetivo | Comando |
| --- | --- |
| Ver a situação atual | `git status` |
| Ver alterações | `git diff` |
| Atualizar referências | `git fetch origin` |
| Criar uma branch | `git switch -c feat/nome` |
| Trocar de branch | `git switch nome` |
| Preparar um arquivo | `git add caminho/arquivo` |
| Criar um commit | `git commit -m "tipo: descrição"` |
| Enviar a branch | `git push` |
| Atualizar a branch | `git rebase origin/main` |
| Cancelar um rebase com conflito | `git rebase --abort` |

## Divisão dos quatro sócios

| Papel | Acesso recomendado | Responsabilidade |
| --- | --- | --- |
| Responsável técnico | Owner da organização | Segurança, arquitetura e produção |
| Sócio frontend | Write em `kad-app` | Telas, componentes e experiência do usuário |
| Sócio coletor | Write em `kad-collector` | Captura, normalização e qualidade das questões |
| Quarto sócio | Read, Triage ou Maintain conforme a função | Produto, conteúdo ou operação |

Comece sempre com o menor acesso necessário. Ele pode ser aumentado depois.

## Integração entre aplicativo e coletor

O coletor não deve alterar arquivos do frontend. Ele envia dados normalizados para
uma área de entrada no banco. Um processo de validação aprova o conteúdo e publica
somente os registros prontos para consumo pelo aplicativo.

Contrato mínimo sugerido para uma questão:

- identificador externo e fonte;
- enunciado e alternativas;
- resposta correta e explicação, quando licenciada;
- disciplina, assunto, banca, órgão, cargo e ano;
- URL e data da coleta;
- estado de revisão (`pending`, `approved` ou `rejected`).

Assim o frontend depende de um formato estável, não da implementação do scraper.
