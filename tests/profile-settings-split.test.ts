import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { URL } from 'node:url';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const profile = source('../app/(tabs)/perfil.tsx');
const settings = source('../app/(tabs)/configuracoes.tsx');
const layout = source('../app/(tabs)/_layout.tsx');

test('Perfil e Configurações são áreas canônicas separadas no Drawer', () => {
  assert.match(layout, /name="perfil" options=\{\{ title: 'Perfil' \}\}/);
  assert.match(layout, /name="configuracoes" options=\{\{ title: 'Configurações' \}\}/);
  assert.match(profile, /title="Meu perfil"/);
  assert.match(settings, /title="Configurações"/);
  assert.match(profile, /accessibilityLabel="Abrir configurações"/);
});

test('Perfil mostra somente identidade e evolução do aluno', () => {
  for (const content of ['SEU PERFIL PÚBLICO', 'LevelProgressCard', 'AchievementGallery', 'Minha preparação', 'Posição no ranking']) {
    assert.match(profile, new RegExp(content));
  }
  for (const administrative of ['Alterar senha', 'Termos de Uso', 'Excluir conta', 'Tema do app', 'Gerenciar plano']) {
    assert.doesNotMatch(profile, new RegExp(administrative));
  }
});

test('Configurações concentra conta, aparência, notificações, privacidade, plano e sessão', () => {
  for (const section of ['Conta', 'Aparência e acessibilidade', 'Notificações', 'Privacidade', 'Plano e assinatura', 'Sessão']) {
    assert.match(settings, new RegExp(`title="${section}"`));
  }
  assert.match(settings, /ThemePreferenceControl/);
  assert.match(settings, /updateRankingOptIn/);
  assert.match(settings, /Gerenciar plano/);
  assert.match(settings, /Sair da conta/);
  assert.match(settings, /clearSimulationData\(\), deleteAccount\(\)/);
});

test('notificações não ganham um controle sem efeito real', () => {
  assert.match(settings, /O KAD ainda não envia notificações/);
  assert.doesNotMatch(settings, /accessibilityLabel="Ativar notificações"/);
});
