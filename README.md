# KAD

Aplicativo de preparação para concursos públicos desenvolvido com Expo e React Native.
O produto reúne questões comentadas, busca avançada, concursos, simulados e gestão de
perfil e planos.

> Autenticação, perfil, respostas, favoritas, concursos salvos, comentários, curtidas e
> estatísticas comunitárias usam Supabase quando o projeto está configurado. Simulados,
> tema e assinatura demonstrativa mantêm um cache local isolado por usuário.

## Funcionalidades

- Estudo de questões por disciplina e assunto.
- Busca por palavra-chave, banca, ano, cargo, órgão, dificuldade e situação.
- Limite de 10 questões por dia para usuários do Plano Básico.
- Listagem de concursos com filtros por banca, estado, escolaridade e região.
- Página de detalhes com cargos, salários, prazos e acesso ao canal oficial do órgão.
- Simulados configuráveis por concurso, disciplina, assunto, banca, ano, dificuldade,
  quantidade de questões e tempo.
- Pausa, retomada, resultado e revisão de questões erradas em simulados.
- Perfil editável, tema claro/escuro e escolha de cargo desejado.
- Plano Básico e assinaturas KAD Diamante e KAD Círculo.

## Planos demonstrativos

| Recurso | Básico | KAD Diamante | KAD Círculo |
| --- | --- | --- | --- |
| Membros | 1 | 1 | 4 |
| Questões | Até 10 por dia | Sem limite | Sem limite |
| Gabarito comentado | Sim | Sim | Sim |
| Alertas de editais | Não | Sim | Sim |
| Estatísticas | Não | Sim | Sim |
| Simulados | Não | Sim | Sim |
| Plano de estudos | Não | Sim | Sim |

Os preços e as assinaturas fazem parte da demonstração visual. Não existe integração
com pagamento ou validação remota neste projeto. Os planos KAD oferecem ciclos mensal,
trimestral e anual. O KAD Círculo inclui quatro acessos pelo preço de três assinaturas
KAD Diamante do mesmo ciclo.

## Tecnologias

- Expo SDK 54
- React Native 0.81
- React 19
- Expo Router 6
- Supabase Auth e Postgres com Row Level Security
- Painel editorial web para gestão e publicação de concursos
- Expo SecureStore para a sessão no Android e iOS
- TypeScript em modo estrito
- AsyncStorage
- Node Test Runner para os testes unitários

## Pré-requisitos

- Node.js 22 ou superior
- npm
- Expo Go no dispositivo físico, ou um emulador Android/iOS

## Executando o projeto

```bash
npm install
npm start
```

## Configurando autenticação e banco

1. Crie um projeto no Supabase.
2. Copie `.env.example` para `.env` e preencha a URL e a chave publicável do projeto.
   Nunca use a chave `service_role` no aplicativo.
3. Execute, em ordem, os arquivos de `supabase/migrations` no SQL Editor ou use
   `supabase db push` após vincular o projeto.
4. Publique a função segura de exclusão de conta:

   ```bash
   supabase functions deploy delete-account
   ```

5. Em Authentication > URL Configuration, adicione `kad://auth/login` e
   `kad://auth/nova-senha` aos Redirect URLs para confirmação de cadastro e recuperação
   de senha no aplicativo instalado. Para testar no navegador, adicione também as URLs
   locais correspondentes exibidas pelo Expo.
6. Reinicie o Expo após alterar o `.env`.

Sem essas variáveis, o app continua funcionando em modo visitante, mas cadastro,
login e recuperação de senha informam que a conexão ainda não foi configurada.

Para abrir pelo Expo Go usando túnel:

```bash
npx expo start --tunnel
```

Outros comandos:

```bash
npm run android
npm run ios
npm run web
```

## Qualidade e testes

```bash
npm run test       # regras de acesso e integridade dos dados
npm run typecheck  # validação TypeScript
npm run lint       # ESLint configurado pelo Expo
npm run check      # executa as três verificações
```

Os testes cobrem:

- isolamento da pesquisa entre seletores;
- renovação e limite diário de questões;
- expiração local de assinatura;
- presença de canais oficiais nos concursos;
- quantidade mínima e consistência do banco de questões;
- presença de RLS nas tabelas pessoais e sociais;
- ausência da antiga exclusão privilegiada exposta;
- cálculo da taxa comunitária por totais reais.

## Estrutura

```text
app/          rotas e telas do Expo Router
admin/        painel administrativo web e fluxo editorial
components/   componentes visuais reutilizáveis
constants/    tokens de tema e espaçamento
data/         dados demonstrativos de questões, concursos, planos e cargos
hooks/        hooks de tema e plataforma
lib/          filtros, regras de acesso, busca e simulados
providers/    estado global e persistência local
tests/        testes automatizados
types/        tipos de domínio compartilhados
```

## Arquitetura de estado

- `AuthProvider`: sessão, cadastro, login, recuperação e exclusão da conta no Supabase.
- `AppProvider`: perfil, respostas, favoritas e concursos salvos sincronizados, além do
  cache local de assinatura, cota e tema.
- `SearchProvider`: filtros da pesquisa de questões.
- `SimulationProvider`: sessão atual do simulado, respostas e tempo restante.

As políticas RLS isolam os dados pessoais. Comentários são compartilhados entre contas,
mas apenas o autor pode editar ou excluir o próprio texto; cada curtida é única por
usuário. A porcentagem comunitária é calculada a partir de `question_attempts`, sem expor
as respostas individuais. O plano pago ainda é demonstrativo e não deve ser tratado como
autorização real até existir integração de pagamento no servidor.

## Dados demonstrativos

Os concursos, salários, vagas e datas são exemplos para desenvolvimento da interface.
Cada concurso possui um link para um canal oficial do órgão, mas o usuário deve conferir
o edital vigente antes de tomar qualquer decisão.

As questões foram escritas para demonstrar os fluxos do aplicativo. Banca, ano, órgão,
cargo e concurso associados às questões são ilustrativos.
