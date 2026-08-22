# Navegação e descoberta de recursos do KAD App

Data: 22 de agosto de 2026

## Contexto

O KAD App oferece Questões, Concursos, Simulados, Ranking, Trilhas, Redação e Biblioteca. A barra inferior atual mostra Início, Questões, Rank, Simulados e Perfil. O usuário encontra Concursos, Trilhas, Redação e Biblioteca por atalhos distribuídos na tela Início ou no Perfil.

Essa distribuição esconde parte do catálogo. Redação, por exemplo, depende de um card na tela Início. Concursos possui uma tela completa em `app/(tabs)/concursos.tsx`, mas o layout define `href: null` e retira o destino da barra inferior.

## Nomenclatura e escopo

Este documento usa os nomes definidos pelo responsável pelo produto:

- **KAD Web:** prévia Expo do código do aplicativo, aberta durante o desenvolvimento com `npm run web`.
- **KAD App:** aplicativo instalado em Android ou iOS e foco desta mudança.
- **KAD Site:** produto de estudos separado, mantido em `site/`.

O KAD Web continuará refletindo o KAD App porque ambos usam o mesmo código Expo. A equipe não criará uma navegação exclusiva para o KAD Web. Esta mudança não altera `site/`.

## Objetivos

- Mostrar ao usuário o conjunto de recursos do KAD App em um lugar previsível.
- Dar acesso direto a Concursos pela barra inferior.
- Manter cinco destinos na barra inferior para preservar legibilidade e áreas de toque.
- Preservar a tela Início, incluindo o card roxo de próximo passo e os cards de progresso.
- Manter Ranking, Trilhas, Redação e Biblioteca a no máximo dois toques de qualquer destino principal.
- Preservar rotas, dados, autenticação, temas, movimento reduzido e deep links existentes.

## Fora do escopo

- Alterar o KAD Site em `site/`.
- Criar uma sidebar específica para o KAD Web.
- Mudar dados, regras de negócio, conteúdo de concursos ou Supabase.
- Redesenhar as telas internas de Questões, Concursos, Simulados, Ranking, Trilhas, Redação ou Biblioteca.
- Criar recursos novos para Biblioteca ou Redação.

## Arquitetura de navegação

### Barra inferior

O KAD App terá cinco destinos principais, nesta ordem:

1. Início (`/inicio`)
2. Questões (`/questoes`)
3. Concursos (`/concursos`)
4. Simulados (`/simulados`)
5. Explorar (`/explorar`)

Concursos deixa de usar `href: null`. Ranking e Perfil deixam a barra inferior. O app mantém os ícones preenchidos, a cápsula ativa, o feedback tátil e as regras de movimento reduzido já aplicadas às tabs.

### Tela Explorar

A rota `/explorar` funcionará como o catálogo do aplicativo. Ela mostrará os recursos em três grupos:

**Praticar**

- Questões: praticar por disciplina, assunto ou concurso.
- Concursos: consultar concursos abertos, previstos e salvos.
- Simulados: treinar ritmo e formato de prova.

**Acompanhar**

- Ranking: acompanhar pontuação e posição.

**Outras formas de estudar**

- Trilhas: seguir uma sequência de estudos.
- Redação: escolher um tema e praticar escrita.
- Biblioteca: acessar a área prevista para materiais, flashcards e anotações.

A tela repete Questões, Concursos e Simulados de propósito. A barra inferior prioriza velocidade; Explorar comunica o catálogo completo e explica a função de cada destino.

O cabeçalho de Explorar terá o título da tela e o avatar do usuário. O avatar abre `/perfil`.

### Perfil e recursos secundários

O avatar da tela Início continuará abrindo o Perfil. Explorar oferecerá um segundo acesso no cabeçalho e uma entrada de conta separada no fim do catálogo.

Perfil, Ranking, Trilhas, Redação e Biblioteca funcionarão como fluxos focados fora da barra inferior. Cada tela manterá ou receberá uma ação de voltar que retorna ao ponto anterior. A mudança preservará os endereços públicos atuais, incluindo `/perfil`, `/ranking`, `/trilhas`, `/redacao` e `/biblioteca`.

O app moverá `app/(tabs)/perfil.tsx` para `app/perfil/index.tsx`. O endereço continuará sendo `/perfil`, mas a tela abrirá como um fluxo de pilha com ação de voltar e sem ocupar uma tab.

O app manterá `app/(tabs)/rank.tsx` como compatibilidade para `/rank`, mas a tela fará um redirecionamento explícito para `/ranking`. O destino canônico de Ranking ficará fora das tabs e manterá a ação de voltar já existente.

## Catálogo como fonte de verdade

Um módulo de apresentação definirá os recursos exibidos em Explorar. Cada item terá:

- identificador estável;
- título e descrição curta;
- rota canônica;
- ícone;
- grupo de apresentação;
- estado de disponibilidade, quando necessário.

A tela Explorar renderizará esse catálogo. Testes verificarão títulos, rotas, grupos e ausência de duplicações acidentais. O módulo não importará componentes React Native nem dados do KAD Site.

## Comportamento visual

### Início

A tela Início não perderá conteúdo. O card roxo de próximo passo continuará abaixo da saudação e acima dos resumos de preparação. Os cards de Questões, Simulados, Trilhas, Redação e Biblioteca podem continuar como atalhos contextuais; Explorar passa a oferecer um caminho permanente para os mesmos recursos.

### Explorar

A tela usará a linguagem visual existente do KAD App:

- fundo, superfícies e bordas vindos do tema;
- ícones da biblioteca já instalada;
- títulos curtos e descrições funcionais;
- cards com área de toque mínima de 44 por 44 pontos;
- foco visível no KAD Web usado para testes;
- contraste mínimo de 4,5:1 para texto normal;
- layout que suporta escala de fonte e temas claro e escuro.

Questões, Concursos, Simulados e Ranking usarão cards compactos. Trilhas, Redação e Biblioteca usarão linhas de navegação com ícone, texto e indicador de avanço. O Perfil ficará separado para não parecer uma forma de estudo.

## Transições e retorno

- A troca entre as cinco tabs seguirá a animação existente.
- O app respeitará a preferência de movimento reduzido.
- Explorar abrirá recursos secundários com a navegação de pilha existente.
- A ação de voltar retornará a Explorar quando o usuário tiver partido dela.
- Deep links abrirão a tela solicitada sem obrigar uma passagem por Explorar.

## Estados e falhas

Explorar usa metadados locais e não depende de rede. A tela ficará disponível durante carregamentos de perguntas, concursos ou sessão. Cada destino continuará responsável pelos próprios estados de carregamento, vazio e erro.

Biblioteca poderá exibir o estado atual de disponibilidade. O catálogo não prometerá uma ação que a tela de destino ainda não oferece.

## Acessibilidade

- Cada entrada terá nome, descrição e papel de botão.
- A barra inferior anunciará cinco tabs e o estado selecionado.
- O app manterá ordem visual e ordem de foco iguais.
- Ícones decorativos não entrarão na árvore de acessibilidade.
- Textos poderão crescer sem cobrir ícones, descrições ou indicadores.
- O app não dependerá apenas de cor para indicar o destino ativo.

## Testes e validação

### Testes automatizados

- A barra inferior contém Início, Questões, Concursos, Simulados e Explorar, nesta ordem.
- Concursos deixa de usar `href: null`.
- Rank e Perfil não aparecem como tabs visíveis.
- O catálogo lista os recursos aprovados com rotas canônicas.
- A tela Início mantém o card de próximo passo.
- As rotas antigas de Perfil e Ranking continuam válidas ou redirecionam para os destinos canônicos.
- Os componentes respeitam temas, escala de texto e movimento reduzido.

### Validação manual

- Android e iOS em largura de celular.
- KAD Web usado como prévia em 390 px e 768 px, sem tratamento como produto separado.
- Temas claro e escuro.
- Navegação por teclado na prévia web.
- Escala de fonte ampliada.
- Ida de Explorar para cada recurso e retorno.
- Abertura direta das rotas por deep link.

O trabalho termina com `npm run check` aprovado. O PR incluirá somente arquivos do KAD App, bibliotecas compartilhadas pelo aplicativo, testes e esta documentação.

## Critérios de aceite

- O usuário encontra Concursos na barra inferior.
- O usuário encontra Ranking, Trilhas, Redação e Biblioteca na tela Explorar.
- Nenhum recurso depende apenas de um card da tela Início para ser descoberto.
- A tela Início mantém o card roxo e os resumos existentes.
- O KAD Site permanece sem alterações.
- O KAD Web espelha o KAD App para desenvolvimento, sem sidebar própria.
