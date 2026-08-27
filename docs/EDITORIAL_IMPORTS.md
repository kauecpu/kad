# Importação editorial de concursos e questões

O coletor vive no repositório separado `kad-collector`. Este repositório recebe a saída do coletor, valida os registros e oferece revisão humana no painel administrativo.

## Fluxo

1. O coletor exporta JSONL/NDJSON (um objeto JSON por linha) ou uma lista JSON.
2. O administrador abre **Importações** e seleciona o arquivo para validar os envelopes localmente.
3. O Supabase revalida até 5.000 registros, detecta duplicatas pelo identificador estável e pela origem e cria um lote privado.
4. No staging, o administrador inspeciona fonte e conteúdo, corrige o JSON de registros inválidos e solicita nova validação.
5. O administrador escolhe importar, atualizar o registro existente ou ignorar cada duplicata.
6. Ao aplicar o lote, concursos e questões entram como `draft`, mesmo que o arquivo tente informar outro estado.
7. A publicação acontece somente nas telas **Concursos** e **Banco de questões**, por usuário com `content.publish`.
8. Um lote aplicado pode ser desfeito. Conteúdo já publicado ou alterado depois da importação é protegido contra reversão automática.

## Contratos versionados

O contrato v1 continua aceito sem mudanças e exige uma explicação em texto. O contrato v2 é a
versão canônica para novas exportações de questões e torna a explicação opcional. Sua fonte é
`contracts/editorial-question-import-v2.schema.json`; o SHA-256 canônico publicado em
`contracts/editorial-question-import-v2.sha256` deve ser idêntico no Collector.

Quando o v2 inclui explicação, `data.explanation` contém `text`, `origin` (`official`,
`editorial` ou `ai`) e `reviewStatus` (`draft` ou `reviewed`). Conteúdo de IA também exige
`provider`, `model` e `promptVersion`. A ausência desse objeto não impede rascunho nem publicação.
Uma reimportação sem explicação preserva a explicação existente.

## Envelope versão 1

Todo registro possui este envelope:

```json
{
  "schemaVersion": 1,
  "kind": "question",
  "source": {
    "provider": "site-da-banca",
    "externalId": "prova-2026-questao-17",
    "url": "https://exemplo.org/provas/2026/questao-17",
    "collectedAt": "2026-08-09T14:30:00Z",
    "fingerprint": "sha256-opcional"
  },
  "data": {}
}
```

Regras do envelope:

- `schemaVersion` deve ser `1`.
- `kind` aceita `question` ou `concurso`.
- `source.provider` identifica o conector/coletor e `source.externalId` é o identificador estável na origem.
- `source.url` deve usar HTTPS e apontar para a fonte verificável.
- `source.collectedAt` deve ser uma data ISO 8601.
- `data.id` deve ser um slug estável de 3 a 120 caracteres (`a-z`, `0-9` e hífen).

## Questão

```json
{"schemaVersion":1,"kind":"question","source":{"provider":"banca-exemplo","externalId":"2026-17","url":"https://exemplo.org/questoes/17","collectedAt":"2026-08-09T14:30:00Z"},"data":{"id":"q-banca-exemplo-2026-17","discipline":"Direito","subject":"Direito Constitucional","topic":"Direitos fundamentais","board":"Banca Exemplo","year":2026,"role":"Analista","institution":"Órgão Exemplo","concurso":"Órgão Exemplo — Analista","level":"Superior","difficulty":"Média","statement":"Enunciado completo da questão com contexto suficiente.","alternatives":[{"id":"A","text":"Primeira alternativa."},{"id":"B","text":"Segunda alternativa."},{"id":"C","text":"Terceira alternativa."},{"id":"D","text":"Quarta alternativa."}],"correct":"B","explanation":"Explicação fundamentada do gabarito e das alternativas."}}
```

No v1, `explanation` permanece obrigatório. No v2, `explanation` e `difficulty` são opcionais na
entrada como rascunho. A dificuldade precisa ser definida antes da publicação; ela nunca recebe
um valor presumido durante a importação.

- `level`: `Fundamental`, `Médio` ou `Superior`.
- `difficulty`: `Fácil`, `Média` ou `Difícil`.
- `alternatives`: de 2 a 5 objetos com `id` entre `A` e `E` e texto não vazio.
- `correct`: deve apontar para uma alternativa presente.

## Concurso

```json
{"schemaVersion":1,"kind":"concurso","source":{"provider":"diario-oficial-exemplo","externalId":"edital-42-2026","url":"https://exemplo.gov.br/editais/42-2026","collectedAt":"2026-08-09T14:30:00Z"},"data":{"id":"c-orgao-exemplo-2026","shortName":"OE","icon":"business-outline","iconColor":"#6D28D9","organ":"Órgão Exemplo","title":"Edital 42/2026","board":"Banca Exemplo","state":"CE","region":"Nordeste","levels":["Médio","Superior"],"vacancies":20,"salaryMin":3500,"salaryMax":7800,"registrationStart":"2026-08-10","registrationEnd":"2026-09-10","examDate":"2026-11-08","fee":95,"status":"aberto","roles":[{"name":"Técnico","vacancies":12,"salary":3500,"level":"Médio"},{"name":"Analista","vacancies":8,"salary":7800,"level":"Superior"}],"highlights":["20 vagas","Prova objetiva"],"editalUrl":"https://exemplo.gov.br/editais/42-2026"}}
```

Os campos seguem o editor de concursos atual. `roles` precisa ter ao menos um cargo e `editalUrl` deve usar HTTPS. Datas usam `YYYY-MM-DD`; valores monetários são números em reais, sem símbolo ou separador de milhar.

## Segurança e operação

- Arquivos nunca recebem credenciais, cookies, tokens ou HTML executável.
- As tabelas de lote e itens ficam no schema `private`, com RLS e sem acesso direto para `anon` ou `authenticated`.
- O cliente acessa o fluxo somente por RPCs que verificam `content.read`, `content.write` e `content.publish` no servidor.
- O aplicativo consulta apenas linhas com `publication_status = 'published'`.
- Criação, aplicação, publicação e reversão geram registros na auditoria administrativa.
- A importação não baixa URLs nem executa código enviado pelo coletor; ela armazena dados estruturados e a referência da fonte.
