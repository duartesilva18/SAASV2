/**
 * Validação leve partilhada (cliente). Os limites coincidem com os schemas Pydantic do
 * backend (backend/app/schemas/schemas.py) para que a validação cliente e servidor estejam
 * alinhadas. Cada função devolve uma mensagem de erro localizada ou `null` se válido.
 */
import { isLocalDateAfterToday } from './dateLocal';

// Limites alinhados com o backend (_AMOUNT_MAX_CENTS = 100_000_000_00 cêntimos).
export const MAX_AMOUNT_UNITS = 100_000_000; // 100 milhões na moeda
export const MAX_TEXT_DESCRIPTION = 255;
export const MAX_TEXT_NAME = 100;
export const HEX_COLOR_RE = /^#[0-9A-Fa-f]{6}$/;

type Opts = { isEn?: boolean };

const msg = (isEn: boolean | undefined, pt: string, en: string) => (isEn ? en : pt);

/** Converte texto de valor ("12,50" / "12.50") em cêntimos inteiros, ou null se inválido. */
export function parseAmountToCents(raw: string): number | null {
  if (raw == null) return null;
  const normalized = String(raw).trim().replace(',', '.');
  if (!normalized) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}

/** Valida um valor monetário (em unidades). allowZero=false por defeito. */
export function validateAmount(raw: string, opts: Opts & { allowZero?: boolean } = {}): string | null {
  const { isEn, allowZero = false } = opts;
  const normalized = String(raw ?? '').trim().replace(',', '.');
  if (!normalized) return msg(isEn, 'Indica um valor.', 'Enter an amount.');
  const value = Number(normalized);
  if (!Number.isFinite(value)) return msg(isEn, 'Valor inválido.', 'Invalid amount.');
  if (!allowZero && value <= 0) return msg(isEn, 'O valor tem de ser maior que zero.', 'Amount must be greater than zero.');
  if (allowZero && value < 0) return msg(isEn, 'O valor não pode ser negativo.', 'Amount cannot be negative.');
  if (value > MAX_AMOUNT_UNITS) return msg(isEn, 'Valor demasiado elevado.', 'Amount is too large.');
  return null;
}

/** Texto obrigatório com limite de comprimento. */
export function validateRequiredText(raw: string, max: number = MAX_TEXT_NAME, opts: Opts = {}): string | null {
  const { isEn } = opts;
  const v = (raw ?? '').trim();
  if (!v) return msg(isEn, 'Campo obrigatório.', 'This field is required.');
  if (v.length > max) return msg(isEn, `Máximo ${max} caracteres.`, `Maximum ${max} characters.`);
  return null;
}

/** Texto opcional, apenas valida o comprimento máximo. */
export function validateMaxLen(raw: string, max: number, opts: Opts = {}): string | null {
  const { isEn } = opts;
  if ((raw ?? '').length > max) return msg(isEn, `Máximo ${max} caracteres.`, `Maximum ${max} characters.`);
  return null;
}

export function validateEmail(raw: string, opts: Opts = {}): string | null {
  const { isEn } = opts;
  const v = (raw ?? '').trim();
  if (!v) return msg(isEn, 'Indica o teu email.', 'Enter your email.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return msg(isEn, 'Email inválido.', 'Invalid email.');
  return null;
}

/** Password forte (>=8, maiúscula, minúscula, dígito) — mesma regra do backend. */
export function validatePassword(raw: string, opts: Opts = {}): string | null {
  const { isEn } = opts;
  const v = raw ?? '';
  if (v.length < 8) return msg(isEn, 'Mínimo 8 caracteres.', 'Minimum 8 characters.');
  if (!/[A-Z]/.test(v)) return msg(isEn, 'Inclui uma letra maiúscula.', 'Include an uppercase letter.');
  if (!/[a-z]/.test(v)) return msg(isEn, 'Inclui uma letra minúscula.', 'Include a lowercase letter.');
  if (!/\d/.test(v)) return msg(isEn, 'Inclui um número.', 'Include a number.');
  return null;
}

/** Data (YYYY-MM-DD) não pode ser no futuro. */
export function validateDateNotFuture(ymd: string, opts: Opts = {}): string | null {
  const { isEn } = opts;
  if (!ymd) return msg(isEn, 'Indica uma data.', 'Enter a date.');
  if (isLocalDateAfterToday(ymd)) return msg(isEn, 'A data não pode ser no futuro.', 'Date cannot be in the future.');
  return null;
}

export function validateHexColor(raw: string, opts: Opts = {}): string | null {
  const { isEn } = opts;
  if (!HEX_COLOR_RE.test(raw ?? '')) return msg(isEn, 'Cor inválida.', 'Invalid color.');
  return null;
}

export function validateDayOfMonth(value: number | string, opts: Opts = {}): string | null {
  const { isEn } = opts;
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  if (!Number.isInteger(n) || n < 1 || n > 31) return msg(isEn, 'Dia do mês entre 1 e 31.', 'Day of month must be 1–31.');
  return null;
}
