# Jornada de estudo: correções e validação

Base: `8c17497` da main, sem incorporar o PR #89. Trabalho local em Windows,
Node 22.23.2 e Chromium headless via Playwright. Nenhum deploy, migração ou
acesso a dados remotos nesta validação.

## Defeitos e evidências

| Defeito | Causa | Correção e evidência |
| --- | --- | --- |
| Resposta pendente some após nova sessão | App e site descartavam o erro do envio e substituíam respostas locais pelo retorno remoto | Journal por usuário com gravação local antes do envio, fila ordenada e proteção contra respostas antigas. Testes de queda, reabertura, troca de conta e confirmação perdida. |
| App lança exceção com filtro vazio | Player acessava `current.id` sem verificar se havia questão | Guarda para questão ausente. Teste executa o componente transpilado e reproduziu a exceção antes da correção. |
| Correção desaparece no filtro “não respondidas” do site | Cada render removia a questão recém-respondida da sessão | Snapshot da lista enquanto a sessão permanece aberta. Teste de render falhou antes e passou depois. |
| Mapa de sessão cresce com o catálogo inteiro | Um botão por questão | Janela de até 43 botões, incluindo início/fim. Próxima/anterior continuam disponíveis. Teste com 5.000 questões. |
| Atualização em segundo plano apaga comentário em digitação | Site substitui o HTML durante a sincronização | Preservação em memória do texto, seleção, foco e abertura do painel da mesma questão/conta/rota. E2E reproduziu perda do texto antes da correção. |

O teste do journal reproduz o fluxo de falha com dependências isoladas. Não houve
uma reprodução remota da perda de respostas de um usuário real.

## Contrato preservado

- Respostas e resultados confirmados pertencem à conta; o servidor continua a
  corrigir a tentativa por `record_question_attempt(question_id, selected)`.
- A fila local serve para recuperar envios pendentes. A interface distingue
  gravação no aparelho, sincronização pendente, falha de armazenamento e sucesso
  remoto. O resultado local não concede autorização no servidor.
- Visitante mantém dados no aparelho. Entrar em outra conta não importa o
  journal do visitante nem o de outro usuário.
- Filtros do site seguem na URL. Posição e lista da sessão ficam em memória;
  não criamos promessa de retomar a mesma posição após fechar o aplicativo.
- O rascunho de comentário sobrevive a atualizações da mesma tela. Não persiste
  depois de sair da rota, trocar de conta ou fechar o navegador.
- Regras de XP, ranking, limites de acesso e pagamentos permanecem iguais.
  Toques repetidos não disparam outra atividade de XP após aceitar a resposta.

## Implementação

`contracts/study-sync.ts` centraliza fila, validação do cache e geração de conta.
O app usa o armazenamento cifrado existente; o site usa armazenamento local
separado por usuário. A leitura remota continua como fonte de respostas
confirmadas após esvaziar a fila.

`contracts/study-request.ts` captura a sessão do dono da operação, confere seu
identificador e fixa a autorização daquela sessão na requisição. Requisições
de respostas têm limite de 15 segundos e cancelamento. SDK e políticas do
servidor continuam responsáveis pela autenticação e autorização.

App tenta sincronizar ao retornar ao primeiro plano e a cada 30 segundos quando
há pendências. Site tenta ao ganhar foco, voltar à aba ou recuperar conexão.
Ambos oferecem tentativa manual. O app limpa seu temporizador e inscrição ao
desmontar o provider. O site registra eventos uma vez durante a vida da página.

## Verificações executadas

- `npm run check`: testes da raiz, TypeScript e lint.
- `npm --prefix site run check`: testes do site, TypeScript e build.
- `tests/study-sync.test.ts`: queda antes do envio, confirmação perdida depois
  da gravação remota simulada, cache indisponível, resposta atrasada, reset,
  reabertura, troca de conta, sessão ausente/incorreta e timeout de sessão.
- `tests/study-player-runtime.test.ts`: filtro vazio no componente nativo e
  reabertura do adaptador do app com criptografia real e armazenamento isolado
  em memória. Isso não executa um aparelho Expo.
- `site/tests/study-session-runtime.test.ts`: correção com filtro e limite do mapa.
- `site/scripts/study-journey-browser.mjs`: login pela interface, duas questões,
  correção, resultado, falha de envio, recarregamento, recuperação, logout/login,
  segunda conta sem respostas da primeira, filtro vazio, voltar do navegador e
  preservação de rascunho/foco. Zero exceções não tratadas no cenário.
- Chromium: larguras 1440, 1024, 768 e 390; temas claro/escuro, movimento reduzido,
  foco por teclado e texto a 200%, sem overflow horizontal no player testado.
  São verificações de DOM, não uma auditoria completa de contraste/acessibilidade.

O script de navegador intercepta **todas** as requisições externas. A URL de
homologação e os identificadores sintéticos existem apenas nas respostas do
interceptador; ele não envia requisições ao Supabase. Contas e linhas desaparecem
quando o processo de teste termina. Serviços alheios ao fluxo recebem respostas
vazias; esse teste não homologa suas regras.

Para reproduzir, inicie `npm --prefix site run dev -- --host 127.0.0.1 --port 5193 --strictPort`
e execute `node --no-warnings site/scripts/study-journey-browser.mjs`.
É necessário Playwright com Chromium disponível. Se instalado fora do projeto,
aponte `PLAYWRIGHT_MODULE_PATH` para seu `index.mjs`. Não adicionamos dependência.

## Medição do mapa

`node --no-warnings site/scripts/study-map-benchmark.mjs`, Windows/Node 22.23.2,
5.000 fixtures derivadas de uma questão existente, índice 2.500, dez aquecimentos
e quarenta amostras no mesmo processo:

| Indicador | Base | Correção |
| --- | ---: | ---: |
| Botões do mapa | 5.000 | 43 |
| Bytes do HTML da sessão | 585.647 | 9.119 |
| Mediana de geração do HTML | 4,208 ms | 0,041 ms |

O script transpila a função da base e usa os mesmos helpers. Essas medições
cobrem geração de HTML e volume de elementos, não FPS, memória, tempo de rede
ou desempenho em Android/iOS. Não atribuímos ganho percentual ao aplicativo.

## Pendências antes de retirar o rascunho

- Executar a jornada no Expo em aparelho Android/iOS ou emulador, incluindo
  encerramento do processo, segundo plano, teclado e botão voltar do Android.
- Validar sessão expirada e renovação real no ambiente de homologação autorizado,
  além de tentativas/resultado no servidor com contas de teste e limpeza prevista.
- Medir memória e responsividade em navegação repetida no aparelho. Não houve
  coleta de heap, FPS ou validação de todos os travamentos relatados.
- Revisar carregamentos fora do adaptador de respostas. A hidratação geral de
  perfil/catálogos ainda usa os caminhos existentes; não afirmamos eliminar todo
  carregamento infinito do produto.
- Conferir CI do PR. O build local informa bundle acima de 500 kB e ausência de
  URL canônica de deploy, sem bloquear a compilação local.

## Riscos e rollback

Há duas representações locais durante a transição: estado legado de interface
e journal. O journal decide respostas após hidratação; o estado legado mantém
compatibilidade com as telas. Não recuperamos respostas que versões anteriores
já perderam, nem inferimos quais respostas antigas nunca chegaram ao servidor.

Envios usam repetição com a RPC existente e sua linha única por usuário/questão.
Após confirmação perdida, uma repetição pode atualizar o horário remoto. Não
alteramos o esquema para controlar conflitos entre dois aparelhos respondendo
ao mesmo tempo. O fluxo de XP mantém sua própria deduplicação existente.

Antes de reverter o commit, sincronize pendências quando possível. Reverter
código não exige rollback de banco, mas a versão antiga ignora journals novos:
conserve essas chaves para futura recuperação em vez de apagá-las. Uma falha no
armazenamento bloqueia confirmação de durabilidade e mantém o estado em memória.

Não alteramos acervo, gabaritos, políticas de acesso, pagamentos ou configurações
de ambiente/hospedagem. Nenhum dado pessoal aparece nas fixtures ou medições.
