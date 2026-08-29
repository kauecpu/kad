import { escapeHtml, formatPercent, initials } from '../core/utils.ts';

export function icon(name: string, className = ''): string {
  return `<i data-lucide="${escapeHtml(name)}" class="${escapeHtml(className)}" aria-hidden="true"></i>`;
}
export function badge(label: unknown, tone = 'neutral', iconName = ''): string {
  return `<span class="badge badge--${escapeHtml(tone)}">${iconName ? icon(iconName) : ''}${escapeHtml(label)}</span>`;
}

export function progress(value: number, label: string, tone = 'primary'): string {
  const bounded = Math.max(0, Math.min(100, Number(value) || 0));
  return `
    <div class="progress" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(bounded)}">
      <span class="progress__fill progress__fill--${escapeHtml(tone)}" style="width:${bounded}%"></span>
    </div>`;
}

export type ButtonOptions = {
  action?: string;
  route?: string;
  iconName?: string;
  variant?: string;
  size?: string;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
  disabled?: boolean;
  attrs?: string;
};

export function button(label: string, {
  action,
  route,
  iconName,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  disabled = false,
  attrs = '',
}: ButtonOptions = {}): string {
  const navigation = route ? `data-route="${escapeHtml(route)}"` : '';
  const behavior = action ? `data-action="${escapeHtml(action)}"` : '';
  return `<button class="button button--${escapeHtml(variant)} button--${escapeHtml(size)} ${escapeHtml(className)}" type="${escapeHtml(type)}" ${navigation} ${behavior} ${disabled ? 'disabled' : ''} ${attrs}>${iconName ? icon(iconName) : ''}<span>${escapeHtml(label)}</span></button>`;
}

export type PasswordFieldOptions = {
  id: string;
  label: string;
  name?: string;
  autocomplete?: string;
  minlength?: number;
};

export function passwordField({
  id,
  label,
  name = 'password',
  autocomplete = 'current-password',
  minlength = 8,
}: PasswordFieldOptions): string {
  return `<div class="field">
    <label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
    <div class="password-control">
      <input class="input" id="${escapeHtml(id)}" name="${escapeHtml(name)}" type="password" autocomplete="${escapeHtml(autocomplete)}" minlength="${Number(minlength) || 8}" required />
      <button class="password-toggle" type="button" data-action="toggle-password" aria-controls="${escapeHtml(id)}" aria-label="Mostrar senha" aria-pressed="false">${icon('Eye')}</button>
    </div>
  </div>`;
}

export function card(content: string, className = ''): string {
  return `<article class="card ${escapeHtml(className)}">${content}</article>`;
}

export function section(title: string, content: string, { eyebrow = '', action = '' }: { eyebrow?: string; action?: string } = {}): string {
  return `
    <section class="section">
      <header class="section__header">
        <div>${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}<h2>${escapeHtml(title)}</h2></div>
        ${action}
      </header>
      ${content}
    </section>`;
}

export type WorkspaceHeroOptions = {
  id: string;
  eyebrow: string;
  title: string;
  description: string;
  actions?: string;
  imageSrc?: string;
};

export function workspaceHero({ id, eyebrow, title, description, actions = '', imageSrc = '' }: WorkspaceHeroOptions): string {
  return `<section class="workspace-hero" aria-labelledby="${escapeHtml(id)}">
    <div class="workspace-hero__copy">
      <p class="eyebrow">${escapeHtml(eyebrow)}</p>
      <h2 id="${escapeHtml(id)}">${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
      ${actions ? `<div class="workspace-hero__actions">${actions}</div>` : ''}
    </div>
    ${imageSrc ? `<figure class="workspace-hero__visual" aria-hidden="true"><span class="workspace-hero__orbit"></span><img src="${escapeHtml(imageSrc)}" alt="" width="240" height="240" /></figure>` : ''}
  </section>`;
}

export function stat(value: string, label: string, iconName: string, tone = 'primary'): string {
  return `<div class="stat"><span class="stat__icon stat__icon--${escapeHtml(tone)}">${icon(iconName)}</span><div><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div></div>`;
}

export function avatar(name: string, size = 'md'): string {
  return `<span class="avatar avatar--${escapeHtml(size)}" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}

export function emptyState(title: string, description: string, { actionLabel, action, route, iconName = 'Info' }: { actionLabel?: string; action?: string; route?: string; iconName?: string } = {}): string {
  return card(`
    <div class="empty-state">
      <span class="empty-state__icon">${icon(iconName)}</span>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
      ${actionLabel ? button(actionLabel, { action, route, variant: 'secondary' }) : ''}
    </div>`, 'card--empty');
}

export function metricRing(value: number, label: string): string {
  const bounded = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="metric-ring" style="--value:${bounded}" role="img" aria-label="${escapeHtml(label)}: ${formatPercent(bounded)}"><div><strong>${formatPercent(bounded)}</strong><span>${escapeHtml(label)}</span></div></div>`;
}
