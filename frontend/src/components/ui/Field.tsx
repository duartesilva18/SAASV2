'use client';

/**
 * Primitivas de formulário padronizadas. Replicam EXATAMENTE o estilo já usado nos modais
 * (bg-slate-950/60, border-slate-700, rounded-xl, focus ring azul, min-h-48, 16px no mobile),
 * acrescentando: label consistente, ícone prefixo opcional, estado de erro e acessibilidade
 * (aria-invalid / aria-describedby). O aspeto fica igual; muda só a reutilização.
 */
import React, { useId } from 'react';
import { ChevronDown } from 'lucide-react';

const LABEL = 'block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5';

function inputClass(hasIcon: boolean, hasError: boolean, extra = '') {
  return [
    'w-full bg-slate-950/60 border rounded-xl py-3 pr-3 text-base sm:text-sm text-white',
    'placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 min-h-[48px]',
    hasIcon ? 'pl-11' : 'pl-3',
    hasError ? 'border-red-500/50' : 'border-slate-700',
    extra,
  ].join(' ');
}

interface FieldProps {
  label?: React.ReactNode;
  error?: string | null;
  icon?: React.ReactNode;
  children: (ids: { id: string; describedBy?: string; invalid: boolean }) => React.ReactNode;
}

/** Wrapper: label + ícone prefixo + erro, com ligação a11y para o input filho. */
export function Field({ label, error, icon, children }: FieldProps) {
  const id = useId();
  const errId = error ? `${id}-err` : undefined;
  return (
    <div>
      {label && <label htmlFor={id} className={LABEL}>{label}</label>}
      <div className="relative">
        {icon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none shrink-0">
            {icon}
          </span>
        )}
        {children({ id, describedBy: errId, invalid: !!error })}
      </div>
      {error && <p id={errId} className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
}

type BaseInput = React.InputHTMLAttributes<HTMLInputElement> & { hasIcon?: boolean; invalid?: boolean };

export const TextInput = React.forwardRef<HTMLInputElement, BaseInput>(function TextInput(
  { hasIcon, invalid, className = '', ...props }, ref,
) {
  return <input ref={ref} type="text" className={inputClass(!!hasIcon, !!invalid, className)} {...props} />;
});

export const NumberInput = React.forwardRef<HTMLInputElement, BaseInput>(function NumberInput(
  { hasIcon, invalid, className = '', ...props }, ref,
) {
  return (
    <input
      ref={ref}
      type="number"
      step="0.01"
      inputMode="decimal"
      className={inputClass(!!hasIcon, !!invalid, className)}
      {...props}
    />
  );
});

export const DateInput = React.forwardRef<HTMLInputElement, BaseInput>(function DateInput(
  { hasIcon, invalid, className = '', ...props }, ref,
) {
  return <input ref={ref} type="date" className={inputClass(!!hasIcon, !!invalid, `[color-scheme:dark] ${className}`)} {...props} />;
});

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement> & { hasIcon?: boolean; invalid?: boolean }>(
  function Textarea({ hasIcon, invalid, className = '', ...props }, ref) {
    return <textarea ref={ref} className={inputClass(!!hasIcon, !!invalid, `min-h-[80px] py-2.5 ${className}`)} {...props} />;
  },
);

type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & { hasIcon?: boolean; invalid?: boolean };

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { hasIcon, invalid, className = '', children, ...props }, ref,
) {
  return (
    <>
      <select
        ref={ref}
        className={inputClass(!!hasIcon, !!invalid, `appearance-none pr-10 cursor-pointer [color-scheme:dark] ${className}`)}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={18} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
    </>
  );
});
