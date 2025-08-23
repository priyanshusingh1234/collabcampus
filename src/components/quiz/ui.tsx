"use client";

import React, { forwardRef } from 'react';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
};

export const QButton = forwardRef<HTMLButtonElement, ButtonProps>(function QButton(
  { className = '', variant = 'primary', size = 'md', ...props },
  ref
) {
  const base = 'inline-flex items-center justify-center rounded-xl font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';
  const sizes = {
    sm: 'h-8 px-3 text-sm',
    md: 'h-10 px-4 text-sm',
    lg: 'h-12 px-6 text-base',
  } as const;
  const variants = {
    primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
    secondary: 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-700',
    ghost: 'bg-transparent hover:bg-black/5 dark:hover:bg-white/10 text-foreground',
    outline: 'border border-slate-300 dark:border-slate-700 text-foreground hover:bg-black/5',
  } as const;
  return (
    <button ref={ref} className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />
  );
});

type InputProps = React.InputHTMLAttributes<HTMLInputElement>;
export const QInput = forwardRef<HTMLInputElement, InputProps>(function QInput(
  { className = '', ...props },
  ref
) {
  const cls = 'h-10 w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/60 px-3 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';
  return <input ref={ref} className={`${cls} ${className}`} {...props} />;
});

type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;
export const QTextarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function QTextarea(
  { className = '', rows = 4, ...props },
  ref
) {
  const cls = 'w-full rounded-xl border border-slate-300 dark:border-slate-700 bg-white/90 dark:bg-slate-900/60 px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500';
  return <textarea ref={ref} rows={rows} className={`${cls} ${className}`} {...props} />;
});

type CheckboxProps = React.InputHTMLAttributes<HTMLInputElement> & { label?: React.ReactNode };
export function QCheckbox({ label, className = '', ...props }: CheckboxProps) {
  return (
    <label className={`inline-flex items-center gap-2 cursor-pointer select-none ${className}`}>
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 dark:border-slate-700 accent-blue-600" {...props} />
      {label ? <span className="text-sm">{label}</span> : null}
    </label>
  );
}
