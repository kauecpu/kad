# Pagamentos web — continuação da homologação

Registro histórico do PR #85. Para o login CLI concluído, configuração parcial de
homologação, correções adicionais e 80 asserts pgTAP, consulte
[a continuação integrada](PAYMENT-HOMOLOGATION-2026-09-03-INTEGRATED.md).

## Resultado

**Homologação integrada do Mercado Pago ainda bloqueada; correções e validação do
banco concluídas nesta etapa.** Nenhuma compra foi criada, nenhuma cobrança real
foi feita e produção não foi alterada. PR #84 já estava mesclado; este trabalho
continua em `codex/mercado-pago-homologation`, a partir de `main`.

Datas dos registros abaixo são UTC (execução iniciada em 02/09 no horário de Brasília).

## Ambiente e preservação

- Projeto confirmado pelo MCP e `docs/ENVIRONMENTS.md`: **`npaoyezfwmgauirrlyog`**,
  nome legado `kad-prod`, homologação, PostgreSQL 17.6.
- Produção `tknxtwwwoqwbzddplzzg` não foi usada. Nomes não foram usados para escolher destino.
- O MCP Supabase está autenticado. O login oficial independente do CLI 2.116.0 foi
  iniciado e aguarda o código inserido pelo responsável no terminal, não no chat.
- Antes/depois dos testes: 0 sessões financeiras, 0 transações, 0 eventos de
  webhook, 0 assinaturas; 0 usuários do namespace de teste remanescentes.
- pgTAP executado em `BEGIN`/`ROLLBACK`: fixtures, extensão de teste quando necessária,
  tabelas temporárias e alterações do ensaio foram revertidas. Dados editoriais não foram tocados.
- As três funções anteriores (v3) e definições SQL substituídas foram preservadas,
  sem segredos, fora do Git em
  `C:\Users\igord\Documents\Codex\KAD\payment-homologation-backup-20260903`.
  Isso é recuperação do código afetado, **não** um backup integral do projeto.
  Não houve transformação ou remoção de registros financeiros existentes.
- Criado apenas o arquivo local ignorado `.env.staging.local`, com a chave publicável
  de homologação. `site:build:staging` verificou a chave no projeto correto e compilou.
  Isso não muda a configuração de outras prévias já abertas em outras branches.

## Publicação efetivamente realizada

| Componente | Estado em homologação |
| --- | --- |
| `20260902150000_payment_checkout_reconciliation.sql` (PR #84) | Aplicada; coluna de reconciliação e RPC protegida disponíveis |
| `20260903014225_payment_atomic_status_reason.sql` | Aplicada; estado e motivo financeiro gravados atomicamente |
| `create-payment-checkout` | v4, ACTIVE, JWT obrigatório |
| `cancel-subscription` | v4, ACTIVE, JWT obrigatório |
| `reconcile-payment-checkout` | v2, ACTIVE, JWT obrigatório e filtro por proprietário |
| `mercado-pago-webhook` | v5, ACTIVE, autenticação própria por HMAC, bloqueado sem segredo |

O MCP atribuiu inicialmente `20260903013128` à migration canônica de reconciliação.
O SQL remoto foi comparado integralmente com o arquivo canônico (normalizando CRLF).
Após igualdade, a versão `20260902150000` também foi registrada como aplicada no
histórico, sem executar novamente o SQL nem apagar o registro original. O arquivo
`20260903013128_payment_checkout_reconciliation.sql` é um espelho histórico sem SQL,
como o padrão já usado neste repositório. Isso evita reaplicar a versão antiga por
engano depois da correção nova. Demais migrations pendentes, não financeiras, não
foram publicadas; não executar `db push` indiscriminadamente.

## Correções verificadas

1. Testes financeiros usavam datas fixas vencidas: o cancelamento esperava período
   ainda pago, mas a fixture já havia expirado. Datas agora relativas à transação.
   Falha reproduzida antes da correção: 48/49; suíte ampliada final: **71/71**.
2. O site confundia configuração ausente com falha temporária quando o estado era
   `unavailable`. Configuração agora tem mensagem específica e não oferece retry inútil.
3. Retry da mesma sessão, retorno à rota e troca de usuário podiam reutilizar o
   identificador de uma consulta antiga. Cada execução agora tem identidade própria.
4. Consultas sem resposta possuem prazo de 12 s por chamada. Ao terminar as
   tentativas, leitura desconhecida aparece como indisponibilidade, não recusa nem
   pendência supostamente confirmada. Aprovação conhecida não vira pendência.
5. As Edge Functions gravavam motivos depois da RPC, fora da transação protegida.
   Um evento antigo podia apagar o motivo terminal que o banco havia preservado.
   A RPC agora escreve estado/motivo sob o mesmo lock; os writes redundantes foram
   removidos. Preapproval não reabre checkout estornado nem substitui o motivo de
   estorno/contestação por cancelamento comum.

Não foram alterados preços, ciclos, contratos públicos, formato de exportação,
compras Apple/Google, regras de crédito ou as permissões de clientes.

## Validações e limites da evidência

| Camada | Resultado |
| --- | --- |
| Repositório | 435 testes, typecheck e lint aprovados |
| Site | 58 testes, typecheck e build aprovados; não possui script próprio de lint |
| Build explícito de homologação | Aprovado, ref e chave publicável verificados |
| Quatro Edge Functions | `deno check` aprovado, Deno 2.9.6 |
| PostgreSQL local descartável | PGlite já existente no projeto: sete migrations financeiras, idempotência, motivos e isolamento aprovados; executado também pelo teste normal do CI |
| PostgreSQL Supabase | 71 asserts pgTAP aprovados; saída em [evidence/payments-pgtap-2026-09-03.txt](evidence/payments-pgtap-2026-09-03.txt) |
| Supabase local/Docker | Bloqueado: Docker Desktop foi iniciado, mas backend falhou com timeout de WSL/erro no socket interno. Não houve reset, reinstalação, alteração de BIOS ou reinício |
| Compra no provedor | Não executada; não confundir testes de contrato/SQL com compra sandbox |

O PGlite é PostgreSQL em WASM com bootstrap de Auth mínimo, não a pilha Supabase
completa. O pgTAP remoto exercitou o projeto Supabase real, mas em transação de teste,
sem passar pelo Mercado Pago. O CI não executa a pilha Docker/pgTAP atualmente.

Security Advisor após deploy: 11 avisos informativos de RLS sem policy e 24 avisos
de funções `SECURITY DEFINER` disponíveis a `authenticated`, nenhum nível ERROR.
Isso não equivale a uma auditoria de segurança completa. A RPC financeira de leitura
é intencionalmente owner-scoped e foi testada com duas identidades. Os demais avisos
não financeiros não foram alterados. [Critério do advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

## Matriz de cenários

“Aprovado” abaixo sempre identifica a camada efetivamente testada.

| # | Cenário | Contrato/banco | Integração HTTP/provedor |
| --- | --- | --- | --- |
| 1 | Checkout sem autenticação | Aprovado: grants/RPC | Aprovado HTTP: criar, cancelar e reconciliar retornaram 401 sem JWT |
| 2 | Plano/ciclo inválido | Aprovado: catálogo server-side | Bloqueado: falta sessão KAD descartável |
| 3 | Mensal/trimestral/anual | Aprovado: valores/frequências de contrato | Bloqueado: nenhuma assinatura criada no provedor |
| 4 | Cartão aprovado/recusado/pendente | Aprovado: parsers, estados e SQL | Bloqueado: credencial/contas/cartão de teste não verificados |
| 5 | Pix aprovado/pendente | Não testado | Bloqueado/não confirmado: a disponibilidade na modalidade recorrente integrada precisa ser verificada; não criar outro checkout para forçar Pix |
| 6 | Retorno antes do webhook | Aprovado: contrato da reconciliação; URL não concede acesso | Bloqueado: não reproduzido com provedor |
| 7 | Webhook antes do retorno | Aprovado: estado autoritativo e mensagens | Bloqueado: não reproduzido com provedor |
| 8 | Reenvio do mesmo evento | Aprovado SQL: crédito não duplica período | Bloqueado: sem webhook HMAC real do sandbox |
| 9 | Fora de ordem | Aprovado SQL: marcadores terminais e motivos preservados | Bloqueado no provedor |
| 10 | Evento inicialmente sem correlação | Aprovado em contrato: fica elegível a nova tentativa | Bloqueado: recuperação completa não exercitada no provedor |
| 11 | Valor/moeda/referência divergentes | Aprovado: parsers e SQL recusam divergências e pagamento cruzado | Bloqueado no provedor |
| 12 | Cancelar renovação preservando período | Aprovado pgTAP e PGlite | Bloqueado: cancelamento remoto não executado |
| 13 | Estorno/chargeback e eventos antigos | Aprovado pgTAP e PGlite: acesso não reativado pelo replay e motivo preservado | Bloqueado no provedor |
| 14 | Timeout/indisponibilidade/rate limit | Aprovado: mocks de rede, escopo de consulta e limites SQL | Bloqueado para falha real do provedor |
| 15 | Dados de outro usuário | Aprovado: roles reais no pgTAP, RLS e RPC owner-scoped | Bloqueado: falta login de duas contas via Auth |
| 16 | Novo login e sincronização entre clientes | Aprovado em contrato: mapeamento/expiração | Bloqueado: nenhum novo login/sessão multi-cliente exercitado |

## Configuração: o que foi realmente confirmado

| Item | Evidência/pendência |
| --- | --- |
| Origens permitidas | OPTIONS de `http://localhost:8082`: 200 com origem exata; `http://127.0.0.1:5179`: 403; origem não confiável: 403 |
| Segredo do webhook | Payload válido sem assinatura retornou 400 `Invalid webhook`. No código publicado, isso indica segredo ausente/vazio. Falhou fechado antes de gravar eventos; HMAC com segredo válido ainda não homologado |
| Access token Mercado Pago | Não inspecionado/verificado; MCP não oferece leitura de configuração de segredos das funções |
| Modo `false` e comprador de teste | Não verificados remotamente; não inferir pelo nome do projeto ou prefixo da credencial |
| URL de retorno | Não verificada remotamente; a URL da prévia precisa corresponder ao ambiente escolhido |
| Login CLI | Fluxo oficial iniciado; aguardando participação humana. Isso não bloqueou SQL/deploy via MCP |

Não habilitar wildcard de CORS, desativar JWT nem remover assinatura para contornar
esses bloqueios. Não usar credenciais da conta real para homologar.

## Próxima ação humana e retomada

1. Concluir o login oficial do Supabase no navegador e digitar o código apenas no
   terminal do login. Se a sessão expirar, iniciar outro `supabase login`; não enviar
   token/código pelo chat. Alternativamente, editar pelo painel autorizado de
   [homologação](https://supabase.com/dashboard/project/npaoyezfwmgauirrlyog/functions/secrets).
2. Em [Suas integrações do Mercado Pago](https://www.mercadopago.com.br/developers/panel/app),
   preparar vendedor e comprador **de teste**, ambos Brasil, e a aplicação do vendedor
   de teste. O responsável conclui login/2FA/consentimento diretamente no serviço.
3. Configurar somente nesse Supabase: `MERCADO_PAGO_ACCESS_TOKEN` do vendedor de teste,
   `MERCADO_PAGO_WEBHOOK_SECRET` da aplicação de teste, `MERCADO_PAGO_LIVE_MODE=false`,
   `MERCADO_PAGO_TEST_PAYER_EMAIL`, `KAD_WEB_APP_URL` e `ALLOWED_WEB_ORIGINS` com origem exata.
   Não publicar valores no relatório. O painel/CLI oficial armazena os segredos.
4. Confirmar identidades de teste; criar contas KAD descartáveis pelo fluxo oficial,
   testar login e então executar a matriz integrada. Um token `APP_USR` não prova
   conta real nem conta de teste: conferir a conta proprietária, não apenas prefixo.
5. Corrigir o Docker com o responsável antes da validação da pilha Supabase local;
   o botão de factory reset não foi usado, pois pode apagar dados locais.

[Contas de teste — documentação oficial](https://www.mercadopago.com.br/developers/en/docs/subscriptions/additional-content/your-integrations/test/accounts)
e [compra de teste em Assinaturas](https://www.mercadopago.com.br/developers/en/docs/subscriptions/integration-test/payment-approval)
foram consultadas. O procedimento documentado usa cartão de teste e dados do usuário
de teste; não se assume suporte a Pix a partir de outra modalidade de checkout.

## Rollback e promoção

- Preferir rollback de código para o commit anterior/republicação dos snapshots v3,
  mantendo as migrations aditivas. A função nova de reconciliação pode permanecer
  protegida e sem consumidores; não apagar sessões/eventos para desativá-la.
- A versão atual do webhook exige a migration atômica: publicar banco antes das
  funções. Se voltar também as definições SQL, restaurar as definições preservadas
  junto com as funções compatíveis, nunca isoladamente; isso reintroduz os bugs
  documentados e só deve ser usado em recuperação deliberada.
- Não remover coluna de reconciliação nem histórico de migrations. Não apagar
  transações, assinaturas, proveniências ou dados durante rollback.
- Produção depende de: matriz integrada aprovada, configuração/observabilidade
  verificadas, backup integral recente, revisão do PR e autorização explícita de
  publicação com o ref de produção confirmado novamente. Nada disso foi presumido.
