import assert from 'node:assert/strict';
import test from 'node:test';

import { profileHeroAction } from '../lib/profile-presentation.ts';

test('usuário autenticado edita o próprio dossiê', () => {
  assert.deepEqual(
    profileHeroAction({ isAuthenticated: true, isAuthConfigured: true }),
    {
      label: 'Editar meu perfil',
      description: 'Atualize seus dados e sua meta',
      href: '/perfil/editar',
    }
  );
});

test('visitante recebe a ação de sincronização quando o login está disponível', () => {
  assert.deepEqual(
    profileHeroAction({ isAuthenticated: false, isAuthConfigured: true }),
    {
      label: 'Criar conta e sincronizar',
      description: 'Leve sua preparação para outros aparelhos',
      href: '/auth/cadastro',
    }
  );
});

test('visitante mantém os dados locais quando o login está indisponível', () => {
  assert.deepEqual(
    profileHeroAction({ isAuthenticated: false, isAuthConfigured: false }),
    {
      label: 'Login indisponível',
      description: 'Seus dados continuam salvos neste aparelho',
    }
  );
});
