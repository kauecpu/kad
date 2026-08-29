# Catálogo dinâmico de questões

## Objetivo

Exibir todas as questões publicadas no app, sem misturar concursos, usando a
mesma regra de escopo para contagens, detalhe, simulados, ranking e trilhas.

## Plano

1. Criar um módulo puro de catálogo que derive grupos de estudo a partir das
   questões publicadas e dos concursos publicados quando houver vínculo.
   Cada grupo terá uma chave estável composta por concurso, instituição, banca,
   ano e cargo, sem correspondência textual ampla entre anos ou cargos.
2. Reusar o resolver de grupo em `QuestionsScreen`, nas telas de detalhe de
   concurso, simulados, ranking e trilhas. A contagem exibida será sempre a
   quantidade retornada pelo mesmo predicado usado para abrir o grupo.
3. Derivar disciplinas, matérias e assuntos do conjunto carregado; preservar a
   taxonomia demonstrativa apenas como fallback e fornecer metadados visuais
   neutros para disciplinas publicadas ainda não cadastradas.
4. Manter o catálogo demonstrativo quando não houver conteúdo publicado e
   expor grupos publicados sem registro editorial de concurso com aviso de
   metadados ausentes, sem fabricar informações.
5. Adicionar testes de escopo, separação por ano/cargo, Receita Federal/Auditor
   Fiscal, disciplinas fora do catálogo, fallback e contagem consistente.
6. Executar `npm run check`, revisar o diff, fazer commit, push e abrir PR para
   `main` sem merge.

## Limites

- Não alterar Supabase, migrations, banco ou respostas.
- Não executar Qwen nem nova coleta.
- Não alterar o site neste PR.
