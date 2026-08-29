import { escapeHtml } from '../core/utils.ts';
import { avatar, button, icon } from './components.ts';
import type { SiteState } from '../types/domain.ts';

const mainNavigation = [
  { href: '/inicio', label: 'Início', icon: 'Home' },
  { href: '/questoes', label: 'Questões', icon: 'BookOpen' },
  { href: '/ranking', label: 'Ranking', icon: 'Trophy' },
  { href: '/simulados', label: 'Simulados', icon: 'Timer' },
  { href: '/perfil', label: 'Perfil', icon: 'User' },
];

const studyNavigation = [
  { href: '/concursos', label: 'Concursos', icon: 'Building2' },
  { href: '/trilhas', label: 'Trilhas', icon: 'Compass' },
  { href: '/redacao', label: 'Redação', icon: 'PenLine' },
  { href: '/biblioteca', label: 'Biblioteca', icon: 'Library' },
];

type NavigationItem = { href: string; label: string; icon: string };

function isActive(href: string, pathname: string): boolean {
  if (href === '/inicio') return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}
function navLink(item: NavigationItem, pathname: string, compact = false): string {
  const active = isActive(item.href, pathname);
  return `<a href="${item.href}" data-route="${item.href}" class="nav-link ${active ? 'is-active' : ''} ${compact ? 'nav-link--compact' : ''}" ${active ? 'aria-current="page"' : ''}>${icon(item.icon)}<span>${escapeHtml(item.label)}</span></a>`;
}

export function publicLayout(content: string, { simple = false, dark = false }: { simple?: boolean; dark?: boolean } = {}): string {
  return `
    <div class="public-shell ${simple ? 'public-shell--simple' : ''}">
      <header class="public-header">
        <a href="/" data-route="/" class="brand" aria-label="KAD Concursos — página inicial">
          <img src="/assets/kad-logo.png" alt="KAD Concursos" width="178" height="76" />
        </a>
        ${!simple ? `<nav class="public-section-nav" aria-label="Conheça o KAD">
          <a href="#kad-about" data-public-section-target="kad-about" class="is-active" aria-current="location">O KAD</a>
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
      </header>
      <main id="conteudo" class="public-main" tabindex="-1">${content}</main>
    </div>`;
}

export function appLayout(content: string, { pathname, title, subtitle, state }: { pathname: string; title: string; subtitle?: string; state: SiteState }): string {
  const profile = state.profile;
  return `
    <div class="app-shell">
      <aside class="sidebar" id="main-navigation">
        <div class="sidebar__header">
          <a href="/inicio" data-route="/inicio" class="brand brand--sidebar" aria-label="KAD Concursos — início">
            <img src="/assets/kad-logo.png" alt="KAD Concursos" width="150" height="64" />
          </a>
          <button class="icon-button sidebar__close" type="button" data-action="close-menu" aria-label="Fechar menu">${icon('X')}</button>
        </div>
        <nav class="sidebar__nav" aria-label="Navegação principal">
          ${mainNavigation.map((item) => navLink(item, pathname)).join('')}
        </nav>
        <p class="sidebar__label">Outras formas de estudar</p>
        <nav class="sidebar__nav sidebar__nav--secondary" aria-label="Recursos de estudo">
          ${studyNavigation.map((item) => navLink(item, pathname)).join('')}
        </nav>
        <div class="sidebar__footer">
          <button class="profile-summary" type="button" data-route="/perfil">
            ${avatar(profile.name)}
            <span><strong>${escapeHtml(profile.name)}</strong><small>${state.auth.mode === 'authenticated' ? 'Conta KAD' : 'Modo visitante'}</small></span>
            ${icon('ChevronRight')}
          </button>
        </div>
      </aside>
      <div class="app-column">
        <header class="topbar">
          <button class="icon-button topbar__menu" type="button" data-action="open-menu" aria-controls="main-navigation" aria-expanded="false" aria-label="Abrir menu">${icon('Menu')}</button>
          <div class="topbar__title"><h1>${escapeHtml(title)}</h1>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div>
          <div class="topbar__actions">
            <button class="desktop-search" type="button" data-route="/questoes/buscar">${icon('Search')}<span>Buscar questões</span><kbd>Ctrl K</kbd></button>
            <button class="icon-button" type="button" data-action="toggle-theme" aria-label="Alternar tema">${icon('Sun')}</button>
            <button class="avatar-button" type="button" data-route="/perfil" aria-label="Abrir perfil">${avatar(profile.name, 'sm')}</button>
          </div>
        </header>
        <main id="conteudo" class="page-content" tabindex="-1">${content}</main>
      </div>
      <nav class="mobile-tabs" aria-label="Navegação principal">
        ${mainNavigation.map((item) => navLink(item, pathname, true)).join('')}
      </nav>
      <button class="nav-scrim" type="button" data-action="close-menu" aria-label="Fechar menu"></button>
    </div>`;
}

export function stackHeader(title: string, subtitle = ''): string {
  return `<header class="stack-header"><button class="icon-button" type="button" data-action="back" aria-label="Voltar">${icon('ArrowLeft')}</button><div><h2>${escapeHtml(title)}</h2>${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ''}</div></header>`;
}
