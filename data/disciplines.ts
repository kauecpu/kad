import type { Discipline } from '@/types';

/**
 * Taxonomia de disciplinas e assuntos do aplicativo (dois níveis).
 *
 * Contém apenas assuntos cobrados em editais e questões de concursos públicos.
 * Esta é a fonte editável: para adicionar, editar ou remover disciplinas e assuntos,
 * basta alterar este arquivo. Cada questão em `data/questions.ts` referencia uma
 * disciplina (`discipline`) e um assunto (`topic`) definidos aqui.
 */
export const DISCIPLINES: Discipline[] = [
  {
    name: 'Língua Portuguesa',
    icon: 'book-outline',
    color: '#2F6FED',
    topics: [
      'Interpretação de textos',
      'Ortografia',
      'Pontuação',
      'Concordância',
      'Regência',
      'Crase',
    ],
  },
  {
    name: 'Raciocínio Lógico',
    icon: 'extension-puzzle-outline',
    color: '#7C3AED',
    topics: [
      'Lógica proposicional',
      'Tabelas-verdade',
      'Conjuntos',
      'Sequências lógicas',
      'Análise combinatória',
      'Problemas de raciocínio',
    ],
  },
  {
    name: 'Matemática',
    icon: 'calculator-outline',
    color: '#0E9F6E',
    topics: [
      'Porcentagem',
      'Regra de três',
      'Razão e proporção',
      'Equações',
      'Geometria',
      'Matemática financeira',
    ],
  },
  {
    name: 'Direito',
    icon: 'library-outline',
    color: '#C0392B',
    topics: [
      'Direitos e garantias fundamentais',
      'Remédios constitucionais',
      'Poder Legislativo',
      'Servidores públicos',
      'Princípios da administração pública',
      'Atos administrativos',
      'Licitações e contratos',
      'Aplicação da lei penal',
    ],
  },
  {
    name: 'Legislação',
    icon: 'document-text-outline',
    color: '#935116',
    topics: [
      'Regime jurídico dos servidores (Lei 8.112/1990)',
      'Processo administrativo (Lei 9.784/1999)',
      'Lei de Licitações (Lei 14.133/2021)',
      'Lei de Acesso à Informação',
      'Improbidade administrativa',
    ],
  },
  {
    name: 'Informática',
    icon: 'laptop-outline',
    color: '#0891B2',
    topics: [
      'Pacote Office (Word e Excel)',
      'Internet e navegadores',
      'Segurança da informação',
      'Sistemas operacionais',
      'Redes de computadores',
      'Hardware e software',
    ],
  },
  {
    name: 'Ética no Serviço Público',
    icon: 'shield-checkmark-outline',
    color: '#0D9488',
    topics: [
      'Código de Ética (Decreto 1.171/1994)',
      'Deveres e vedações do servidor',
      'Comissão de Ética',
      'Moralidade administrativa',
      'Improbidade administrativa (Lei 8.429/1992)',
      'Conflito de interesses',
    ],
  },
  {
    name: 'Contabilidade',
    icon: 'receipt-outline',
    color: '#C9A227',
    topics: [
      'Patrimônio e equação patrimonial',
      'Contas patrimoniais e de resultado',
      'Balanço patrimonial',
      'Regimes contábeis',
      'Demonstrações contábeis',
      'Contabilidade pública',
    ],
  },
  {
    name: 'Atualidades',
    icon: 'newspaper-outline',
    color: '#E67E22',
    topics: [
      'Política nacional',
      'Economia',
      'Meio ambiente e sustentabilidade',
      'Organismos internacionais',
      'Tecnologia e sociedade',
      'Geopolítica e conflitos',
    ],
  },
  {
    name: 'História',
    icon: 'time-outline',
    color: '#A0522D',
    topics: [
      'História do Brasil',
      'Brasil Colônia',
      'Brasil Império',
      'República Brasileira',
      'Era Vargas',
      'Ditadura Militar',
    ],
  },
  {
    name: 'Geografia',
    icon: 'earth-outline',
    color: '#2E7D32',
    topics: [
      'Geografia do Brasil',
      'Cartografia',
      'População',
      'Urbanização',
      'Economia brasileira',
      'Meio ambiente',
    ],
  },
];
