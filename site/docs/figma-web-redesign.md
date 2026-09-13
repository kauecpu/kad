# KAD Site — cinco experiências

Referência aprovada: [Figma](https://www.figma.com/design/RwFgHBgAQCoNnX345fgIo9).

O ambiente de estudo usa cinco destinos principais: Início, Estudar, Preparar,
Acompanhar e Conta. As ferramentas de cada área ficam em navegação contextual,
com URLs existentes e indicação de seleção. No celular a página mantém sua
rolagem normal e o menu é acessado pelo cabeçalho; não há barra inferior.

## Composições

- Início: abertura editorial escura, próximos passos, quatro acessos e meta.
- Estudar: catálogo e desempenho por disciplina lado a lado, com revisão e
  matérias abaixo. Percentuais são derivados de respostas a questões publicadas.
- Preparar: abertura roxa, recursos de preparação e catálogo com filtros.
- Acompanhar: abertura escura, período, posição e classificação confirmadas.
- Conta: identidade horizontal, preparação e progresso em colunas; configurações
  mantêm seus controles e estados existentes.

Os números, agendas e preferências ilustrativos do Figma não foram copiados.
Notificações e materiais ainda indisponíveis conservam sua indicação existente.
O logotipo oficial e os ícones Lucide do site foram reutilizados.

`workspace.css` delimita os novos estilos por `.web-workspace`. A apresentação,
o cadastro e o login não recebem essa classe. Nenhuma dependência foi adicionada.

## Verificação local

- `npm --prefix site run check`: tipos, 79 testes e build aprovados.
- `npm run check`: 489 testes, tipos e lint aprovados.
- Cinco áreas em 1440, 1024, 768 e 390 px, claro e escuro: sem overflow horizontal
  da página, com um único título principal.
- Simulados, trilhas, redação, flashcards, biblioteca, edição de perfil e busca
  também inspecionados em 390 px.
- Menu: abertura, Escape e retorno do foco ao acionador verificados.
- Busca: estado sem resultados e retorno ao catálogo verificados.
- Movimento reduzido: regra CSS remove animações e transições do ambiente.

Limites: a inspeção visual utilizou o modo visitante disponível localmente.
Ranking autenticado e estados remotos têm cobertura dos testes existentes, mas
não foram exercitados com uma conta real. O navegador integrado não aplicou o
atalho de zoom nativo de 200%; a verificação de reflow usou larguras explícitas.
O Figma Starter limitou novas consultas após a leitura do Início; os outros
conceitos foram adaptados a partir das capturas aprovadas na conversa.

O build informa o bundle acima de 500 kB e a ausência local de `VITE_SITE_URL`.
A configuração de publicação e o carregamento de módulos não foram alterados.
