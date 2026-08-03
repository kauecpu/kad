export type EssayTopic = {
  id: string;
  packId: string;
  title: string;
  category: string;
  difficulty: 'Inicial' | 'Intermediária' | 'Avançada';
  suggestedMinutes: number;
  lineRange: string;
  context: string;
  command: string;
  criteria: string[];
};

/** Propostas próprias usadas para montar e validar o fluxo visual de redação. */
export const ESSAY_TOPICS: EssayTopic[] = [
  {
    id: 'tribunais-acesso-digital',
    packId: 'tribunais',
    title: 'Tecnologia e ampliação do acesso à Justiça',
    category: 'Cidadania e serviço público',
    difficulty: 'Intermediária',
    suggestedMinutes: 40,
    lineRange: '20 a 30 linhas',
    context:
      'A digitalização dos serviços judiciais ampliou possibilidades de atendimento, mas também revelou dificuldades de acesso para parte da população.',
    command:
      'Redija um texto dissertativo-argumentativo sobre os desafios para conciliar inovação tecnológica e acesso democrático à Justiça no Brasil.',
    criteria: ['Compreensão do tema', 'Argumentação', 'Coesão e coerência', 'Norma-padrão'],
  },
  {
    id: 'pf-desinformacao-seguranca',
    packId: 'policia-federal',
    title: 'Desinformação e segurança da sociedade',
    category: 'Segurança pública',
    difficulty: 'Avançada',
    suggestedMinutes: 45,
    lineRange: '20 a 30 linhas',
    context:
      'A circulação rápida de informações falsas pode afetar investigações, instituições públicas e decisões coletivas.',
    command:
      'Produza um texto dissertativo sobre o papel do Estado e da sociedade no enfrentamento à desinformação sem comprometer a liberdade de expressão.',
    criteria: ['Delimitação do problema', 'Consistência dos argumentos', 'Organização textual', 'Norma-padrão'],
  },
  {
    id: 'bb-inclusao-financeira',
    packId: 'banco-do-brasil',
    title: 'Inclusão financeira na transformação digital',
    category: 'Economia e tecnologia',
    difficulty: 'Inicial',
    suggestedMinutes: 35,
    lineRange: '20 a 30 linhas',
    context:
      'Serviços bancários digitais facilitaram operações cotidianas, embora uma parcela da população ainda encontre barreiras tecnológicas e educacionais.',
    command:
      'Redija um texto dissertativo-argumentativo sobre como ampliar a inclusão financeira em um cenário de crescente digitalização bancária.',
    criteria: ['Adequação ao tema', 'Desenvolvimento das ideias', 'Coesão', 'Norma-padrão'],
  },
  {
    id: 'inss-envelhecimento-protecao',
    packId: 'inss',
    title: 'Envelhecimento populacional e proteção social',
    category: 'Direitos sociais',
    difficulty: 'Intermediária',
    suggestedMinutes: 40,
    lineRange: '20 a 30 linhas',
    context:
      'O envelhecimento da população brasileira exige respostas coordenadas nas áreas de previdência, saúde, assistência e participação social.',
    command:
      'Elabore um texto dissertativo sobre os desafios da proteção social diante do envelhecimento da população brasileira.',
    criteria: ['Compreensão da proposta', 'Argumentação', 'Progressão textual', 'Norma-padrão'],
  },
  {
    id: 'cnu-etica-servico-publico',
    packId: 'cnu',
    title: 'Ética e confiança no serviço público',
    category: 'Administração pública',
    difficulty: 'Intermediária',
    suggestedMinutes: 40,
    lineRange: '20 a 30 linhas',
    context:
      'A confiança nas instituições depende tanto de mecanismos de controle quanto da conduta cotidiana dos agentes públicos.',
    command:
      'Escreva um texto dissertativo-argumentativo sobre a importância da ética para a qualidade e a legitimidade do serviço público.',
    criteria: ['Abordagem do tema', 'Repertório e argumentação', 'Estrutura', 'Norma-padrão'],
  },
  {
    id: 'prefeituras-cidades-sustentaveis',
    packId: 'prefeituras-educacao',
    title: 'Participação social na construção de cidades sustentáveis',
    category: 'Cidades e meio ambiente',
    difficulty: 'Inicial',
    suggestedMinutes: 35,
    lineRange: '20 a 30 linhas',
    context:
      'Soluções para mobilidade, resíduos, áreas verdes e uso dos espaços públicos dependem da atuação municipal e da participação dos cidadãos.',
    command:
      'Produza um texto dissertativo sobre a importância da participação social na construção de cidades mais sustentáveis.',
    criteria: ['Adequação ao tema', 'Clareza das ideias', 'Coesão e coerência', 'Norma-padrão'],
  },
  {
    id: 'fiscal-cidadania-tributaria',
    packId: 'area-fiscal',
    title: 'Cidadania tributária e financiamento de políticas públicas',
    category: 'Economia e cidadania',
    difficulty: 'Avançada',
    suggestedMinutes: 45,
    lineRange: '20 a 30 linhas',
    context:
      'A compreensão sobre arrecadação, transparência e aplicação dos recursos públicos influencia a relação entre sociedade e Estado.',
    command:
      'Redija um texto dissertativo-argumentativo sobre como a cidadania tributária pode fortalecer o controle social das políticas públicas.',
    criteria: ['Precisão temática', 'Qualidade argumentativa', 'Organização textual', 'Norma-padrão'],
  },
];
