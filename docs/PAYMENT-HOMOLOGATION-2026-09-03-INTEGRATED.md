# Pagamentos — validação integrada (continuação do PR #85)

## Resultado e limites

**Correções de concorrência e compatibilidade verificadas; compra Mercado Pago
ainda não homologada.** O PR #85 foi mesclado. Esta continuação parte de
`origin/main`, commit `b5418cab034a5e61562a77943838de58c17545d3`, na branch
`codex/payment-integrated-validation`. Não houve cobrança, compra sandbox,
publicação do site hospedado nem alteração de produção.

## Ambiente e configuração efetivamente verificados

- Homologação: **`npaoyezfwmgauirrlyog`**, nome legado `kad-prod`.
- Produção proibida, não usada: `tknxtwwwoqwbzddplzzg`.
- Plugin Supabase e CLI 2.116.0 autenticados separadamente; login oficial do CLI concluído.
- Configurados apenas `MERCADO_PAGO_LIVE_MODE=false`, `KAD_WEB_APP_URL` e
  `ALLOWED_WEB_ORIGINS`, ambos para `http://127.0.0.1:5182`. A leitura dos
  digests confirmou os três valores esperados, sem expor segredos.
- Faltam token do vendedor de teste, segredo de webhook e e-mail do comprador de
  teste: `MERCADO_PAGO_ACCESS_TOKEN`, `MERCADO_PAGO_WEBHOOK_SECRET` e
  `MERCADO_PAGO_TEST_PAYER_EMAIL`. Nenhuma credencial de produção foi copiada.
- Cadastro de Auth permitido e confirmação de e-mail habilitada. Não foi criada
  conta KAD pelo fluxo de cadastro nesta etapa, nem desativada a confirmação.
- Site compilado pelo comando explícito de homologação, verificando ref e chave
  publicável. Arquivo de ambiente local ignorado pelo Git.
- CORS: prévia exata aceita (OPTIONS 200 e origem correspondente);
  `https://untrusted.invalid` recusada (403 e sem origem autorizada).
- Três funções de cliente recusam POST sem JWT (401). Webhook sem assinatura
  retorna 400 enquanto seu segredo está ausente: evidência de bloqueio por
  configuração, **não** homologação da validação de assinatura com segredo ativo.

## Alterações

1. Ações manuais de atualizar assinatura, cancelar renovação e iniciar checkout
   descartam respostas antigas após troca de usuário, logout, rota, nova tentativa
   ou timeout. Invalidam também o polling anterior.
2. Checkout e cancelamento capturam a sessão do proprietário antes da chamada.
   Sessão divergente não envia a mutação; JWT continua validado pelo servidor.
3. Operações manuais têm prazo e mensagem de resultado desconhecido em falhas
   técnicas. Uma requisição já recebida pelo servidor pode continuar; a interface
   não confunde timeout com recusa nem promete cancelar a operação remota.
4. Reproduzido caso legado: checkout cancelado sem motivo, com transação estornada,
   voltava a pendente após preapproval atrasado. A correção recupera o motivo
   somente a partir de transações correlacionadas, com lock na sessão antes da
   assinatura. Motivos mistos ou outro crédito válido não são inferidos.
5. A migration não muda transações, eventos, períodos de assinatura, preços ou
   crédito. Nova cobrança legítima não herda automaticamente o estorno anterior.

## Publicação no Supabase de homologação

Migration aplicada: `20260903043158_payment_legacy_terminal_compatibility.sql`.
Criada inicialmente com `supabase migration new`; após aplicação pelo MCP, o nome
local foi alinhado à versão remota atribuída. Não houve reaplicação nem registro
duplicado dessa migration. Espelhos históricos do PR #85 foram preservados.

Funções existentes conferidas e mantidas, sem redeploy nesta continuação:

| Função | Versão | JWT de gateway |
| --- | --- | --- |
| create-payment-checkout | v4 ACTIVE | Obrigatório |
| cancel-subscription | v4 ACTIVE | Obrigatório |
| reconcile-payment-checkout | v2 ACTIVE | Obrigatório |
| mercado-pago-webhook | v5 ACTIVE | Desabilitado; autenticação própria HMAC |

Antes/depois dos testes: 0 checkouts, 0 transações, 0 eventos de webhook,
0 assinaturas e 0 usuários de fixtures `@test.invalid`. Ensaios pgTAP usam
BEGIN/ROLLBACK; não deixam contas nem registros financeiros de teste.

## Validação técnica

| Camada | Evidência e resultado |
| --- | --- |
| Repositório | 435 testes, typecheck e lint aprovados (`npm run check`) |
| Site | 67 testes, typecheck e build aprovados; sem script de lint próprio |
| Build de homologação | `npm run site:build:staging` aprovado |
| Administração | Build aprovado; aviso preexistente de bundle acima de 500 kB |
| Edge Functions | Deno 2.9.6: check das quatro funções aprovado |
| Banco descartável | PGlite: oito migrations financeiras; legado, crédito, correlação, isolamento e idempotência aprovados |
| PostgreSQL Supabase | 80/80 asserts pgTAP aprovados, em transação revertida |
| HTTP remoto | JWT e CORS conferidos conforme seção de configuração |
| Supabase local completo | Bloqueado: Docker iniciado, engine Linux indisponível (`LegacyDockerLifecycleInspectError`/named pipe) |
| Navegador + provedor | Não executado; depende de credenciais de teste, Auth e acesso à aplicação Mercado Pago |

Saída sanitizada do PostgreSQL real:
[80 verificações pgTAP](evidence/payments-pgtap-2026-09-03-integrated.txt).
PGlite é PostgreSQL WASM com bootstrap mínimo de Auth, não a pilha Supabase completa.
Os testes de escopo do site exercitam funções isoladas e não substituem cliques
reais, login e troca de conta entre abas no navegador.

Security Advisor: 11 INFO e 24 WARN preexistentes, 0 ERROR. Avisos de policies e
funções security definer mais amplos não foram declarados corrigidos por este PR.
O CI remoto deve ser conferido no PR; a tabela acima registra execuções locais
e consultas remotas, não presume o resultado de um workflow ainda não executado.

## Matriz solicitada

Em todas as linhas o alvo integrado é exclusivamente homologação. “Bloqueado”
significa que a cadeia completa navegador → provedor → webhook → acesso não foi
executada, mesmo quando o complemento automatizado passou.

| # | Cenário/procedimento | Esperado | Observado e camada efetiva | Status integrado |
| --- | --- | --- | --- | --- |
| 1 | POST checkout sem JWT | Recusar sem criar sessão | HTTP 401 remoto | Aprovado |
| 2 | Enviar plano/ciclo inválido com conta de teste | Recusar catálogo inválido | Validações de contrato locais; falta sessão Auth real | Bloqueado |
| 3 | Comprar mensal/trimestral/anual | Usar preço e duração do servidor | Contratos e SQL aprovados; nenhuma assinatura no provedor | Bloqueado |
| 4 | Cartões sandbox aprovado/recusado/pendente | Estado coerente e acesso só após aprovação | SQL/contratos aprovados; sem cartão testado no provedor | Bloqueado |
| 5 | Pix aprovado/pendente se suportado | Mesmo controle de crédito | Suporte dessa modalidade/ambiente ainda não comprovado | Bloqueado |
| 6 | Retornar antes do webhook | Aguardar sem liberar pela URL | Polling/estado do site e banco testados isoladamente | Bloqueado |
| 7 | Receber webhook antes do retorno | Ler acesso confirmado | Estado do banco testado; sem evento real do provedor | Bloqueado |
| 8 | Reenviar o evento | Não duplicar crédito/período | pgTAP/PGlite idempotentes | Bloqueado |
| 9 | Inverter ordem de eventos | Não reabrir pagamento terminal | pgTAP/PGlite aprovados, incluindo legado sem motivo | Bloqueado |
| 10 | Receber sem correlação e recuperar | Aplicar apenas após vínculo válido | Contratos/banco testados; sem reenvio do provedor | Bloqueado |
| 11 | Divergir valor/moeda/referência | Recusar concessão | Contratos/banco aprovados | Bloqueado |
| 12 | Cancelar renovação | Preservar período pago | pgTAP e escopo das ações manuais aprovados | Bloqueado |
| 13 | Simular estorno/chargeback e evento antigo | Revogar crédito correspondente sem reativar | 80 asserts incluem casos terminais e nova cobrança legítima | Bloqueado |
| 14 | Timeout, indisponibilidade, rate limit e retry | Encerrar espera sem aprovar nem confundir com recusa | Testes locais de contratos/polling/ações; sem falha induzida no provedor | Bloqueado |
| 15 | Conta B acessar dados de A | RLS/RPC recusarem; resposta antiga descartada | pgTAP entre papéis e testes de sessão; falta dupla de logins reais | Bloqueado |
| 16 | Novo login e sincronização entre clientes | Mesmo período validado no backend | Não executado com duas sessões Auth reais | Bloqueado |

Não marcar Pix como “não aplicável” sem confirmar a limitação na modalidade
utilizada. Não provocar contestação real; se não houver simulação oficial,
registrar a limitação e manter evidência de contrato/banco separada.

## Próximas ações humanas e retomada

1. No Mercado Pago Developers, abrir **Suas integrações** e identificar a
   aplicação destinada a testes. Compartilhar apenas a lista/nome, sem credenciais.
2. Na aplicação, confirmar vendedor e comprador de teste brasileiros. Verificar
   titularidade da aplicação/credencial pelo vendedor, nunca só pelo prefixo.
3. Pelo painel seguro da homologação Supabase, cadastrar as três configurações
   faltantes. Não enviar token, segredo, senha ou código de verificação no chat.
4. Configurar URL da função de webhook e eventos usados pela integração; conferir
   o segredo correspondente. Após isso, testar HMAC inválido e evento válido.
5. Confirmar retorno da prévia. Se o provedor exigir HTTPS, preparar endereço
   específico de homologação, sem publicar produção.
6. Criar duas contas KAD descartáveis pelo cadastro e confirmar os e-mails
   diretamente nas caixas controladas pelo responsável. Em seguida, executar
   isolamento autenticado, compra sandbox e a matriz acima.

O painel aberto no navegador interno não foi inspecionado por automação nesta
etapa. A tentativa anterior de Computer Use foi encerrada pela própria ferramenta
por não conseguir validar a URL do navegador; não houve acesso alternativo a
cookies, perfis ou tokens.

## Rollback e promoção (não executados)

- Frontend: retornar à versão anterior do site, preservando registros de pagamento.
  Nunca “corrigir” histórico apagando sessões, transações ou assinaturas.
- Antes da migration foi preservada a definição remota de
  `private.sync_mercado_pago_subscription` fora do Git em
  `C:\Users\igord\Documents\Codex\KAD\payment-homologation-backup-20260903-integrated\sync-subscription-before.sql`.
  Isso é cópia da função afetada, não backup integral do banco.
- Se necessário, criar migration compensatória revisada a partir dessa definição.
  Restaurar a função antiga reintroduz o risco legado; preferir correção adiante.
  Não apagar motivos recuperados. Helper privado pode permanecer sem grants.
- Pré-requisitos de promoção: matriz sandbox concluída/limitações justificadas,
  duas contas Auth validadas, HMAC testado com segredo ativo, retorno/origem HTTPS
  conferidos, CI verde e revisão humana, backup integral verificado e confirmação
  explícita do destino. Não executar todas as migrations pendentes indiscriminadamente.
- Este PR não autoriza cobrança real nem mudança na produção. Merge permanece manual.
