# Ambientes do KAD

Este documento define o uso pretendido dos ambientes Supabase. Ele não contém
segredos, chaves, senhas ou dados pessoais.

## Situação atual

| Papel | Projeto | Project ref | Finalidade atual | Branch autorizada |
| --- | --- | --- | --- | --- |
| Validação descartável | `kad-reconciliation` | `txqnvkovdstikgziczyk` | Testar migrations e permissões sem dados reais; pode ser recriado | `codex/reconcile-supabase-schema` |
| Legado protegido / pré-produção | `kad-dev` | `tknxtwwwoqwbzddplzzg` | Ambiente existente com dados reais; não deve receber mudanças sem plano e aprovação | `main`, após PR aprovado |
| Homologação | Não provisionado | Não existe | Validar uma release candidata com dados sintéticos | futura branch de release baseada em `main` |
| Produção | Não provisionado | Não existe | Atender usuários reais após os critérios de lançamento | somente tag/release originada de `main` |

`kad-reconciliation` é exclusivamente um banco de teste. Ele não é um segundo
banco funcional do aplicativo e não deve receber dados reais.

`kad-dev` acumula hoje funções de desenvolvimento e pré-produção. Enquanto
homologação e produção não forem provisionadas, ele deve ser tratado como
ambiente protegido porque já contém dados reais.

## Promoção

1. Toda alteração nasce em branch `codex/*`, com migration e testes versionados.
2. A migration é aplicada primeiro no projeto descartável e validada com perfis
   anônimo, autenticado, administrativo e `service_role`.
3. O Pull Request precisa passar por `npm run check` e revisão humana.
4. Depois do merge em `main`, a mesma migration versionada pode ser promovida ao
   ambiente seguinte. Não se copia schema manualmente pelo painel.
5. Edge Functions só podem ser publicadas quando o bundle publicado corresponder
   a um commit identificável em `main`.
6. Produção só pode receber o artefato já aprovado em homologação. Hoje essa
   promoção permanece bloqueada porque homologação e produção não existem.

## Autoridade e segredos

- Apenas o responsável pelo projeto e mantenedores explicitamente autorizados
  podem alterar banco, histórico de migrations ou Edge Functions.
- Segredos de funções ficam no painel/secret store do Supabase do respectivo
  ambiente.
- Segredos de automação ficam em GitHub Actions Secrets/Environments.
- Segredos locais ficam somente em arquivos ignorados pelo Git.
- Valores de `service_role`, tokens, senhas, cookies e conteúdo de `.env` nunca
  entram em commits, logs, testes, documentação ou Pull Requests.

## Controles antes de lançamento

- Provisionar homologação e produção como projetos separados.
- Configurar proteção e aprovadores no GitHub Environment de produção.
- Ativar proteção contra senhas vazadas no Auth do Supabase.
- Registrar responsáveis e um procedimento de recuperação por ambiente.
- Confirmar que cada Edge Function publicada possui commit, hash e versão no
  relatório de reconciliação.
