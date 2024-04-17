<<<<<<< HEAD
import { ClassValue, clsx } from 'clsx';
=======
import type { ClassValue } from 'clsx';
import { clsx } from 'clsx';
>>>>>>> main
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
