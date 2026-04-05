/**
 * Datas para <input type="date"> e validações: usar calendário local, não UTC.
 * toISOString().split('T')[0] pode ser "ontem" em fusos à frente de UTC (ex.: Europa após meia-noite).
 */
export function getLocalDateISO(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Interpreta YYYY-MM-DD como meia-noite no fuso local. */
export function parseLocalDateOnly(ymd: string): Date {
  const parts = ymd.split('-').map((x) => parseInt(x, 10));
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) {
    return new Date(NaN);
  }
  const [y, mo, day] = parts;
  return new Date(y, mo - 1, day);
}

/** True se o dia civil local da string for posterior ao dia de hoje (local). */
export function isLocalDateAfterToday(ymd: string): boolean {
  const selected = parseLocalDateOnly(ymd);
  if (Number.isNaN(selected.getTime())) return true;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  selected.setHours(0, 0, 0, 0);
  return selected.getTime() > today.getTime();
}
