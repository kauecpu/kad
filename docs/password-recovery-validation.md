# Recuperação de senha do site — 06/10/2026

## Resultado

Correções locais de diagnóstico e proteção do fluxo implementadas. **Recuperação
real por e-mail ainda não homologada.** Nenhum e-mail enviado nesta atividade,
nenhuma senha alterada em conta real, nenhuma importação/publicação de questões.

Base: `origin/main` em `b388ac8`, branch `codex/site-password-recovery`, checkout
isolado `kad-password-recovery`. Checkout principal sujo e servidores anteriores
preservados. Não houve alteração em Expo, admin, Supabase, ambientes ou dependências.

## Evidências e limites do diagnóstico

| Evidência | Conclusão permitida |
|---|---|
| Allowlist da homologação tinha `/auth/nova-senha`; site solicita `/nova-senha` com `sb_flow_id` | Configuração incompatível, corrigida na atividade anterior. Não prova a causa completa do primeiro retorno |
| Auth: `/recover` 200 às 19:53:51 e 19:53:53 UTC; `/verify` aceito às 19:54:06 | Dois pedidos aceitos e um link verificado; não prova conclusão do callback no site |
| `/recover` 429 `over_email_send_rate_limit` às 19:54:14 | Reenvio bloqueado pelo serviço, não pelo formulário |
| Retorno posterior de verificação recusado; nenhuma troca PKCE observada nessa janela | Reutilização/expiração posterior confirmada nos logs anteriores; motivo do primeiro callback continua aberto |
| Código transformava todo erro de troca PKCE em “expirou ou já foi utilizado”; view descartava o diagnóstico | Falha reproduzida por testes com verificador ausente e erro de rede |
| Código aceitava sucesso de troca sem conferir `redirectType` | Um callback não destinado a recovery liberava o formulário de recuperação no cliente; teste reproduziu e correção exige `recovery` |
| Sem trava para submit concorrente | Cliques simultâneos podiam iniciar pedidos distintos; não se afirma que essa foi a origem dos dois envios observados |

Não há evidência suficiente para atribuir o primeiro erro ao navegador usado pelo
usuário. Trocar de navegador é uma condição reproduzida em simulação, não uma
conclusão sobre o incidente.

## Correções

- Mensagens por código: verificador ausente, sessão incompatível, expiração,
  expiração/ou uso, limite de envio, rede, falha técnica e senha recusada.
  `otp_expired` e `flow_state_not_found` **não distinguem sozinhos** uso de expiração.
- Callbacks com origem/rota incorretas, parâmetros duplicados, fragmentos de
  tokens ou erros misturados não liberam troca de senha. Descrição remota nunca
  é exibida. URL é limpa antes da chamada assíncrona.
- Somente troca PKCE confirmada como recuperação libera a operação; identidade
  é novamente consultada antes da atualização. Nenhum indicador local persistido
  pode conceder esse acesso.
- Pedidos simultâneos compartilham uma chamada; formulário fica ocupado e há
  intervalo local de um minuto após sucesso/429. Não há retry automático.
  Esse intervalo não promete que o limite do provedor foi liberado.
- Senha alterada leva ao login. Há tentativa de encerrar outras sessões e a
  sessão local. Falha de logout é informada separadamente, sem dizer que a senha
  não mudou. Troca autenticada comum continua exigindo senha atual.

**Limitação preservada:** atualizar/fechar a página após validar o callback
encerra a autorização em memória. O site explica a interrupção e exige novo
fluxo; não restaura a autorização com `localStorage`, query string ou uma sessão
comum. O formulário avisa para não atualizar antes de salvar. Não foi implementada
retomada persistente da recuperação.

## Validação local

| Cenário | Prova |
|---|---|
| Pedido → callback válido → nova senha → logout | SDK instalado e transporte HTTP totalmente simulado; sessão final ausente |
| Link expirado/reutilizado | Códigos simulados, mensagem adequada e formulário fechado |
| Outro navegador sem verificador | Cliente SDK com storage separado; recusa antes de `/token` |
| Atualização de página | Nova instância não herda autorização; navegador mostra instrução de reinício |
| Rede indisponível / 429 | Erros tratados, sem sucesso falso ou reenvio automático |
| Cliques repetidos | Uma chamada; intervalo local bloqueia segundo pedido imediato |
| Callback não recovery / parâmetros ambíguos | Recusa e nenhuma chamada de atualização |
| Conta mudou / sessão inválida | Bloqueio antes de alterar senha |
| Falha ao encerrar sessões | Senha alterada é distinguida da falha posterior |
| Retorno ao login e limpeza da URL | Contrato da ligação no `main.ts`; limpeza também observada no navegador |

Comandos:

```text
npm run check
npm --prefix site run check
npx eslint site/src/core/auth-callback.ts site/src/core/password-security.ts site/src/core/password-recovery.ts site/src/services/supabase.ts site/src/main.ts site/src/views/public.ts site/tests/password-recovery.test.ts site/tests/password-recovery-sdk.test.ts site/tests/domain.test.ts --max-warnings=0
git diff --check
```

Raiz: 492 testes passaram, tipos e lint passaram. Site: 102 testes, tipos e
build passaram. Lint direcionado e diff-check passaram. A primeira tentativa de
build teve EPERM do sandbox do Windows ao ler dependências do Vite; repetida com
permissão local, passou. Avisos existentes de bundle >500 kB e ausência de
`VITE_SITE_URL` no build local permanecem. `npm ci --ignore-scripts` preservou os
lockfiles; auditoria reportou 52 vulnerabilidades na raiz e 8 no site, não
corrigidas neste escopo.

Navegador: prévia isolada em `http://127.0.0.1:5199/`, **sem Supabase configurado**.
Erros usados na URL são fixtures sem credenciais. Conferidos temas claro/escuro,
retorno por teclado, atualização da página e ausência de overflow horizontal em
desktop e celular. Capturas em `docs/evidence/password-recovery/` não comprovam
autenticação real.

## Próxima validação real

Existe uma única automação neste chat para 06/10 às 17h55 de Brasília:
`retomar-recupera-o-de-acesso-kad`. Conferida ativa, sem nova automação ou reenvio.
Não substituir servidores nem iniciar nova solicitação durante a revisão local.
Antes do teste real, servir a branch corrigida na origem autorizada
`http://127.0.0.1:5198`, preservando o estado do navegador; a prévia 5199 não é o
ambiente de envio. A origem, inclusive a porta, precisa ser a mesma no pedido e
no callback, com o caminho permitido na configuração do projeto.

O teste real permanece pendente: envio aceito → abrir o link completo no
navegador do pedido → usuário define e envia a nova senha → login com ela.
Não pedir senha no chat, não reutilizar links consumidos nem contornar PKCE.

Somente homologação `npaoyezfwmgauirrlyog` (nome legado kad-prod). Não tocar
produção `tknxtwwwoqwbzddplzzg`. Lote de dez questões e papel editorial temporário
permanecem como estavam; nenhuma etapa de importação faz parte deste PR.

Referências: [PKCE](https://supabase.com/docs/guides/auth/sessions/pkce-flow),
[recuperação](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail),
[limites de envio](https://supabase.com/docs/guides/auth/rate-limits).
