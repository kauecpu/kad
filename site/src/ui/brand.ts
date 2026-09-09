import { escapeHtml } from '../core/utils.ts';

export type KadSignalOptions = {
  variant?: 'color' | 'mono' | 'compact';
  title?: string;
  className?: string;
};

/** A restrained KAD signature: one crisp asymmetric beam that leans forward instead of a stock lightning glyph. */
export function kadSignalMark({ variant = 'color', title = '', className = '' }: KadSignalOptions = {}): string {
  const labelled = Boolean(title);
  const titleMarkup = labelled ? `<title>${escapeHtml(title)}</title>` : '';
  return `<svg class="kad-signal kad-signal--${variant} ${escapeHtml(className)}" viewBox="0 0 64 88" xmlns="http://www.w3.org/2000/svg" ${labelled ? `role="img" aria-label="${escapeHtml(title)}"` : 'aria-hidden="true"'} focusable="false">
    ${titleMarkup}
    <path class="kad-signal__beam" d="M39 4 10 45h20l-8 39 33-50H37L50 4Z" />
  </svg>`;
}
