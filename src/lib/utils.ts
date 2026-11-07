import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(amount: number, currency: string = 'Rs.') {
  return `${currency} ${Number(amount).toFixed(0)}`;
}

export function formatWeight(weight: number) {
  const num = Number(weight);
  return num % 1 === 0 ? `${num} kg` : `${num.toFixed(1)} kg`;
}

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
}
