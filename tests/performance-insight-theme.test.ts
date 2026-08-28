import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL as NodeURL } from 'node:url';

function source(path: string) {
  return readFileSync(new NodeURL(path, import.meta.url), 'utf8');
}

const theme = source('../constants/theme.ts');
const tones = source('../components/ui/tone.ts');
const performance = source('../app/perfil/desempenho.tsx');
const overview = source('../components/ui/metric-overview.tsx');
const designSystem = source('../docs/DESIGN_SYSTEM.md');

test('turquesa possui tokens próprios nos temas claro e escuro', () => {
  assert.match(theme, /insight: '#0F766E'/);
  assert.match(theme, /insightSoft: '#E6F7F5'/);
  assert.match(theme, /insight: '#2DD4BF'/);
  assert.match(theme, /insightSoft: '#10302C'/);
});

test('tom analítico é reutilizável sem substituir cores de estado', () => {
  assert.match(tones, /\| 'insight'/);
  assert.match(tones, /case 'insight':[\s\S]*?colors\.insightSoft[\s\S]*?colors\.insight/);
  assert.match(performance, /label="Taxa de acerto"/);
  assert.match(performance, /label: 'Acertos'[\s\S]*?tone: 'success'/);
  assert.match(performance, /label: 'Erros'[\s\S]*?tone: 'danger'/);
});

test('gráficos por matéria usam turquesa e preservam a acessibilidade', () => {
  assert.match(performance, /<ProgressBar[\s\S]*?color=\{colors\.insight\}/);
  assert.match(performance, /trackColor=\{colors\.surfaceSunken\}/);
  assert.match(performance, /label=\{`Acerto em \$\{subject\.subject\}`\}/);
});

test('resumo analítico concentra a hierarquia e se adapta a fontes ampliadas', () => {
  assert.match(overview, /fontScale > 1\.2/);
  assert.match(overview, /borderLeftColor: colors\.insight/);
  assert.match(overview, /accessibilityLabel=\{`\$\{item\.label\}: \$\{item\.value\}`\}/);
  assert.match(designSystem, /## MetricOverview/);
});

test('tela distingue carregamento, vazio e bloqueio sem inventar métricas', () => {
  assert.match(performance, /subscriptionLoading \? \(/);
  assert.match(performance, /canViewStatistics && performance\.total > 0/);
  assert.match(performance, /Seu desempenho começa aqui/);
  assert.match(performance, /Desempenho não incluído/);
});
