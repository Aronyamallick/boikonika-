'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { Input } from '@/components/ui/field';
import { cn } from '@/lib/cn';

/**
 * One field for a 6-digit code: numeric keyboard on phones, SMS/email autofill (one-time-code), and
 * Bangla digits are accepted (the shared schema normalises them).
 */
export const CodeInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, 'type'>>(function CodeInput({ className, ...props }, ref) {
  return (
    <Input
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={12}
      placeholder="••••••"
      className={cn('text-center font-mono text-2xl tracking-[0.5em] placeholder:tracking-[0.5em]', className)}
      {...props}
    />
  );
});
