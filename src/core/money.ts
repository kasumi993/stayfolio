/**
 * Amount parsing and formatting.
 *
 * Amount fields accept small sums the way a spreadsheet cell does:
 * `175156+14000`, `153,53 + 5 + 5`, `(20000-18000)/2`.
 */

const ZERO_DECIMAL = new Set(['XOF', 'XAF', 'JPY', 'KRW', 'GNF']);

const SYMBOL: Record<string, string> = {
  XOF: 'F',
  XAF: 'F',
  EUR: '€',
  USD: '$',
  GBP: '£',
  CAD: 'CA$',
  MAD: 'DH',
};

export const decimalsOf = (currency: string) => (ZERO_DECIMAL.has(currency) ? 0 : 2);

export const symbolOf = (currency: string) => SYMBOL[currency] ?? currency;

export function round(value: number, decimals = 0): number {
  const f = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * f) / f;
}

/** `1234567.5` → `1 234 568` (narrow no-break spaces between thousands). */
export function formatNumber(value: number, decimals = 0): string {
  const fixed = Math.abs(round(value, decimals)).toFixed(decimals);
  const [int, frac] = fixed.split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  const sign = round(value, decimals) < 0 ? '−' : '';
  return sign + grouped + (frac ? ',' + frac : '');
}

export interface FormatOptions {
  /** Prefix positive values with `+`. */
  sign?: boolean;
  /** Leave the currency symbol out. */
  bare?: boolean;
}

export function formatMoney(value: number, currency: string, opts: FormatOptions = {}): string {
  const n = formatNumber(value, decimalsOf(currency));
  const signed = opts.sign && round(value, decimalsOf(currency)) > 0 ? '+' + n : n;
  return opts.bare ? signed : `${signed} ${symbolOf(currency)}`;
}

/** Short form for tight spaces: `1,2 M`, `450 k`. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '−' : '';
  if (abs >= 1_000_000) return `${sign}${String(round(abs / 1_000_000, 1)).replace('.', ',')} M`;
  if (abs >= 10_000) return `${sign}${Math.round(abs / 1000)} k`;
  return formatNumber(value);
}

export const formatPercent = (fraction: number): string =>
  `${String(round(fraction * 100, 2)).replace('.', ',')} %`;

/**
 * Evaluates what the user typed in an amount field.
 * Supports + − × ÷ and parentheses, decimal comma or point, and spaces as
 * thousands separators. Returns null when the text is not a valid sum.
 */
export function evalAmount(input: string): number | null {
  const src = input
    .replace(/[\s \u00a0]/g, '')
    .replace(/,/g, '.')
    .replace(/[×xX]/g, '*')
    .replace(/[÷:]/g, '/')
    .replace(/[−–]/g, '-')
    .replace(/^=/, '');
  if (!src || !/^[0-9+\-*/().]+$/.test(src)) return null;

  let pos = 0;
  const peek = () => src[pos];

  // Grammar: expr = term (('+'|'-') term)* ; term = factor (('*'|'/') factor)*
  const factor = (): number => {
    if (peek() === '-') {
      pos++;
      return -factor();
    }
    if (peek() === '+') {
      pos++;
      return factor();
    }
    if (peek() === '(') {
      pos++;
      const v = expr();
      if (peek() !== ')') throw new Error('unbalanced');
      pos++;
      return v;
    }
    const m = /^\d*\.?\d+|^\d+\.?/.exec(src.slice(pos));
    if (!m) throw new Error('number expected');
    pos += m[0].length;
    return Number(m[0]);
  };
  const term = (): number => {
    let v = factor();
    while (peek() === '*' || peek() === '/') {
      const op = src[pos++];
      const r = factor();
      v = op === '*' ? v * r : v / r;
    }
    return v;
  };
  const expr = (): number => {
    let v = term();
    while (peek() === '+' || peek() === '-') {
      const op = src[pos++];
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };

  try {
    const v = expr();
    return pos === src.length && Number.isFinite(v) ? v : null;
  } catch {
    return null;
  }
}

/** True when the text is a sum rather than a plain number. */
export const isFormula = (input: string): boolean => /\d\s*[+\-*/×÷−]\s*[\d(]/.test(input.trim());
