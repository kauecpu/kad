# Validação física Android — jornada de estudo

Data: 2026-09-06  
Dispositivo: Moto G15, Android 15  
Execução: Expo Go compatível com SDK 54, via USB/ADB

## Resultado

### Aprovado no aparelho

- abertura do aplicativo e navegação em modo visitante;
- acesso a Questões e ao Desafio rápido;
- resposta das três questões com feedback e comentário;
- fechamento forçado e reabertura sem perder a resposta já registrada;
- continuidade do desafio sem internet;
- restauração da conexão e conclusão do desafio;
- retorno à tela inicial com atividade recente;
- envio do aplicativo ao segundo plano e retomada na tela anterior;
- botão Voltar do Android funcionando na navegação testada;
- campos de login, teclado e ocultação de senha acessíveis no aparelho;
- autenticação com uma conta KAD válida;
- persistência da sessão após fechamento forçado e reabertura;
- manutenção da sessão e da navegação durante perda e restauração da conexão;
- saída da conta com confirmação e permanência deslogada após reabrir;
- carregamento do nível e do progresso de XP no perfil após novo login;
- ausência de travamento ou estouro visual nas telas percorridas.

### Defeito encontrado e corrigido

O Desafio rápido podia tentar acessar a primeira questão enquanto o provedor ainda
carregava. Quando a consulta retornava vazia, a tela acessava uma questão inexistente
e encerrava com `Cannot read property 'id' of undefined`.

A tela agora aguarda o carregamento, congela o conjunto somente quando existem
questões e apresenta estados explícitos de carregamento, erro, nova tentativa e
conteúdo vazio.

Depois do primeiro login, as telas protegidas eram removidas corretamente, mas as
telas de autenticação ainda tentavam redirecionar de forma imperativa. Isso gerava
um aviso de estado de navegação inválido no Android. O redirecionamento duplicado
foi removido: o `Stack.Protected` retorna para a rota raiz e ela escolhe onboarding
ou início conforme o estado da conta.

A sincronização de nível retornava “Nível indisponível” porque as migrações de
flashcards e níveis ainda não estavam aplicadas na homologação. Depois da aplicação
das duas migrações, um novo login no Moto G15 carregou corretamente “Nível 0 de 100”
e “0 / 150 XP” no perfil.

### Verificações automáticas

- suíte completa: 460 testes aprovados após a correção de navegação;
- verificação de tipos: aprovada;
- lint: aprovado;
- testes específicos do Desafio rápido: 3 aprovados.

## Pendências externas à correção

- O ambiente remoto conectado respondeu com zero questões publicadas. A jornada de
  conteúdo foi validada no corpus local de demonstração, mas a publicação de conteúdo
  remoto precisa ser tratada antes da liberação.
- Expiração de sessão e troca entre duas contas ainda exigem uma segunda conta KAD
  válida. Nenhuma credencial foi coletada ou registrada neste relatório.
