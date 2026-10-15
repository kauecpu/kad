# Segurança de produção do KAD

Estado mais recente e sequência pendente: [rollout de segurança de 2026-10-09](SECURITY_ROLLOUT_2026-10-09.md).
Produção continua até `20260828220803`; a homologação já recebeu a correção Google
`20261009210911` e o validador v2. As fotografias de 2026-10-08 abaixo são históricas.

Este documento separa as proteções versionadas no repositório das configurações
que precisam ser conferidas no painel do Supabase. Nenhum segredo deve ser
copiado para este arquivo, para commits, logs ou Pull Requests.

## Proteções versionadas

Proteções contra abuso e rollout do CAPTCHA estão detalhados em
[`ABUSE_PROTECTION.md`](ABUSE_PROTECTION.md). Essa implementação não significa
que as novas cotas ou o CAPTCHA já estejam ativos nos ambientes remotos.

- Todas as tabelas de aplicação em `public` e `private` usam RLS.
- Funções `SECURITY DEFINER` usam `search_path` vazio e nomes qualificados.
- A migration `202610080001_production_security_baseline.sql` remove execução
  implícita das funções e restaura somente as RPCs revisadas.
- Novas funções, tabelas e sequências não recebem privilégios de cliente por
  padrão; cada migration futura deve conceder somente o acesso necessário.
- O schema `private` não concede acesso direto a tabelas para `anon` ou
  `authenticated`.
- Edge Functions chamadas pelo cliente exigem JWT no gateway. Webhooks sem JWT
  permanecem públicos somente quando validam uma assinatura própria.

## Checklist do painel antes de abrir cadastro público

1. Ativar MFA nas contas proprietárias e, se disponível no plano, exigir MFA
   para a organização.
2. Executar o Security Advisor e o Performance Advisor e registrar qualquer
   exceção intencional.
3. Ativar proteção contra senhas vazadas e definir uma política mínima de senha.
4. Manter confirmação de e-mail habilitada e limitar a validade do OTP a no
   máximo 3.600 segundos.
5. Configurar SMTP próprio usando o domínio do KAD, com SPF, DKIM e DMARC. O
   rastreamento de links do provedor deve ficar desativado para não alterar os
   links de autenticação.
6. Revisar limites de envio, login, OTP, recuperação e renovação de token.
7. Integrar CAPTCHA no app e no site antes de ativá-lo no Supabase; ativá-lo
   primeiro no painel bloquearia clientes que ainda não enviam o token.
8. Confirmar SSL Enforcement, restrições de rede do banco, backups e política
   de recuperação compatíveis com o plano contratado.
9. Conferir URLs de redirecionamento separadas para desenvolvimento,
   homologação e produção, sem curingas amplos em produção.

## Ordem de implantação

1. Reconciliar o histórico de migrations da homologação descrito na auditoria
   abaixo; não usar `db push` enquanto houver versões somente remotas.
2. Aplicar e validar na homologação todas as migrations pendentes, incluindo a
   baseline, e repetir os testes de privilégios e os Advisors.
3. Aplicar o mesmo lote validado em produção e repetir os testes de privilégios.
4. Publicar as Edge Functions usando o `supabase/config.toml` versionado.
5. Configurar proteção de senha, confirmação de e-mail, SMTP e limites.
6. Implementar CAPTCHA nos dois clientes e só então ativá-lo no painel.
7. Liberar as telas de cadastro, confirmação, recuperação e troca de senha.

## Auditoria remota de 2026-10-08

Esta fotografia operacional não contém segredos e deve ser conferida novamente
imediatamente antes do rollout.

- Produção está sincronizada somente até a migration
  `20260828220803_controlled_question_publication.sql`; existem 13 migrations de
  produto anteriores à baseline ainda pendentes.
- Homologação possuía as versões remotas `20260906092557` e `20260906092605`
  sem arquivos locais correspondentes. Um diff por banco shadow confirmou que
  seus objetos correspondiam à migration local
  `20260902052712_study_levels.sql`; o histórico foi reparado em 2026-10-08.
- O Security Advisor retornou 24 avisos em produção e 28 em homologação. Um é a
  proteção contra senhas vazadas desativada; os demais são funções
  `SECURITY DEFINER` executáveis por `authenticated`. A baseline remove os
  privilégios implícitos e mantém somente as RPCs explicitamente revisadas.
  RPCs de entrada que continuarem sinalizadas devem permanecer registradas como
  exceções intencionais e conservar suas verificações internas de identidade ou
  permissão.
- O Performance Advisor encontrou, nos dois ambientes, as FKs
  `question_answer_evidence_import_batch_id_fkey` e
  `questions_withdrawn_by_fkey` sem índice. A baseline cria os índices de apoio.
  Após o rollout em homologação, o Advisor revelou também
  `user_achievements_achievement_key_fkey`; a migration
  `202610080002_security_advisor_followup.sql` adiciona o índice restante.
  Índices marcados apenas como não utilizados não devem ser removidos com base
  nesta fotografia de pouco tráfego.
- SSL do banco está ativo em produção e desativado em homologação. Ambos aceitam
  conexões de qualquer IP (`0.0.0.0/0` e `::/0`), ainda sujeitas à autenticação.
- Backups WALG estão ativos; PITR não está ativo nos dois projetos.
- Confirmação de e-mail está ativa. Em produção a senha mínima tem 12 caracteres,
  mas a proteção contra senhas vazadas ainda precisa ser ativada.
- A URL principal de autenticação em produção continua sendo o deep link móvel;
  o domínio web do KAD ainda precisa entrar na lista explícita de redirects antes
  de habilitar cadastro e recuperação no site.
- A função `delete-account` publicada em produção ainda aceita acesso no gateway
  sem verificação JWT, divergindo do `supabase/config.toml` desta branch. A nova
  configuração deve ser publicada primeiro em homologação e testada antes de
  produção.

### Resultado da homologação em 2026-10-08

- Todas as migrations locais até `202610080002` foram aplicadas.
- O lint remoto não encontrou erros e o Performance Advisor não aponta mais FKs
  sem índice. Os 37 índices sem uso não serão removidos com base no tráfego baixo
  da homologação.
- A allowlist deixou 28 RPCs `SECURITY DEFINER` acessíveis a `authenticated`; a
  função interna legada `admin_save_question_v1` perdeu a execução do cliente.
- Os 143 testes pgTAP passaram no Postgres local com o schema completo. O teste
  via login temporário remoto não pode acessar o schema `extensions` do pgTAP;
  lint e Advisors remotos foram usados como verificação complementar.
- `delete-account` foi publicada com `verify_jwt = true`, e uma chamada anônima
  foi bloqueada com HTTP 401.
- SSL Enforcement não pôde ser ativado pela conta conectada: a API respondeu 403
  por privilégio insuficiente. A proteção contra senhas vazadas também permanece
  pendente de ativação por um proprietário do projeto.
- `validate-google-purchase` e `send-auth-email` não foram publicadas porque os
  secrets específicos ainda não estão configurados em homologação.

Referências oficiais:

- <https://supabase.com/docs/guides/deployment/going-into-prod>
- <https://supabase.com/docs/guides/database/functions>
- <https://supabase.com/docs/guides/functions/auth-headers>
- <https://supabase.com/docs/guides/auth/password-security>
- <https://supabase.com/docs/guides/auth/rate-limits>
- <https://supabase.com/docs/guides/auth/auth-captcha>
