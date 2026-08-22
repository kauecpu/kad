# Identidade de progresso do KAD App

## Status

Direção aprovada em conversa em 22 de agosto de 2026. Esta especificação limita a mudança a um Pull Request e ao KAD App.

## Objetivo

O KAD App continuará simples, minimalista e profissional, mas passará a comunicar determinação, conquista, clareza e confiança. A tela Início deve mostrar o próximo passo em poucos segundos e criar uma associação visual com o KAD mesmo quando o logotipo não aparece.

A mudança concentrará a força visual em uma superfície dominante. Cards secundários, listas e controles manterão o tratamento calmo atual.

## Diagnóstico

O app atual oferece boa organização, acessibilidade e consistência. Quatro características reduzem sua identidade:

- superfícies principais e secundárias possuem peso parecido;
- o roxo funciona como acento em ícones, linhas e pequenos controles, mas raramente estrutura a tela;
- o mascote aparece em onboarding e autenticação, longe da rotina de estudo;
- a navegação diferencia o ícone ativo, mas mantém o rótulo com o tom inativo.

A base minimalista geométrica combina com o produto. O projeto não adotará claymorphism, nova família tipográfica, sombras pesadas ou gamificação decorativa.

## Abordagem escolhida

O PR criará uma assinatura de progresso composta por três recursos:

1. uma superfície roxa dominante para a próxima ação;
2. faixas angulares que remetem ao caminho ascendente do símbolo KAD;
3. uma pose existente do mascote ligada ao estado real da jornada.

Essa combinação preserva a clareza do app e adiciona presença de marca onde o usuário decide o que fazer.

Duas alternativas ficam descartadas:

- Ajustar somente tipografia e contraste produziria uma mudança sutil demais.
- Colocar mascotes em vários cards aumentaria o ruído e aproximaria o produto de uma linguagem infantil.

## Tokens visuais

`constants/theme.ts` receberá tokens semânticos equivalentes nos temas claro e escuro:

| Token | Função |
| --- | --- |
| `brandSurfaceStrong` | início do fundo dominante de marca |
| `brandSurfaceDeep` | profundidade do fundo dominante e contraste no gradiente |
| `onBrand` | texto e ícones prioritários sobre a superfície de marca |
| `onBrandMuted` | descrição secundária sobre a superfície de marca |
| `brandTrace` | faixas angulares decorativas |
| `tabActiveSurface` | cápsula discreta do ícone ativo |

Os componentes usarão esses nomes em vez de cores cruas. Os tokens existentes continuarão atendendo superfícies neutras, sucesso, perigo, aviso e conquista.

## Assinatura gráfica

Um novo componente `components/ui/kad-progress-signature.tsx` desenhará duas faixas angulares com `View`, rotação, opacidade e posicionamento absoluto. O componente não receberá eventos, não carregará imagens e não adicionará dependências.

O componente terá estas responsabilidades:

- ocupar apenas a superfície que o hospeda;
- aceitar o tom fornecido pelo tema;
- manter opacidade baixa para preservar a leitura;
- usar `pointerEvents="none"`;
- permanecer fora da árvore de acessibilidade.

O componente não representará progresso numérico. Ele servirá somente como assinatura da marca.

## Evolução do FeaturedCard

`components/ui/featured-card.tsx` ganhará duas propriedades opcionais:

- `intensity="standard" | "strong"`, com `standard` como padrão;
- `artwork`, para uma ilustração decorativa posicionada pelo componente.

A variante `standard` manterá o comportamento atual. A variante `strong` aplicará:

- gradiente entre `brandSurfaceDeep` e `brandSurfaceStrong`;
- título e ícone em `onBrand`;
- descrição em `onBrandMuted`;
- assinatura angular no fundo;
- CTA claro e legível sobre o roxo;
- área reservada para artwork sem sobrepor texto ou progresso.

O `tone="achievement"` continuará separado de `intensity`. A tela usará conquista somente quando os dados indicarem a conclusão de uma sessão.

O componente manterá o contrato de toque, o rótulo acessível, o estado desabilitado e o feedback existente.

## Composição da tela Início

`app/(tabs)/inicio.tsx` continuará usando `getHomePrimaryAction` como fonte do próximo passo. Uma função visual pura mapeará a rota e o estado retornados para artwork e tom, sem alterar regras de negócio:

| Estado real | Mascote | Tom |
| --- | --- | --- |
| escolher meta ou concurso | `goal` | marca |
| começar ou retomar questões | `practice` | marca |
| iniciar ou continuar simulado | `simulation` | marca |
| revisar simulado concluído | `simulation` | conquista |

O mascote usará `KadMascot` com animação desativada. Ele ficará ancorado na base direita do card, com dimensão menor em telefone e maior em tablet ou web. O layout reservará uma coluna segura para impedir sobreposição entre texto e imagem.

O card principal receberá `intensity="strong"`. Se `primaryAction.progress` existir, a barra mostrará o valor real com contraste sobre a superfície de marca. O app não criará mensagens, sequências, pontos ou percentuais novos.

A ordem da Início permanecerá:

1. cabeçalho;
2. próximo passo dominante;
3. resumo da preparação;
4. Praticar agora;
5. atividade e ritmo;
6. meta e Explorar.

Os cards de resumo, atividade, ritmo, meta e exploração continuarão neutros. Ajustes nesses blocos só poderão reduzir competição visual com o destaque principal.

## Navegação inferior

`app/(tabs)/_layout.tsx` manterá cinco destinos, altura atual e componentes de ícone estáveis.

A aba ativa receberá:

- uma cápsula `tabActiveSurface` atrás do ícone;
- ícone preenchido em `tabActive`;
- rótulo em `tabActive` e peso semibold.

As abas inativas usarão ícone outline e `tabInactive`. A mudança não criará uma segunda animação concorrente. O feedback de pressão e as áreas de toque atuais continuarão funcionando.

## Movimento

O PR não adicionará animação contínua. A assinatura angular permanecerá estática e o mascote não flutuará na Início.

As transições existentes de pressão e aba continuarão curtas. Quando a configuração de redução de movimento estiver ativa, o app aplicará o estado final sem deslocamento decorativo.

## Responsividade

Em 390 px, o card principal reservará uma faixa estreita à direita para o mascote. Título, descrição, progresso e CTA manterão leitura sem truncamento indevido.

Em 768 px e na largura ampla, o card ampliará o espaço entre texto e artwork, respeitando `CONTENT_MAX_WIDTH`. A composição não virará um dashboard desktop diferente do aplicativo.

O layout deve suportar texto ampliado sem cobrir o mascote, esconder o CTA ou causar rolagem horizontal.

## Acessibilidade

- A assinatura gráfica e o mascote decorativo não entrarão na ordem de leitura.
- O card principal manterá um rótulo que combina título e descrição.
- Cor não será o único indicador do estado ativo ou de conquista.
- Texto normal manterá contraste mínimo de 4,5:1 nos dois temas.
- Indicadores, ícones e limites interativos manterão contraste mínimo de 3:1.
- Alvos de toque continuarão com pelo menos 44 pt no iOS e 48 dp no Android.
- A navegação web manterá foco visível e ordem coerente pelo teclado.

## Dados e falhas

O PR não criará estado persistido, requisições ou integrações. A apresentação consumirá somente `primaryAction` e os dados já usados pela Início.

Se o artwork não for fornecido, `FeaturedCard` renderizará a composição sem espaço vazio. Se o texto crescer, o conteúdo terá prioridade e a arte perderá tamanho antes de provocar sobreposição.

## Testes e validação

O desenvolvimento seguirá TDD para contratos verificáveis. Os testes cobrirão:

- mapeamento de estado real para mascote e tom;
- variante forte opcional e padrão compatível do `FeaturedCard`;
- assinatura marcada como decorativa;
- rótulo ativo da navegação usando cor e peso ativos;
- ausência de alterações nas rotas das cinco abas;
- uso de tokens nos temas claro e escuro.

A validação visual conferirá 390 px, 768 px e largura ampla, nos temas claro e escuro. A revisão também usará redução de movimento, navegação por teclado no web e texto ampliado.

Antes da entrega, serão executados `npm run check` e uma revisão comparativa de antes e depois. As capturas entrarão na descrição do Pull Request quando o fluxo do repositório permitir anexá-las.

## Arquivos previstos

- `constants/theme.ts`
- `components/ui/kad-progress-signature.tsx`
- `components/ui/featured-card.tsx`
- `app/(tabs)/inicio.tsx`
- `app/(tabs)/_layout.tsx`
- `lib/home-presentation.ts`
- testes correspondentes

Outros arquivos do app só entrarão no PR se forem necessários para manter contratos existentes ou a validação responsiva.

## Fora do escopo

- KAD Site em `site/`;
- Supabase, admin, infraestrutura, ambiente e ingestão;
- regras de negócio, autenticação, rotas ou persistência;
- redesign das demais telas;
- nova fonte ou dependência;
- pontos, medalhas, moedas, prêmios ou métricas inventadas;
- novos assets ou alteração dos mascotes existentes;
- animações contínuas e efeitos decorativos pesados.

## Critérios de aceite

- A Início mostra uma única superfície dominante ligada ao próximo passo real.
- O app preserva a hierarquia e a densidade atuais nas superfícies secundárias.
- A assinatura angular aparece somente na superfície dominante.
- O mascote aparece no máximo uma vez na tela e não compete com o CTA.
- A aba ativa combina ícone, superfície e rótulo sem aumentar a barra.
- Os dois temas, redução de movimento e texto ampliado funcionam sem perda de conteúdo.
- A troca de tema mantém a resposta corrigida no PR #38.
- A suíte `npm run check` termina sem falhas.
- O trabalho resulta em um único Pull Request para `main`, sem merge automático.
