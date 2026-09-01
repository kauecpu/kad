import { escapeHtml } from '../core/utils.ts';
import { backendStateMessage, type BackendState } from '../core/backend-state.ts';
import { avatar, button, icon } from './components.ts';
import {
  isMobileMoreActive,
  isNavigationItemActive,
  mobilePrimaryNavigation,
  navigationGroups,
  type NavigationItem,
} from './navigation.ts';
import type { SiteState } from '../types/domain.ts';

function backendStatus(state: BackendState, compact = false): string {
  const copy = backendStateMessage(state);
  if (compact) {
    return `<div class="app-status app-status--${copy.tone}" data-backend-status role="status" title="${escapeHtml(copy.description)}"><span class="app-status__dot" aria-hidden="true"></span><strong>${escapeHtml(copy.label)}</strong><span class="sr-only">. ${escapeHtml(copy.description)}</span></div>`;
  }
  return `<aside class="backend-status backend-status--${copy.tone}" data-backend-status role="status"><strong>${escapeHtml(copy.label)}</strong><span>${escapeHtml(copy.description)}</span></aside>`;
}
function navLink(item: NavigationItem, pathname: string, compact = false): string {
  const active = isNavigationItemActive(item.href, pathname);
  return `<a href="${item.href}" data-route="${item.href}" class="nav-link ${active ? 'is-active' : ''} ${compact ? 'nav-link--compact' : ''}" ${active ? 'aria-current="page"' : ''}>${icon(item.icon)}<span>${escapeHtml(item.label)}</span></a>`;
}

export function publicLayout(content: string, { simple = false, dark = false, backendState }: { simple?: boolean; dark?: boolean; backendState: BackendState } ): string {
  return `
    <div class="public-shell ${simple ? 'public-shell--simple' : 'public-shell--landing'}">
      <header class="public-header">
        <a href="/" data-route="/" class="brand" aria-label="KAD Concursos — página inicial">
          <img src="/assets/kad-logo.png" alt="KAD Concursos" width="178" height="76" />
        </a>
        ${!simple ? `<nav class="public-nav" aria-label="Navegação do site">
          <a href="#kad-how" data-public-section-target="kad-how">Como funciona</a>
          <a href="#kad-plans" data-public-section-target="kad-plans">Planos</a>
        </nav>` : ''}
        <div class="public-header__actions">
          ${button(dark ? 'Escuro' : 'Claro', { action: 'toggle-theme', variant: 'ghost', iconName: dark ? 'Moon' : 'Sun', className: 'icon-label-button', attrs: `aria-label="Ativar tema ${dark ? 'claro' : 'escuro'}" aria-pressed="${dark}"` })}
          ${!simple ? button('Entrar', { action: 'open-public-auth', variant: 'secondary', className: 'public-header__login', attrs: 'data-auth-mode="login"' }) : ''}
        </div>
      </header>
      <main id="conteudo" class="public-main" tabindex="-1">${backendStatus(backendState)}${content}</main>
    </div>`;
}

function experienceArchetype(pathname: string): 'desk' | 'catalog' | 'session' | 'journey' | 'settings' {
  if (/^\/(questoes\/(sessao|desafio)|simulados\/em-andamento|flashcards\/revisar)/.test(pathname)) return 'session';
  if (/^\/(trilhas|ranking|perfil\/desempenho|questoes\/revisar|simulados\/resultado)/.test(pathname)) return 'journey';
  if (pathname.startsWith('/perfil')) return 'settings';
  if (/^\/(questoes|simulados|concursos|redacao|flashcards|biblioteca)/.test(pathname)) return 'catalog';
  return 'desk';
}

export function appLayout(content: string, { pathname, title, subtitle, state, backendState }: { pathname: string; title: string; subtitle?: string; state: SiteState; backendState: BackendState }): string {
  const profile = state.profile;
  const dark = document.documentElement.dataset.theme === 'dark';
  const experience = experienceArchetype(pathname);
  return `
    <div class="app-shell app-shell--${experience}${pathname.startsWith('/perfil') ? ' app-shell--profile' : ''}" data-study-environment="${experience}">
      <aside class="sidebar" id="main-navigation">
        <div class="sidebar__header">
          <a href="/inicio" data-route="/inicio" class="brand brand--sidebar" aria-label="KAD Concursos — início">
            <img src="/assets/kad-logo.png" alt="KAD Concursos" width="150" height="64" />
          </a>
          <button class="icon-button sidebar__close" type="button" data-action="close-menu" aria-label="Fechar menu">${icon('X')}</button>
        </div>
        <nav class="sidebar__navigation" aria-label="Navegação principal">
          ${navigationGroups.map((group) => `<section class="sidebar__group" aria-labelledby="nav-group-${group.id}">
            <h2 class="sidebar__label" id="nav-group-${group.id}">${escapeHtml(group.label)}</h2>
            <div class="sidebar__nav">${group.items.map((item) => navLink(item, pathname)).join('')}</div>
          </section>`).join('')}
        </nav>
        <div class="sidebar__footer">
          <a class="profile-summary ${isNavigationItemActive('/perfil', pathname) ? 'is-active' : ''}" href="/perfil" data-route="/perfil" ${isNavigationItemActive('/perfil', pathname) ? 'aria-current="page"' : ''}>
            ${avatar(profile.name, 'md', profile.avatarUri)}
            <span><strong>${escapeHtml(profile.name)}</strong><small>${state.auth.mode === 'authenticated' ? 'Conta KAD' : 'Modo visitante'}</small></span>
            ${icon('ChevronRight')}
          </a>
        </div>
      </aside>
      <div class="app-column">
        <header class="topbar">
          <button class="icon-button topbar__menu" type="button" data-action="open-menu" aria-controls="main-navigation" aria-expanded="false" aria-label="Abrir menu">${icon('Menu')}</button>
          <div class="topbar__title"><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>
          <div class="topbar__actions">
            ${backendStatus(backendState, true)}
            <button class="desktop-search" type="button" data-route="/questoes/buscar">${icon('Search')}<span>Buscar questões</span><kbd>Ctrl K</kbd></button>
            <button class="icon-button" type="button" data-action="toggle-theme" aria-label="Ativar tema ${dark ? 'claro' : 'escuro'}" aria-pressed="${dark}">${icon(dark ? 'Moon' : 'Sun')}</button>
            <button class="avatar-button" type="button" data-route="/perfil" aria-label="Abrir perfil">${avatar(profile.name, 'sm', profile.avatarUri)}</button>
          </div>
        </header>
        <main id="conteudo" class="page-content" tabindex="-1">${content}</main>
      </div>
      <nav class="mobile-tabs" aria-label="Navegação principal">
        ${mobilePrimaryNavigation.map((item) => navLink(item, pathname, true)).join('')}
        <button class="nav-link nav-link--compact nav-link--more ${isMobileMoreActive(pathname) ? 'is-active' : ''}" type="button" data-action="open-menu" aria-controls="main-navigation" aria-expanded="false" aria-label="Abrir mais destinos">${icon('Menu')}<span>Mais</span></button>
      </nav>
      <button class="nav-scrim" type="button" data-action="close-menu" aria-label="Fechar menu"></button>
    </div>`;
}

export function stackHeader(title: string, subtitle = ''): string {
  return `<nav class="stack-header" aria-label="Navegação contextual"><button class="icon-button" type="button" data-action="back" aria-label="Voltar de ${escapeHtml(title)}">${icon('ArrowLeft')}</button>${subtitle ? `<p class="stack-header__context">${escapeHtml(subtitle)}</p>` : ''}</nav>`;
}
