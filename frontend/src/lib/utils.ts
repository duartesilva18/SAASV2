/**
 * Utilitários partilhados
 */

export type UserWithProStatus = {
  is_admin?: boolean;
  subscription_status?: string;
} | null | undefined;

/** Verifica se o utilizador tem acesso Pro (admin ou subscrição ativa) */
export function hasProAccess(user: UserWithProStatus): boolean {
  if (!user) return false;
  if (user.is_admin) return true;
  return ['active', 'trialing', 'cancel_at_period_end'].includes(user.subscription_status || '');
}

/** Logger que só emite em desenvolvimento */
export const devLog = {
  log: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args);
    }
  },
  error: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.error(...args);
    }
  },
  warn: (...args: unknown[]) => {
    if (process.env.NODE_ENV === 'development') {
      console.warn(...args);
    }
  },
};
