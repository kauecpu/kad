# Flashcards

A primeira versão permite criar cards particulares, organizados em baralhos e revisados por repetição espaçada.

## Dados e privacidade

Cards e baralhos são isolados por usuário. Em sessão autenticada, o estado é sincronizado com as tabelas `flashcard_decks`, `flashcards` e `flashcard_reviews`; cada tabela possui RLS por `auth.uid()`. Em modo visitante, os dados ficam no armazenamento local protegido e não são enviados ao Supabase.

O MVP não altera questões, gabaritos, classificações ou explicações e não cria vínculos com o acervo editorial.

## Revisão

Cada resposta atualiza o intervalo e a próxima data de forma determinística:

- **Errei:** volta em 10 minutos;
- **Difícil:** intervalo de pelo menos 1 dia, reduzindo a facilidade;
- **Acertei:** repete o intervalo multiplicado pela facilidade;
- **Fácil:** usa um intervalo maior e aumenta a facilidade.

O histórico guarda cada avaliação pelo identificador único do card e do instante da revisão. Repetições da mesma operação são idempotentes.

## Verificação local

```bash
npm run check
```

A migration `20260828230000_flashcards.sql` deve ser aplicada primeiro em homologação. O app usa somente a chave pública configurada no ambiente; nenhuma chave administrativa pertence ao cliente.

