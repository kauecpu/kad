# Design das quatro poses do mascote no onboarding

## Objetivo

Os quatro slides do onboarding usarão o mesmo lobo 2D roxo das duas imagens fornecidas. Cada slide terá uma pose ligada ao seu conteúdo. O app manterá textos, ícones, botões, animações e layout atuais.

## Abordagem escolhida

As duas artes fornecidas ocuparão os dois primeiros slides. O gerador criará somente as poses de simulado e meta, usando as duas imagens como ficha do personagem. Essa abordagem preserva as artes aprovadas e reduz a variação visual nas imagens novas.

Descartamos duas alternativas:

- Gerar as quatro poses novamente. O modelo poderia alterar detalhes das duas artes aprovadas.
- Alternar as duas imagens entre os quatro slides. A repetição não representaria o conteúdo de cada etapa.

## Poses e assets

| Slide | Variante | Cena | Asset |
| --- | --- | --- | --- |
| Boas-vindas | `welcome` | Lobo sentado, escrevendo no papel com o lápis amarelo | `assets/images/kad-mascot-wolf-writing.png` |
| Prática | `practice` | Lobo em pé, segurando o lápis amarelo | `assets/images/kad-mascot-wolf-practice.png` |
| Simulado | `simulation` | Lobo concentrado, resolvendo uma prova com lápis e cronômetro visível | `assets/images/kad-mascot-wolf-simulation.png` |
| Meta | `goal` | Lobo confiante, segurando uma bandeira de objetivo e um livro fechado | `assets/images/kad-mascot-wolf-goal-study.png` |

## Modelo visual do personagem

Todas as poses devem preservar estes elementos:

- ilustração 2D com formas limpas e sombreamento suave;
- pelagem roxa, focinho e barriga lilás;
- olhos brancos expressivos, pupilas roxo-escuras e sobrancelhas marcadas;
- nariz roxo-escuro e um pequeno dente branco;
- orelhas pontudas com interior lilás e cauda volumosa;
- short azul com o mesmo corte e as mesmas faixas;
- proporções infantis, cabeça grande e corpo pequeno;
- lápis amarelo com borracha coral quando a cena usar lápis.

As imagens novas não podem mudar a espécie, o rosto, as cores, a roupa ou o acabamento gráfico do personagem.

## Composição dos novos desenhos

### Simulado

O lobo ficará sentado diante de uma folha de prova. Uma pata segurará o lápis e a outra apoiará o papel. Um cronômetro pequeno ficará ao lado da folha. A expressão mostrará concentração. A cena não terá mesa grande, cenário de sala ou texto legível.

### Meta

O lobo ficará em pé. Uma pata segurará uma bandeira roxa de objetivo e a outra carregará um livro azul fechado. A expressão mostrará confiança. A bandeira não terá palavras, logotipo ou números.

## Tratamento dos arquivos

O fluxo de imagem usará um fundo cromático uniforme antes da remoção local. Os PNGs finais terão:

- dimensões de 1254×1254 pixels;
- fundo transparente;
- tela quadrada e margem uniforme;
- personagem e objetos completos, sem cortes;
- cantos com alfa zero;
- bordas sem verde, branco ou preto residual;
- nenhuma moldura, sombra projetada, marca-d'água ou texto.

As quatro imagens devem ter dimensões e enquadramento próximos para evitar saltos de escala durante a troca de slides.

## Integração no app

O tipo `KadMascotVariant` passará a usar `welcome`, `practice`, `simulation` e `goal`. O mapa `MASCOT_SOURCES` ligará cada variante ao seu PNG. O arquivo `app/onboarding.tsx` trocará somente os nomes internos `nerd` e `book` por `practice` e `simulation`.

O componente continuará usando `Animated.Image`, `resizeMode="contain"` e o cálculo responsivo de tamanho existente. Nenhum slide receberá mudanças de texto, ícone ou espaçamento.

## Acessibilidade

Cada pose terá uma descrição própria:

- `welcome`: “Mascote KAD escrevendo com um lápis”;
- `practice`: “Mascote KAD em pé segurando um lápis”;
- `simulation`: “Mascote KAD resolvendo uma prova com cronômetro”;
- `goal`: “Mascote KAD segurando uma bandeira de objetivo e um livro”.

## Validação

O teste automatizado verificará as quatro descrições acessíveis. A validação visual abrirá todos os slides em 320×700 e 430×900, nos temas claro e escuro.

Em cada slide, a revisão confirmará:

- o mesmo modelo de personagem;
- uma pose diferente e coerente com o conteúdo;
- ausência dos lobos 3D antigos;
- transparência limpa e nenhum corte;
- espaço entre mascote, título, descrição e controles.

O comando final será `npm.cmd run check`. A PR continuará em draft e não receberá merge.

## Fora do escopo

Esta etapa não altera textos, navegação, paleta global, ícones dos slides, animações, autenticação ou outras telas.
