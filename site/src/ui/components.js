import { escapeHtml, formatPercent, initials } from '../core/utils.js';

export function icon(name, className = '') {
  return `<i data-lucide="${escapeHtml(name)}" class="${escapeHtml(className)}" aria-hidden="true"></i>`;
}
export function badge(label, tone = 'neutral', iconName = '') {
  return `<span class="badge badge--${escapeHtml(tone)}">${iconName ? icon(iconName) : ''}${escapeHtml(label)}</span>`;
}

export function progress(value, label, tone = 'primary') {
  const bounded = Math.max(0, Math.min(100, Number(value) || 0));
  return `
    <div class="progress" role="progressbar" aria-label="${escapeHtml(label)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(bounded)}">
      <span class="progress__fill progress__fill--${escapeHtml(tone)}" style="width:${bounded}%"></span>
    </div>`;
}

export function button(label, {
  action,
  route,
  iconName,
  variant = 'primary',
  size = 'md',
  className = '',
  type = 'button',
  disabled = false,
  attrs = '',
} = {}) {
  const navigation = route ? `data-route="${escapeHtml(route)}"` : '';
  const behavior = action ? `data-action="${escapeHtml(action)}"` : '';
  return `<button class="button button--${escapeHtml(variant)} button--${escapeHtml(size)} ${escapeHtml(className)}" type="${escapeHtml(type)}" ${navigation} ${behavior} ${disabled ? 'disabled' : ''} ${attrs}>${iconName ? icon(iconName) : ''}<span>${escapeHtml(label)}</span></button>`;
}

export function passwordField({
  id,
  label,
  name = 'password',
  autocomplete = 'current-password',
  minlength = 8,
} = {}) {
  return `<div class="field">
    <label for="${escapeHtml(id)}">${escapeHtml(label)}</label>
    <div class="password-control">
      <input class="input" id="${escapeHtml(id)}" name="${escapeHtml(name)}" type="password" autocomplete="${escapeHtml(autocomplete)}" minlength="${Number(minlength) || 8}" required />
      <button class="password-toggle" type="button" data-action="toggle-password" aria-controls="${escapeHtml(id)}" aria-label="Mostrar senha" aria-pressed="false">${icon('Eye')}</button>
    </div>
  </div>`;
}

export function card(content, className = '') {
  return `<article class="card ${escapeHtml(className)}">${content}</article>`;
}

export function section(title, content, { eyebrow = '', action = '' } = {}) {
  return `
    <section class="section">
      <header class="section__header">
        <div>${eyebrow ? `<p class="eyebrow">${escapeHtml(eyebrow)}</p>` : ''}<h2>${escapeHtml(title)}</h2></div>
        ${action}
      </header>
      ${content}
    </section>`;
}

export function stat(value, label, iconName, tone = 'primary') {
  return `<div class="stat"><span class="stat__icon stat__icon--${escapeHtml(tone)}">${icon(iconName)}</span><div><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div></div>`;
}

export function avatar(name, size = 'md') {
  return `<span class="avatar avatar--${escapeHtml(size)}" aria-hidden="true">${escapeHtml(initials(name))}</span>`;
}

export function emptyState(title, description, { actionLabel, action, route, iconName = 'Info' } = {}) {
  return card(`
    <div class="empty-state">
      <span class="empty-state__icon">${icon(iconName)}</span>
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(description)}</p>
      ${actionLabel ? button(actionLabel, { action, route, variant: 'secondary' }) : ''}
    </div>`, 'card--empty');
}

export function metricRing(value, label) {
  const bounded = Math.max(0, Math.min(100, Number(value) || 0));
  return `<div class="metric-ring" style="--value:${bounded}" role="img" aria-label="${escapeHtml(label)}: ${formatPercent(bounded)}"><div><strong>${formatPercent(bounded)}</strong><span>${escapeHtml(label)}</span></div></div>`;
}
