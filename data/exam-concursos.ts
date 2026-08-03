import type { ConcursoPack } from '@/types';

/**
 * Concursos disponíveis na aba de Simulados.
 *
 * Cada concurso reúne as questões das disciplinas listadas em `disciplines` (definidas em
 * `data/disciplines.ts`). Como as provas compartilham disciplinas, uma mesma questão pode
 * aparecer em mais de um concurso. Estrutura editável: adicione, edite ou remova concursos aqui.
 */
export const CONCURSO_PACKS: ConcursoPack[] = [
  {
    id: 'banco-do-brasil',
    name: 'Banco do Brasil',
    subtitle: 'Escriturário',
    icon: 'card-outline',
    color: '#C9A227',
    kind: 'concurso',
    disciplines: ['Língua Portuguesa', 'Matemática', 'Raciocínio Lógico', 'Informática', 'Atualidades'],
    questionScope: { institutions: ['Banco do Brasil'] },
    goalKeywords: ['Escriturário', 'Agente Comercial', 'Agente de Tecnologia'],
  },
  {
    id: 'policia-federal',
    name: 'Polícia Federal',
    subtitle: 'Agente',
    icon: 'shield-checkmark-outline',
    color: '#1A5276',
    kind: 'concurso',
    disciplines: ['Língua Portuguesa', 'Raciocínio Lógico', 'Informática', 'Direito', 'Legislação'],
    questionScope: { institutions: ['Polícia Federal'] },
    goalKeywords: ['Agente de Polícia Federal', 'Escrivão de Polícia Federal', 'Delegado Federal'],
  },
  {
    id: 'inss',
    name: 'INSS',
    subtitle: 'Técnico do Seguro Social',
    icon: 'shield-half-outline',
    color: '#16A085',
    kind: 'concurso',
    disciplines: [
      'Língua Portuguesa',
      'Raciocínio Lógico',
      'Ética no Serviço Público',
      'Direito',
      'Legislação',
      'Informática',
    ],
    questionScope: { institutions: ['INSS'] },
    goalKeywords: ['Técnico do Seguro Social', 'Analista do Seguro Social'],
  },
  {
    id: 'tribunais',
    name: 'Tribunais',
    subtitle: 'TJ, TRF e TRT',
    icon: 'library-outline',
    color: '#C0392B',
    kind: 'area',
    disciplines: ['Língua Portuguesa', 'Direito', 'Legislação', 'Raciocínio Lógico', 'Informática'],
    questionScope: {
      institutions: [
        'Tribunal Regional Federal',
        'Tribunal Regional do Trabalho',
        'Tribunal de Justiça',
        'TRF',
        'TRT',
        'TRE',
        'TJ-',
      ],
      roles: ['Analista Judiciário', 'Técnico Judiciário', 'Escrevente Técnico'],
    },
    goalKeywords: ['Analista Judiciário', 'Técnico Judiciário', 'Escrevente Técnico'],
  },
  {
    id: 'cnu',
    name: 'Concurso Nacional Unificado',
    subtitle: 'Nível médio e superior',
    icon: 'layers-outline',
    color: '#2874A6',
    kind: 'concurso',
    disciplines: [
      'Língua Portuguesa',
      'Raciocínio Lógico',
      'Atualidades',
      'Ética no Serviço Público',
      'Direito',
      'Legislação',
      'História',
      'Geografia',
    ],
    questionScope: { concursos: ['Concurso Público Nacional Unificado'] },
    goalKeywords: ['Técnico Administrativo', 'Analista Administrativo', 'CNU'],
  },
  {
    id: 'prefeituras-educacao',
    name: 'Prefeituras',
    subtitle: 'Educação e Professor',
    icon: 'school-outline',
    color: '#7D3C98',
    kind: 'area',
    disciplines: ['Língua Portuguesa', 'História', 'Geografia', 'Matemática', 'Atualidades'],
    questionScope: {
      institutions: ['Prefeitura', 'Secretaria Municipal de Educação', 'Secretaria de Educação'],
      roles: ['Professor'],
    },
    goalKeywords: ['Professor', 'Agente Administrativo', 'Fiscal Municipal', 'Prefeitura'],
  },
  {
    id: 'area-fiscal',
    name: 'Área Fiscal',
    subtitle: 'SEFAZ · Auditor e Analista',
    icon: 'cash-outline',
    color: '#1E8449',
    kind: 'area',
    disciplines: [
      'Língua Portuguesa',
      'Raciocínio Lógico',
      'Matemática',
      'Direito',
      'Contabilidade',
      'Legislação',
    ],
    questionScope: {
      institutions: ['SEFAZ', 'Secretaria Estadual da Fazenda'],
      roles: ['Auditor Fiscal', 'Analista de Finanças'],
    },
    goalKeywords: ['Auditor Fiscal', 'Analista de Finanças', 'Analista Tributário'],
  },
];
