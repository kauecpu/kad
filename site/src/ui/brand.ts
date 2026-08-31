import { escapeHtml } from '../core/utils.ts';

export type KadSignalOptions = {
  variant?: 'color' | 'mono' | 'compact';
  title?: string;
  className?: string;
};

/** A restrained KAD signature: an asymmetric beam that leans forward instead of a stock lightning glyph. */
export function kadSignalMark({ variant = 'color', title = '', className = '' }: KadSignalOptions = {}): string {
  const labelled = Boolean(title);
  const titleMarkup = labelled ? `<title>${escapeHtml(title)}</title>` : '';
  return `<svg class="kad-signal kad-signal--${variant} ${escapeHtml(className)}" viewBox="0 0 64 88" xmlns="http://www.w3.org/2000/svg" ${labelled ? `role="img" aria-label="${escapeHtml(title)}"` : 'aria-hidden="true"'} focusable="false">
    ${titleMarkup}
    <path class="kad-signal__beam" d="M38 3 9 45h22l-8 40 32-49H36L49 3Z" />
    <path class="kad-signal__cut" d="m9 45 22 0-8 40 12-30-8-4Z" />
    <path class="kad-signal__trail" d="M3 58h14l-3 5H0Z" />
  </svg>`;
}
