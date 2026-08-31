# KAD Backend Integration Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Auditar e estabilizar a integração do KAD Site e do KAD App com Supabase, autenticação e Mercado Pago sem tocar no `kad-collector` ou em produção.

**Architecture:** Manter a separação atual entre adaptadores web (`site/src/services`), cliente Expo (`lib/`/`providers/`) e funções/migrations do Supabase. Corrigir apenas comportamentos comprovados por testes, centralizando estados de ambiente e erros de integração sem expor segredos. Validar tabelas e Edge Functions por consultas anônimas/autenticadas controladas e documentar bloqueios externos.

**Tech Stack:** TypeScript, Expo SDK 54, Vite, `@supabase/supabase-js`, Supabase Edge Functions (Deno), Node test runner, npm scripts.

**Spec:** `C:/Users/igord/.codex/attachments/d7363903-5cc5-4bb3-9d2e-c1accfdedcf6/pasted-text.txt`

## Global Constraints

- Não alterar o repositório `kad-collector`.
- Não publicar mudanças em produção, resetar bancos ou fazer cobranças reais.
- Usar somente cópias locais e dados descartáveis na homologação.
- Nunca expor chaves privadas, tokens, cookies ou `service_role`.
- Preservar contratos de API, formato de exportação e dados existentes.
- A branch deve ser própria, baseada na `origin/main`, e o PR deve ficar sem merge.
- Executar `npm run check` na raiz e `npm --prefix site run check` antes da entrega.

---

### Task 1: Baseline e matriz de evidências

**Files:**
- Create: `docs/qa/backend-integration-baseline.md`
- Read-only: `contracts/deployment-environment.ts`, `scripts/run-environment.mjs`, `lib/supabase.ts`, `providers/auth-provider.tsx`, `site/src/services/supabase.ts`, `supabase/migrations/*.sql`, `supabase/functions/**`

**Interfaces:**
- Consumes: endpoints de staging/produção já definidos nos contratos e chaves públicas locais sem registrar seus valores.
- Produces: matriz de evidências com ambiente, endpoint, status HTTP, tabelas consultadas, funções publicadas, limitações e gravidade.

- [ ] **Step 1: Confirmar o estado da árvore e a referência da main**

  Run:
  ```powershell
  git status --short --branch
  git fetch origin main
  git rev-parse origin/main
  ```
  Expected: worktree isolada limpa e `origin/main` atualizada.

- [ ] **Step 2: Executar checks de ambiente sem imprimir chaves**

  Run:
  ```powershell
  npm run env:check:staging
  npm run env:check:production
  ```
  Expected: staging aponta para `npaoyezfwmgauirrlyog` e produção para `tknxtwwwoqwbzddplzzg`.

- [ ] **Step 3: Consultar apenas metadados públicos e endpoints protegidos**

  Use um script descartável fora do git para consultar `/auth/v1/settings`, contagens de `questions`/`concursos` publicados e respostas 401/404/400 das funções, sem incluir valores de headers no output. Registrar somente status, contagens e códigos de erro.

- [ ] **Step 4: Comparar o fluxo de dados ponta a ponta**

  Trace ambiente → cliente Supabase → consulta/RPC → estado da UI e ambiente → Edge Function → Mercado Pago → webhook → `subscriptions`. Anotar qualquer ponto em que o estado offline possa ser confundido com remoto.

- [ ] **Step 5: Documentar o baseline**

  Escrever a matriz em `docs/qa/backend-integration-baseline.md`, incluindo o que está funcionando, o que depende de configuração externa e os bloqueios conhecidos (`send-auth-email` não publicado e ausência de credenciais de teste do Mercado Pago). Não registrar segredos.

- [ ] **Step 6: Commit do diagnóstico**

  ```powershell
  git add docs/qa/backend-integration-baseline.md
  git commit -m "docs: registrar baseline da integração de backend"
  ```

### Task 2: Contratos testáveis de estado de ambiente e conteúdo

**Files:**
- Create: `site/src/core/backend-state.ts`
- Modify: `site/src/main.ts`, `site/src/services/supabase.ts`
- Test: `site/tests/backend-state.test.ts`, `site/tests/supabase-service.test.ts`

**Interfaces:**
- Consumes: `resolveSiteSupabaseConfig()` e resultado de `loadPublishedContent()` existentes.
- Produces: tipos e helpers puros `BackendConnectionState`, `classifyBackendState()`, `isRemoteContentAuthoritative()` usados pela UI e pelos testes.

- [ ] **Step 1: Escrever testes vermelhos para distinguir offline, conectado vazio e remoto carregado**

  ```ts
  test('classifies missing public config as offline', () => {
    assert.deepEqual(classifyBackendState({ configured: false, loading: false, error: null }), { kind: 'offline' });
  });

  test('does not treat an empty published catalog as local fallback', () => {
    assert.equal(isRemoteContentAuthoritative({ configured: true, loadedFromRemote: true, questions: [], concursos: [] }), true);
  });
  ```

- [ ] **Step 2: Rodar os testes e confirmar falha pela ausência dos helpers**

  Run: `npm --prefix site test -- backend-state.test.ts supabase-service.test.ts`
  Expected: FAIL com os nomes dos helpers ainda inexistentes.

- [ ] **Step 3: Implementar os helpers puros e o estado explícito no bootstrap do site**

  O bootstrap deve expor se a configuração está ausente, se a consulta está em andamento, se carregou remoto vazio, ou se falhou. Não substituir um resultado remoto vazio por catálogo local quando Supabase está configurado; o fallback local só pode ser usado em modo offline explícito.

- [ ] **Step 4: Rodar novamente os testes específicos**

  Run: `npm --prefix site test -- backend-state.test.ts supabase-service.test.ts`
  Expected: PASS sem warnings.

- [ ] **Step 5: Commit da correção de estado**

  ```powershell
  git add site/src/core/backend-state.ts site/src/main.ts site/src/services/supabase.ts site/tests/backend-state.test.ts site/tests/supabase-service.test.ts
  git commit -m "fix(site): explicitar estado remoto e modo offline"
  ```

### Task 3: Auditoria e correção do fluxo de autenticação

**Files:**
- Modify: `site/src/services/supabase.ts` ou `providers/auth-provider.tsx` somente se um teste reproduzir divergência.
- Test: `site/tests/auth-integration.test.ts`, `tests/auth-session.test.ts`, `tests/auth-security.test.ts`

**Interfaces:**
- Consumes: APIs existentes de signup, OTP, recovery, sessão e logout.
- Produces: comportamento consistente de erro, persistência, refresh e logout local, sem alterar o contrato público.

- [ ] **Step 1: Adicionar testes vermelhos para os casos descobertos na auditoria**

  Cobrir `verifyEmailOtp` com o tipo efetivamente aceito pelo fluxo de cadastro, `signOut` local sem revogar outras sessões e callback de recuperação com replay bloqueado. Os testes devem chamar helpers reais e usar doubles somente na fronteira HTTP inevitável.

- [ ] **Step 2: Rodar cada teste isolado e registrar a falha esperada**

  Run: `npm test -- auth-session.test.ts auth-security.test.ts` e `npm --prefix site test -- auth-integration.test.ts`.

- [ ] **Step 3: Corrigir somente a divergência comprovada**

  Manter PKCE, armazenamento seguro nativo e `scope: 'local'`; não trocar provedor de e-mail nem publicar `send-auth-email`.

- [ ] **Step 4: Reexecutar testes de auth e atualizar o diagnóstico**

  Atualizar `docs/qa/backend-integration-baseline.md` com causa raiz, gravidade e evidência do teste.

- [ ] **Step 5: Commit da correção de autenticação**

  ```powershell
  git add site/src providers/ tests/ docs/qa/backend-integration-baseline.md
  git commit -m "fix(auth): alinhar estados de sessão e confirmação"
  ```

### Task 4: Validação de banco, RLS e pagamentos

**Files:**
- Read/modify only when a failing test proves a defect: `supabase/migrations/*.sql`, `supabase/functions/create-payment-checkout/index.ts`, `supabase/functions/cancel-subscription/index.ts`, `supabase/functions/mercado-pago-webhook/index.ts`, shared payment modules.
- Test: `supabase/tests/*.test.sql`, `tests/database-schema.test.ts`, `tests/payment-webhook-validation.test.ts`, `tests/payment-checkout-state.test.ts`

**Interfaces:**
- Consumes: migrations e funções existentes, com preço/moeda definidos no servidor e aplicação idempotente via RPC.
- Produces: evidência de isolamento, correlação de usuário, HMAC, idempotência e estados de cancelamento/estorno; qualquer correção permanece compatível com o contrato atual.

- [ ] **Step 1: Executar testes estruturais e de segurança locais**

  Run: `npm test -- database-schema.test.ts payment-webhook-validation.test.ts payment-checkout-state.test.ts`; se o Supabase CLI local estiver disponível, executar os SQL tests em uma base descartável.

- [ ] **Step 2: Testar endpoints remotos sem autenticação válida**

  Confirmar `401` para checkout/cancelamento, `400` para webhook malformado e `404` para `send-auth-email`, sem enviar payload de pagamento válido.

- [ ] **Step 3: Se houver falha reproduzível, escrever teste vermelho mínimo**

  Exemplos: usuário A consegue usar checkout de B, replay estende período, preço do navegador é aceito, ou atualização de assinatura falha por ausência de política de seleção. Não usar produção nem dados reais.

- [ ] **Step 4: Corrigir a causa raiz em uma mudança por vez**

  Preservar RLS e RPCs, nunca conceder `service_role` a clientes, e não publicar funções/secrets. Adicionar validação de origem/estado somente se o teste demonstrar a lacuna.

- [ ] **Step 5: Reexecutar testes e registrar bloqueios externos**

  Documentar explicitamente que teste end-to-end de Mercado Pago depende de credenciais sandbox, URL HTTPS, tópicos de webhook e segredo configurados pelo responsável.

- [ ] **Step 6: Commit das correções comprovadas**

  ```powershell
  git add supabase tests docs/qa/backend-integration-baseline.md
  git commit -m "fix(backend): corrigir lacunas comprovadas de integração"
  ```

### Task 5: Validação completa, documentação e evidências

**Files:**
- Modify: `docs/qa/backend-integration-baseline.md`
- Create: `docs/qa/backend-integration-report.md`
- Create: `docs/qa/backend-integration-evidence/` (somente capturas sem segredos, se aplicável)

**Interfaces:**
- Consumes: commits e resultados das Tasks 1–4.
- Produces: relatório final com tabela item/situação/evidência/gravidade/ação, checklist do prompt e limitações de homologação.

- [ ] **Step 1: Executar a suíte completa e builds**

  ```powershell
  npm run check
  npm --prefix site run check
  npm run build:staging
  npm run site:build:staging
  npm run admin:build
  ```
  Expected: comandos concluídos sem falhas; qualquer bloqueio ambiental deve ser capturado com saída sanitizada.

- [ ] **Step 2: Fazer validação manual controlada na homologação**

  Com conta descartável, verificar cadastro, login, sessão, leitura pública, resposta/favorito/concurso salvo, logout e recuperação. Não executar cobrança real; registrar checkout/webhook como bloqueado se não houver sandbox.

- [ ] **Step 3: Produzir o relatório final**

  Incluir respostas objetivas: banco conectado, auth, persistência, remoto/local, Mercado Pago pronto para teste/produção e bloqueios. Referenciar comandos e status, sem chaves.

- [ ] **Step 4: Revisar diff e garantir que o collector ficou intocado**

  ```powershell
  git diff --name-only origin/main...HEAD
  git status --short
  ```
  Expected: nenhum caminho de `kad-collector`, nenhum `.env`, segredo ou artefato sensível.

- [ ] **Step 5: Commit da documentação e evidências**

  ```powershell
  git add docs/qa
  git commit -m "docs: consolidar auditoria de integração do backend"
  ```

### Task 6: Revisão, push e Pull Request

**Files:**
- No source changes; PR body references `docs/qa/backend-integration-report.md`.

- [ ] **Step 1: Rodar verificação fresca antes de qualquer claim**

  Reexecutar os comandos da Task 5 e conferir os códigos de saída. Não afirmar que está pronto com base em execução anterior.

- [ ] **Step 2: Revisar o diff da branch**

  Conferir que cada arquivo alterado corresponde ao relatório e que nenhum contrato foi alterado sem necessidade.

- [ ] **Step 3: Publicar a branch**

  ```powershell
  git push -u origin codex/backend-integration-audit
  ```

- [ ] **Step 4: Solicitar revisão do diff**

  Revisar o intervalo `origin/main...HEAD` com foco em regressão de auth, exposição de dados e comportamento offline/remoto.

- [ ] **Step 5: Abrir PR contra `main` sem merge**

  Descrever escopo, diagnóstico, correções, testes, bloqueios externos e instrução explícita de que nenhum deploy/merge foi feito.

