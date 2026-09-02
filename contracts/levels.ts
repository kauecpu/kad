/** Level rules v1. Pure domain code shared by the site and native app. */
export type LevelActivity = { id: string; itemId: string; occurredAt: string } & (
  | { kind: 'question'; selected: string; isCorrect: boolean; reviewed: boolean }
  | { kind: 'flashcard'; rating: 'again' | 'hard' | 'good' | 'easy' }
  | { kind: 'simulation'; answers: { itemId: string; selected: string; isCorrect: boolean }[] }
);
export type LevelEntry = {
  id: string; itemId: string; kind: 'question' | 'review' | 'flashcard' | 'simulation' | 'consistency';
  xp: number; at: string; day: string; isCorrect?: boolean;
  reason: 'earned' | 'repeated' | 'daily_limit' | 'ineligible';
};
export type LevelLedger = { version: 1; totalXp: number; entries: LevelEntry[] };
export type LevelSnapshot = {
  totalXp: number; level: number; currentXp: number; nextCost: number;
  remainingXp: number; ratio: number; max: boolean;
};
export const LEVEL_MILESTONES = [10, 25, 50, 75, 100] as const;
export const LEVEL_RULES = [
  ['Questões', '10 XP na primeira resposta válida de cada questão. Até 20 questões por dia.'],
  ['Revisão de erros', '20 XP ao revisar o comentário de um erro e tentar de novo. Uma vez por questão a cada 7 dias, até 5 revisões por dia.'],
  ['Simulados', '20 XP extra ao concluir com pelo menos 10 questões distintas respondidas. Um bônus por dia; respostas já pontuadas não contam de novo.'],
  ['Flashcards', '5 XP por cartão revelado e avaliado. Uma vez por cartão ao dia, até 10 cartões por dia.'],
  ['Constância', '20 XP por dia com 3 atividades que concedem XP, em pelo menos 2 itens diferentes.'],
  ['Seu ritmo', 'O nível nunca diminui por pausa ou erro. Assinaturas não dão XP. O nível 100 continua acumulando XP, sem criar um nível 101.'],
  ['Sincronização', 'Contas confirmam o XP no servidor. Atividades offline usam os limites do dia em que sincronizam (horário de Brasília). O progresso de visitante é local e separado da conta.'],
] as const;

export function emptyLevelLedger(): LevelLedger { return { version: 1, totalXp: 0, entries: [] }; }
export function levelProgress(totalXp: number): LevelSnapshot {
  if (!Number.isSafeInteger(totalXp) || totalXp < 0) throw new Error('Invalid XP');
  let level = 0;
  while (level < 100 && totalXp >= 15 * (level + 1) ** 2 + 135 * (level + 1)) level++;
  const currentXp = totalXp - (15 * level ** 2 + 135 * level);
  const max = level === 100;
  const nextCost = max ? 0 : 150 + 30 * level;
  return { totalXp, level, currentXp, nextCost, remainingXp: max ? 0 : nextCost - currentXp, ratio: max ? 1 : currentXp / nextCost, max };
}

/** Perceptual OKLab interpolation, not alpha opacity over a theme background. */
export function levelColor(level: number): string {
  const t = Math.max(0, Math.min(100, Number.isFinite(level) ? level : 0)) / 100;
  if (t === 0) return '#FFFFFF';
  if (t === 1) return '#6D28D9';
  const linear = [109, 40, 217].map(v => { const c = v / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
  const [r, g, b] = linear;
  const l = Math.cbrt(0.4122214708*r + 0.5363325363*g + 0.0514459929*b);
  const m = Math.cbrt(0.2119034982*r + 0.6806995451*g + 0.1073969566*b);
  const s = Math.cbrt(0.0883024619*r + 0.2817188376*g + 0.6299787005*b);
  const L = 1 + t * (0.2104542553*l + 0.793617785*m - 0.0040720468*s - 1);
  const a = t * (1.9779984951*l - 2.428592205*m + 0.4505937099*s);
  const bb = t * (0.0259040371*l + 0.7827717662*m - 0.808675766*s);
  const ll = (L + 0.3963377774*a + 0.2158037573*bb) ** 3;
  const mm = (L - 0.1055613458*a - 0.0638541728*bb) ** 3;
  const ss = (L - 0.0894841775*a - 1.291485548*bb) ** 3;
  return '#' + [4.0767416621*ll - 3.3077115913*mm + 0.2309699292*ss, -1.2684380046*ll + 2.6097574011*mm - 0.3413193965*ss, -0.0041960863*ll - 0.7034186147*mm + 1.707614701*ss].map(c => {
    const value = c <= 0.0031308 ? 12.92*c : 1.055 * c ** (1/2.4) - 0.055;
    return Math.round(Math.max(0, Math.min(1, value))*255).toString(16).padStart(2, '0');
  }).join('').toUpperCase();
}

export function levelDay(at: string): string {
  const date = new Date(at);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid activity date');
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

export function isLevelActivity(value: unknown): value is LevelActivity {
  if (!value || typeof value !== 'object') return false;
  const e = value as LevelActivity;
  if (typeof e.id !== 'string' || !e.id || e.id.length > 200 || typeof e.itemId !== 'string' || !e.itemId || e.itemId.length > 200 || !Number.isFinite(Date.parse(e.occurredAt))) return false;
  const answer = (q: { itemId: string; selected: string; isCorrect: boolean }) => typeof q?.itemId === 'string' && q.itemId.length > 0 && q.itemId.length <= 200 && /^[A-E]$/.test(q.selected) && typeof q.isCorrect === 'boolean';
  if (e.kind === 'question') return answer(e) && typeof e.reviewed === 'boolean';
  if (e.kind === 'flashcard') return ['again', 'hard', 'good', 'easy'].includes(e.rating);
  return e.kind === 'simulation' && Array.isArray(e.answers) && e.answers.length <= 200 && e.answers.every(answer);
}

/** Local visitor rules only. Account XP is calculated independently by the server. */
export function applyLevelActivity(source: LevelLedger, activity: LevelActivity, at: string): LevelLedger {
  if (!isLevelActivity(activity)) throw new Error('Invalid level activity');
  if (source.entries.some(e => e.id === activity.id)) return source;
  const day = levelDay(at);
  let ledger = { ...source, entries: [...source.entries] };
  if (activity.kind === 'simulation') {
    const distinct = [...new Map(activity.answers.map(q => [q.itemId, q])).values()];
    for (const q of distinct) ledger = applyLevelActivity(ledger, { ...q, kind: 'question', id: `${activity.id}:${q.itemId}`.slice(0, 200), reviewed: false, occurredAt: activity.occurredAt }, at);
  }
  const entries = ledger.entries;
  const previous = entries.filter(e => e.itemId === activity.itemId && ['question', 'review'].includes(e.kind)).at(-1);
  let kind: LevelEntry['kind'] = activity.kind;
  let xp = 0;
  let reason: LevelEntry['reason'] = 'earned';
  let cap = 0;
  if (activity.kind === 'question') {
    cap = 20;
    if (!previous) xp = 10;
    else if (activity.reviewed && previous.isCorrect === false) {
      kind = 'review'; cap = 5;
      const last = entries.filter(e => e.kind === 'review' && e.itemId === activity.itemId && e.xp > 0).at(-1);
      if (!last || Date.parse(at) - Date.parse(last.at) >= 7 * 86400000) xp = 20;
      else reason = 'repeated';
    } else reason = 'repeated';
  } else if (activity.kind === 'flashcard') {
    cap = 10;
    if (entries.some(e => e.kind === 'flashcard' && e.itemId === activity.itemId && e.day === day)) reason = 'repeated';
    else xp = 5;
  } else {
    cap = 1;
    if (entries.some(e => e.kind === 'simulation' && e.itemId === activity.itemId)) reason = 'repeated';
    else if (new Set(activity.answers.map(q => q.itemId)).size >= 10) xp = 20;
    else reason = 'ineligible';
  }
  if (xp && entries.filter(e => e.kind === kind && e.day === day && e.xp > 0).length >= cap) { xp = 0; reason = 'daily_limit'; }
  entries.push({ id: activity.id, itemId: activity.itemId, kind, xp, reason, day, at, ...(activity.kind === 'question' ? { isCorrect: activity.isCorrect } : {}) });
  ledger.totalXp += xp;
  const qualifying = entries.filter(e => e.day === day && e.xp > 0 && ['question', 'review', 'flashcard'].includes(e.kind));
  if (qualifying.length >= 3 && new Set(qualifying.map(e => `${e.kind === 'flashcard' ? 'c' : 'q'}:${e.itemId}`)).size >= 2 && !entries.some(e => e.kind === 'consistency' && e.day === day)) {
    entries.push({ id: `consistency:${day}`, itemId: day, kind: 'consistency', xp: 20, at, day, reason: 'earned' });
    ledger.totalXp += 20;
  }
  return ledger;
}
