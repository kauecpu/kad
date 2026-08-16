export type RankingPeriod = 'today' | 'month' | 'all';

export type RankingParticipantSeed = {
  id: string;
  name: string;
  username: string;
  initials: string;
  basePoints: Record<RankingPeriod, number>;
  accuracy: number;
  streak: number;
  specialties: string[];
};

/** Participantes fictícios usados exclusivamente na prévia frontend do ranking. */
export const RANKING_PARTICIPANTS: RankingParticipantSeed[] = [
  {
    id: 'ana-tavares',
    name: 'Ana Tavares',
    username: '@ana_tj',
    initials: 'AT',
    basePoints: { today: 48, month: 826, all: 6480 },
    accuracy: 91,
    streak: 18,
    specialties: ['tribunais', 'cnu'],
  },
  {
    id: 'lucas-medeiros',
    name: 'Lucas Medeiros',
    username: '@lucas_pf',
    initials: 'LM',
    basePoints: { today: 44, month: 792, all: 6134 },
    accuracy: 88,
    streak: 14,
    specialties: ['policia-federal'],
  },
  {
    id: 'marina-costa',
    name: 'Marina Costa',
    username: '@marina_aprova',
    initials: 'MC',
    basePoints: { today: 41, month: 755, all: 5870 },
    accuracy: 93,
    streak: 21,
    specialties: ['area-fiscal', 'cnu'],
  },
  {
    id: 'joao-victor',
    name: 'João Victor',
    username: '@joao_inss',
    initials: 'JV',
    basePoints: { today: 38, month: 698, all: 5422 },
    accuracy: 86,
    streak: 11,
    specialties: ['inss'],
  },
  {
    id: 'beatriz-lima',
    name: 'Beatriz Lima',
    username: '@bia_bb',
    initials: 'BL',
    basePoints: { today: 35, month: 644, all: 5018 },
    accuracy: 89,
    streak: 9,
    specialties: ['banco-do-brasil'],
  },
  {
    id: 'rafael-sousa',
    name: 'Rafael Sousa',
    username: '@rafa_cnu',
    initials: 'RS',
    basePoints: { today: 32, month: 601, all: 4675 },
    accuracy: 84,
    streak: 7,
    specialties: ['cnu', 'prefeituras-educacao'],
  },
  {
    id: 'camila-rocha',
    name: 'Camila Rocha',
    username: '@camila_fiscal',
    initials: 'CR',
    basePoints: { today: 29, month: 558, all: 4210 },
    accuracy: 87,
    streak: 12,
    specialties: ['area-fiscal'],
  },
  {
    id: 'pedro-henrique',
    name: 'Pedro Henrique',
    username: '@pedro_pref',
    initials: 'PH',
    basePoints: { today: 25, month: 493, all: 3864 },
    accuracy: 81,
    streak: 6,
    specialties: ['prefeituras-educacao'],
  },
];
