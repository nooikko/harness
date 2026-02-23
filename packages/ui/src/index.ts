// Shared UI utilities
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export type { ClassValue };

export const cn = (...inputs: ClassValue[]): string => {
  return twMerge(clsx(inputs));
};

// Shared UI components
export type { ButtonProps } from './components/button';
export { Button, buttonVariants } from './components/button';
