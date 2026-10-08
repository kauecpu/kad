# Segurança de produção do KAD

Este documento separa as proteções versionadas no repositório das configurações
que precisam ser conferidas no painel do Supabase. Nenhum segredo deve ser
copiado para este arquivo, para commits, logs ou Pull Requests.

## Proteções versionadas

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

1. Validar a migration em um projeto descartável ou de homologação.
2. Aplicar a migration em produção e repetir os testes de privilégios.
3. Publicar as Edge Functions usando o `supabase/config.toml` versionado.
4. Configurar proteção de senha, confirmação de e-mail, SMTP e limites.
5. Implementar CAPTCHA nos dois clientes e só então ativá-lo no painel.
6. Liberar as telas de cadastro, confirmação, recuperação e troca de senha.

Referências oficiais:

- <https://supabase.com/docs/guides/deployment/going-into-prod>
- <https://supabase.com/docs/guides/database/functions>
- <https://supabase.com/docs/guides/functions/auth-headers>
- <https://supabase.com/docs/guides/auth/password-security>
- <https://supabase.com/docs/guides/auth/rate-limits>
- <https://supabase.com/docs/guides/auth/auth-captcha>
