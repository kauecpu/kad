# Pagamentos — recuperação do retorno de checkout

## Resultado

O retorno do checkout agora sobrevive à ausência de sessão do KAD. Quando o Mercado
Pago devolve o navegador para uma tentativa válida, o site guarda apenas o caminho
interno exato e leva o usuário ao login. Depois da autenticação e, quando necessário,
da confirmação do e-mail, o site retoma a mesma tentativa e consulta o backend.

A URL não concede acesso. Aprovação, período e plano continuam vindo exclusivamente
do backend, após consulta ao provedor ou processamento autenticado do webhook.

## Correções desta etapa

- `returnTo` aceita somente `/perfil/planos?checkout=<uuid>`, sem origem externa nem
  parâmetros extras. O valor é descartado após conclusão, troca de conta ou logout.
- Login, cadastro e confirmação de e-mail preservam esse retorno validado.
- A confirmação aceita tanto o link PKCE enviado pelo Supabase quanto o código de seis
  dígitos, quando o template configurado realmente o inclui.
- Um usuário autenticado que abre Planos sem o parâmetro pode recuperar somente sua
  tentativa Mercado Pago mais recente ainda aberta. A RPC filtra por `auth.uid()` e
  não concede leitura direta das tabelas financeiras.
- Rejeições precoces do webhook agora registram apenas a categoria sanitizada:
  requisição inválida, assinatura inválida ou ambiente inesperado. Payload, assinatura,
  token, e-mail e identificadores financeiros não são gravados nos logs.

## Publicação em homologação

Aplicado exclusivamente no projeto Supabase de homologação
`npaoyezfwmgauirrlyog`:

- migration `20260903082519_get_latest_open_payment_checkout.sql`;
- `mercado-pago-webhook` v11.

Nenhuma alteração foi feita no projeto de produção. O site não foi publicado. Uma
sondagem sem dados financeiros confirmou HTTP 400 para corpo inválido e HTTP 401 para
assinatura deliberadamente inválida; os logs exibiram somente as categorias esperadas.

## Validação

- Repositório: testes, typecheck e lint aprovados.
- Site: testes, typecheck e build aprovados.
- Edge Functions financeiras: verificação Deno aprovada.
- Navegador local: retorno sem sessão redirecionou ao login e manteve o destino interno
  validado nas abas de login e cadastro.
- Banco: a função permite execução apenas ao papel autenticado, usa `security definer`
  com `search_path` vazio e filtra explicitamente pelo usuário autenticado.

## Limite ainda aberto

A compra sandbox já aprovada foi conciliada manualmente e o acesso Diamond foi
atualizado, mas as duas entregas históricas do webhook responderam 401. A versão antiga
não diferenciava assinatura inválida de ambiente inesperado nos logs, portanto não é
possível afirmar retroativamente qual das duas validações falhou.

A versão v11 passou a distinguir esses casos para a próxima entrega. Confirmar a causa
real exige reenviar o evento pelo painel do Mercado Pago ou aguardar uma nova tentativa
oficial. O painel solicitou validação adicional da conta; essa etapa deve ser concluída
pelo responsável no navegador. Não repetir a compra aprovada e não afrouxar HMAC ou a
verificação de ambiente para obter um resultado verde.

## Rollback e promoção

Em rollback, reverta primeiro o frontend e redeploye a versão anterior do webhook. A
RPC aditiva pode permanecer sem uso; se for removida, faça isso apenas por migration
compensatória depois do rollback do site. Nunca apague checkouts, transações, eventos
ou assinaturas para desfazer esta entrega.

Antes de promover: reenviar um evento oficial, confirmar a categoria e corrigir a causa
se necessário; validar idempotência; testar login, cadastro e confirmação de e-mail no
domínio HTTPS de homologação; conferir CI e obter revisão humana. Produção e cobrança
real continuam fora do escopo.
