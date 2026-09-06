# Gamificação do KAD

Este documento descreve as regras da versão 1 do ranking, XP, níveis e conquistas.

## Fonte de verdade

O total de XP continua em `level_accounts` e o histórico imutável em `level_events`. Não existe uma segunda moeda nem um total paralelo. Em contas autenticadas, o aplicativo envia apenas a identificação da atividade e as escolhas do usuário; data de recebimento, validade, acerto e XP são calculados pelo servidor.

Atividades repetidas usam a chave única `(user_id, event_id)`. A linha da conta é bloqueada durante o registro, de modo que reenvios ou requisições concorrentes não duplicam XP nem conquistas.

Visitantes usam a mesma projeção de regras apenas no aparelho. Esse progresso não é transferido automaticamente para uma conta.

## Ranking

O ranking usa somente XP confirmado em `level_events`:

- hoje: desde o início do dia no fuso `America/Sao_Paulo`;
- mês: desde o primeiro dia do mês no mesmo fuso;
- geral: todo o histórico;
- limite por consulta: no máximo 100 pessoas;
- desempate: XP, quantidade de atividades válidas, horário em que a pontuação foi atingida e username como último critério estável.

O filtro por concurso foi removido porque ainda não existe uma relação canônica entre todos os eventos de XP, questões e concursos. Nenhuma pontuação é estimada no cliente.

## Privacidade

`profiles.ranking_opt_in` nasce como `false`. Quem não autoriza a participação não aparece para outras pessoas, mas ainda recebe sua posição estimada de forma privada.

O RPC público do ranking retorna apenas nome de exibição, username, XP, nível, quantidade de atividades e posição. E-mail, telefone, cidade, UUID e outros dados da conta não fazem parte da resposta. Avatar não é retornado nesta versão porque o armazenamento atual é privado e ainda não há uma projeção pública canônica.

As tabelas de estatísticas e desbloqueios têm RLS por proprietário e não aceitam escrita direta do cliente. Somente os RPCs necessários podem ser executados por usuários autenticados; funções auxiliares permanecem privadas.

## Conquistas

O catálogo `rules_version = 1` contém 25 marcos em seis categorias:

- questões diferentes: 1, 10, 50, 100, 250, 500 e 1.000;
- acertos: 10, 100 e 500;
- sequência: 3, 7, 30 e 100 dias;
- simulados concluídos: 1, 10 e 50;
- revisões de flashcards: 10, 100 e 500;
- níveis: 10, 25, 50, 75 e 100.

Questões contam uma única vez e precisam continuar publicadas. Para acertos, vale a primeira resposta válida registrada de cada questão. Uma tentativa posterior não transforma o primeiro erro em acerto para fins de conquista.

Um simulado conta somente quando possui ao menos 10 questões publicadas diferentes, todas com alternativas válidas. Flashcards seguem a regra existente de uma recompensa por cartão por dia. Sequências usam dias com XP elegível recebido pelo servidor e o fuso de São Paulo.

`user_achievements` possui chave primária `(user_id, achievement_key)`. Por isso cada marco é desbloqueado uma vez, mesmo com reenvio ou concorrência. A exclusão da conta remove estatísticas e conquistas por `on delete cascade`.

## Sincronização e feedback

O RPC `record_level_activity` retorna XP total, nível, progresso do catálogo e novos desbloqueios. Em contas autenticadas, o aplicativo só comemora depois da confirmação do servidor. Se estiver offline, mantém a atividade na fila e apresenta o aviso depois da sincronização.

Avisos consumidos são persistidos para não reaparecerem ao reabrir o aplicativo. Trocar de conta descarta respostas tardias e avisos pertencentes ao usuário anterior. O modal respeita a preferência de movimento reduzido e o aviso simples de XP não intercepta toques.

## Backfill e implantação

A migration recalcula estatísticas a partir de `level_events`, preserva `level_accounts`, registra conquistas antigas sem duplicar XP e não cria avisos retroativos. O processamento pode ser repetido sem duplicar desbloqueios.

A migration deste PR não foi aplicada em produção. Antes de liberar o aplicativo, ela deve passar primeiro por homologação com duas contas reais, opt-in ligado e desligado, mudança de dia no horário de Brasília e uma atividade offline sincronizada.

## Limitações conhecidas

- Não existe ranking por concurso enquanto faltar a relação canônica no histórico de atividades.
- O ranking usa limite de 100 e `offset`; paginação por cursor pode substituir esse formato se o volume crescer muito.
- O avatar público depende de uma decisão posterior sobre armazenamento e URL pública segura.
- As telas autenticadas precisam ser homologadas depois que a migration estiver no ambiente de testes; as capturas deste PR cobrem o estado de visitante e o bloqueio privado do ranking.
