import { escapeHtml } from '../core/utils.ts';
import { backendStateMessage, type BackendState } from '../core/backend-state.ts';
import { avatar, button, icon } from './components.ts';
import {
  homeNavigationItem,
  isNavigationGroupActive,
  isNavigationItemActive,
  navigationExperienceForPathname,
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
function navLink(item: NavigationItem, pathname: string): string {
  const active = isNavigationItemActive(item.href, pathname);
  return `<a href="${item.href}" data-route="${item.href}" class="nav-link ${active ? 'is-active' : ''}" ${active ? 'aria-current="page"' : ''}>${icon(item.icon)}<span>${escapeHtml(item.label)}</span></a>`;
}

export function publicLayout(content: string, { simple = false, dark = false, backendState }: { simple?: boolean; dark?: boolean; backendState: BackendState } ): string {
  return `
    <div class="public-shell ${simple ? 'public-shell--simple' : 'public-shell--landing'}">
      <header class="public-header">
        <div class="public-header__inner">
          <a href="/" data-route="/" class="brand" aria-label="KAD Concursos — página inicial">
            <img src="/assets/kad-logo.png" alt="KAD Concursos" width="178" height="76" />
          </a>
          ${!simple ? `<nav class="public-section-nav" aria-label="Navegação da apresentação">
            <a href="#kad-about" data-public-section-target="kad-about">O KAD</a>
            <a href="#kad-how" data-public-section-target="kad-how">Como funciona</a>
            <a href="#kad-tools" data-public-section-target="kad-tools">Ferramentas</a>
            <a href="#kad-contests" data-public-section-target="kad-contests">Concursos</a>
            <a href="#kad-plans" data-public-section-target="kad-plans">Planos</a>
            <a href="#kad-faq" data-public-section-target="kad-faq">Dúvidas</a>
          </nav>` : ''}
          <div class="public-header__actions">
            ${button(dark ? 'Escuro' : 'Claro', { action: 'toggle-theme', variant: 'ghost', iconName: dark ? 'Moon' : 'Sun', className: 'icon-label-button', attrs: `aria-label="Ativar tema ${dark ? 'claro' : 'escuro'}" aria-pressed="${dark}"` })}
            ${!simple ? button('Entrar', { action: 'open-public-auth', variant: 'secondary', className: 'public-header__login', attrs: 'data-auth-mode="login"' }) : ''}
          </div>
        </div>
      </header>
      <main id="conteudo" class="public-main" tabindex="-1">${simple ? backendStatus(backendState) : ''}${content}</main>
    </div>`;
}

function experienceArchetype(pathname: string): 'desk' | 'catalog' | 'session' | 'journey' | 'settings' {
  if (/^\/(questoes\/(sessao|desafio)|simulados\/em-andamento|flashcards\/revisar)/.test(pathname)) return 'session';
  if (/^\/(trilhas|ranking|perfil\/desempenho|questoes\/revisar|simulados\/resultado)/.test(pathname)) return 'journey';
  if (pathname.startsWith('/perfil') || pathname === '/configuracoes') return 'settings';
  if (/^\/(questoes|simulados|concursos|redacao|flashcards|biblioteca)/.test(pathname)) return 'catalog';
  return 'desk';
}

export function appLayout(content: string, { pathname, title, subtitle, state, backendState }: { pathname: string; title: string; subtitle?: string; state: SiteState; backendState: BackendState }): string {
  const profile = state.profile;
  const dark = document.documentElement.dataset.theme === 'dark';
  const experience = experienceArchetype(pathname);
  const navigationExperience = navigationExperienceForPathname(pathname);
  return `
    <div class="app-shell app-shell--${experience} app-shell--family-${navigationExperience.id}${pathname.startsWith('/perfil') || pathname === '/configuracoes' ? ' app-shell--profile' : ''}" data-study-environment="${experience}" data-navigation-experience="${navigationExperience.id}">
      <aside class="sidebar" id="main-navigation">
        <div class="sidebar__header">
          <a href="/inicio" data-route="/inicio" class="brand brand--sidebar" aria-label="KAD Concursos — início">
            <img src="/assets/kad-logo.png" alt="KAD Concursos" width="150" height="64" />
          </a>
          <button class="icon-button sidebar__close" type="button" data-action="close-menu" aria-label="Fechar menu">${icon('X')}</button>
        </div>
        <nav class="sidebar__navigation" aria-label="Navegação principal">
          <div class="sidebar__home">${navLink(homeNavigationItem, pathname)}</div>
          ${navigationGroups.map((group) => `<section class="sidebar__group ${isNavigationGroupActive(group.id, pathname) ? 'is-active' : ''}" aria-labelledby="nav-group-${group.id}">
            <h2 class="sidebar__label" id="nav-group-${group.id}">${escapeHtml(group.label)}</h2>
            <div class="sidebar__nav">${group.items.map((item) => navLink(item, pathname)).join('')}</div>
          </section>`).join('')}
        </nav>
      </aside>
      <div class="app-column">
        <header class="topbar">
          <button class="icon-button topbar__menu" type="button" data-action="open-menu" aria-controls="main-navigation" aria-expanded="false" aria-label="Abrir menu">${icon('Menu')}</button>
          <div class="topbar__title">
            <span class="topbar__experience">${icon(navigationExperience.icon)}${escapeHtml(navigationExperience.label)}</span>
            <h1>${escapeHtml(title)}</h1>
            ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}
          </div>
          <div class="topbar__actions">
            ${backendStatus(backendState, true)}
            <button class="desktop-search" type="button" data-route="/questoes/buscar">${icon('Search')}<span>Buscar questões</span><kbd>Ctrl K</kbd></button>
            <button class="icon-button" type="button" data-action="toggle-theme" aria-label="Ativar tema ${dark ? 'claro' : 'escuro'}" aria-pressed="${dark}">${icon(dark ? 'Moon' : 'Sun')}</button>
            <button class="avatar-button" type="button" data-route="/perfil" aria-label="Abrir perfil">${avatar(profile.name, 'sm', profile.avatarUri)}</button>
          </div>
        </header>
        <main id="conteudo" class="page-content" tabindex="-1">${content}</main>
      </div>
      <button class="nav-scrim" type="button" data-action="close-menu" aria-label="Fechar menu"></button>
    </div>`;
}

export function stackHeader(title: string, subtitle = ''): string {
  return `<nav class="stack-header" aria-label="Navegação contextual"><button class="icon-button" type="button" data-action="back" aria-label="Voltar de ${escapeHtml(title)}">${icon('ArrowLeft')}</button>${subtitle ? `<p class="stack-header__context">${escapeHtml(subtitle)}</p>` : ''}</nav>`;
}
