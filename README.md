# KAD

Aplicativo de preparação para concursos públicos desenvolvido com Expo e React Native.
O produto reúne questões comentadas, busca avançada, concursos, simulados e gestão de
perfil e planos.

> Repositório privado para uso interno da equipe KAD. Não compartilhe código,
> documentação ou dados fora das pessoas autorizadas.

> Autenticação, perfil, respostas, favoritas, concursos salvos, comentários, curtidas e
> estatísticas comunitárias usam Supabase quando o projeto está configurado. Simulados e
> tema mantêm um cache local isolado por usuário; assinaturas são validadas no servidor.

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

## Pagamentos e assinaturas

O checkout web do KAD Diamante usa Mercado Pago e aceita os meios disponibilizados pelo
provedor, incluindo Pix e cartão. O acesso só é liberado após a confirmação do webhook;
nenhuma credencial de pagamento fica no aplicativo. A configuração e o procedimento de
publicação estão em [`docs/PAYMENTS.md`](docs/PAYMENTS.md).

Compras dentro dos aplicativos Android e iOS permanecem desativadas até a integração
com Google Play Billing e Apple In-App Purchase.

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

## Autenticação e banco

Copie `.env.example` para `.env` e preencha somente as variáveis públicas indicadas.
Nunca use uma chave administrativa no aplicativo nem envie credenciais ao GitHub.

Migrações, funções, SMTP, redirecionamentos e demais configurações de produção devem
ser executados apenas pelo responsável técnico. Sem as variáveis públicas, o app
continua disponível no modo visitante.

## E-mails de autenticação

O projeto possui uma Edge Function preparada para encaminhar e-mails do Supabase Auth
à API do Resend. A função permanece desativada até a marca e o domínio de envio serem
definidos e verificados. Consulte [`docs/EMAILS.md`](docs/EMAILS.md) antes de configurar
segredos, publicar a função ou habilitar o Send Email Hook.

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

Os testes verificam regras de acesso, persistência, integridade dos dados e segurança.

## Estrutura

```text
app/                    rotas e telas do Expo Router
components/             componentes visuais reutilizáveis
lib/, providers/, types/ lógica e tipos usados pelo aplicativo
tests/                  testes automatizados
```

## Arquitetura de estado

O estado do aplicativo é organizado em providers por domínio. Dados sincronizados usam
políticas de acesso no banco e testes automatizados. A assinatura é lida do Supabase e
nunca é persistida localmente como fonte de autorização.

## Dados demonstrativos

Os concursos, salários, vagas e datas são exemplos para desenvolvimento da interface.
Cada concurso possui um link para um canal oficial do órgão, mas o usuário deve conferir
o edital vigente antes de tomar qualquer decisão.

As questões foram escritas para demonstrar os fluxos do aplicativo. Banca, ano, órgão,
cargo e concurso associados às questões são ilustrativos.
