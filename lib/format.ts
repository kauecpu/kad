/** Funções de formatação para o padrão brasileiro. */

const currencyFormatter = (() => {
  try {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  } catch {
    return null;
  }
})();

/** Formata um valor em reais. Possui fallback manual caso a Intl não esteja disponível. */
export function formatCurrency(value: number): string {
  if (currencyFormatter) {
    return currencyFormatter.format(value);
  }

  const [integer, decimals] = value.toFixed(2).split('.');
  const withSeparators = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `R$ ${withSeparators},${decimals}`;
}

/** Versão compacta para cartões: R$ 5,9 mil / R$ 19,7 mil. */
export function formatSalaryShort(value: number): string {
  if (value >= 1000) {
    const thousands = value / 1000;
    const text = thousands.toFixed(1).replace(/\.0$/, '');
    return `R$ ${text.replace('.', ',')} mil`;
  }
  return formatCurrency(value);
}

function formatThousands(value: number): string {
  const thousands = value / 1000;
  return thousands.toFixed(1).replace(/\.0$/, '').replace('.', ',');
}

/** Faixa compacta para cartões: R$ 2,1–3,5 mil. */
export function formatSalaryRangeShort(minimum: number, maximum: number): string {
  if (minimum === maximum) return `Até ${formatSalaryShort(maximum)}`;

  if (minimum >= 1000 && maximum >= 1000) {
    return `R$ ${formatThousands(minimum)}–${formatThousands(maximum)} mil`;
  }

  return `${formatSalaryShort(minimum)}–${formatSalaryShort(maximum)}`;
}

/** Converte 'YYYY-MM-DD' em 'DD/MM/AAAA' sem depender do fuso horário. */
export function formatDate(isoDate?: string): string {
  if (!isoDate) return '--';
  const [year, month, day] = isoDate.split('-');
  if (!year || !month || !day) return '--';
  return `${day}/${month}/${year}`;
}

/** Data curta: 'DD/MM'. */
export function formatShortDate(isoDate?: string): string {
  if (!isoDate) return '--';
  const [, month, day] = isoDate.split('-');
  if (!month || !day) return '--';
  return `${day}/${month}`;
}

function toLocalDate(isoDate: string): Date | null {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

/** Dias restantes até a data informada. Negativo quando já passou. */
export function daysUntil(isoDate?: string): number | null {
  if (!isoDate) return null;
  const target = toLocalDate(isoDate);
  if (!target) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const diff = target.getTime() - today.getTime();
  return Math.round(diff / 86400000);
}

/** Texto relativo usado em "atualizado há...". */
export function formatRelativeDay(isoDate?: string): string {
  const days = daysUntil(isoDate);
  if (days === null) return '--';
  if (days === 0) return 'hoje';
  if (days === -1) return 'ontem';
  if (days < -1) return `há ${Math.abs(days)} dias`;
  if (days === 1) return 'amanhã';
  return `em ${days} dias`;
}

/** Iniciais para o avatar quando não há foto. */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
