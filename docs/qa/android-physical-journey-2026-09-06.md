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
- ausência de travamento ou estouro visual nas telas percorridas.

### Defeito encontrado e corrigido

O Desafio rápido podia tentar acessar a primeira questão enquanto o provedor ainda
carregava. Quando a consulta retornava vazia, a tela acessava uma questão inexistente
e encerrava com `Cannot read property 'id' of undefined`.

A tela agora aguarda o carregamento, congela o conjunto somente quando existem
questões e apresenta estados explícitos de carregamento, erro, nova tentativa e
conteúdo vazio.

### Verificações automáticas

- suíte completa: 460 testes aprovados;
- verificação de tipos: aprovada;
- lint: aprovado;
- testes específicos do Desafio rápido: 3 aprovados.

## Pendências externas à correção

- O ambiente remoto conectado respondeu com zero questões publicadas. A jornada de
  conteúdo foi validada no corpus local de demonstração, mas a publicação de conteúdo
  remoto precisa ser tratada antes da liberação.
- Login real, expiração de sessão e troca entre duas contas ainda exigem que uma conta
  KAD válida seja autenticada manualmente no aparelho. Nenhuma credencial foi coletada
  ou registrada neste relatório.
