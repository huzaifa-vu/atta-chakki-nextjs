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
 * Formats order completion timestamp with intelligent relative day & 12-hr time.
 * e.g., "Today at 2:15 PM", "Yesterday at 6:40 PM", or "Oct 24, 11:30 AM".
 */
export function formatCompletionDate(dateString?: string | null): string {
  if (!dateString) return 'Completed';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return 'Completed';

  const now = new Date();
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear();

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear();

  const timeStr = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  if (isToday) return `Today at ${timeStr}`;
  if (isYesterday) return `Yesterday at ${timeStr}`;

  const dateStr = date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });

  return `${dateStr}, ${timeStr}`;
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
