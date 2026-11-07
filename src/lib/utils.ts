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

/**
 * Formats a phone number cleanly into standard 03XX-XXX-XXXX format.
 * Gracefully normalizes +92, 92, and unformatted digits.
 */
export function formatPhoneNumber(phone?: string | null): string {
  if (!phone) return '';
  const trimmed = phone.trim();
  let digits = trimmed.replace(/\D/g, '');

  if (digits.length === 12 && digits.startsWith('92')) {
    digits = '0' + digits.slice(2);
  } else if (digits.length === 10 && digits.startsWith('3')) {
    digits = '0' + digits;
  }

  if (digits.length === 11) {
    return `${digits.slice(0, 4)}-${digits.slice(4, 7)}-${digits.slice(7, 11)}`;
  }

  return trimmed;
}
