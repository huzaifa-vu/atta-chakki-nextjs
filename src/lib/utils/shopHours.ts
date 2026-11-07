'use client';

import { useState, useEffect } from 'react';
import { ShopSettings } from '@/types/database';

export interface ShopOperatingStatus {
  isOpen: boolean;
  statusLabel: string;
  badgeVariant: 'open' | 'closed' | 'override';
  formattedHours: string;
  formattedNextOpen: string;
  nextOpenDate: Date;
  isClosedOverride: boolean;
  closedReason?: string;
}

/**
 * Converts 24-hr time string ('08:00', '21:30') into clean 12-hr display ('8:00 AM', '9:30 PM')
 */
export function formatTime12Hour(time24?: string): string {
  if (!time24 || !time24.includes(':')) return '8:00 AM';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h)) h = 8;
  const minuteDisplay = isNaN(m) ? '00' : m.toString().padStart(2, '0');
  const period = h >= 12 ? 'PM' : 'AM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${minuteDisplay} ${period}`;
}

function parseTimeToMinutes(timeStr?: string, defaultMinutes = 480): number {
  if (!timeStr || !timeStr.includes(':')) return defaultMinutes;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h)) return defaultMinutes;
  return h * 60 + (isNaN(m) ? 0 : m);
}

/**
 * Computes current shop operational state, next opening time, and human-friendly labels.
 * Safe to pass any reference Date.
 */
export function getShopOperatingStatus(
  settings?: Partial<ShopSettings> | null,
  referenceDate?: Date
): ShopOperatingStatus {
  // Deterministic baseline if no date provided (prevents Next.js prerender error)
  const ref = referenceDate || new Date('2026-01-01T12:00:00');

  const openingTime = settings?.opening_time || '08:00';
  const closingTime = settings?.closing_time || '21:00';
  const isClosedOverride = !!settings?.is_closed_override;
  const closedReason = settings?.closed_reason || '';

  const openMinutes = parseTimeToMinutes(openingTime, 8 * 60);
  const closeMinutes = parseTimeToMinutes(closingTime, 21 * 60);

  const nowMinutes = ref.getHours() * 60 + ref.getMinutes();

  let isOpen = false;

  // Normal daily schedule (e.g. 08:00 to 21:00)
  if (openMinutes < closeMinutes) {
    isOpen = !isClosedOverride && nowMinutes >= openMinutes && nowMinutes < closeMinutes;
  } else {
    // Overnight shifts (e.g. 20:00 to 04:00)
    isOpen = !isClosedOverride && (nowMinutes >= openMinutes || nowMinutes < closeMinutes);
  }

  // Calculate Next Open Date
  const nextOpen = new Date(ref);
  const [openH, openM] = openingTime.split(':').map((s) => parseInt(s, 10) || 0);
  nextOpen.setHours(openH, openM, 0, 0);

  let formattedNextOpen = '';

  if (isClosedOverride) {
    // Force closed: assume next opening is tomorrow morning
    if (ref.getTime() >= nextOpen.getTime()) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }
    formattedNextOpen = `Tomorrow at ${formatTime12Hour(openingTime)}`;
  } else if (nowMinutes < openMinutes) {
    // Before opening today
    formattedNextOpen = `Today at ${formatTime12Hour(openingTime)}`;
  } else {
    // After closing today, opens tomorrow
    nextOpen.setDate(nextOpen.getDate() + 1);
    formattedNextOpen = `Tomorrow at ${formatTime12Hour(openingTime)}`;
  }

  const formattedHours = `${formatTime12Hour(openingTime)} – ${formatTime12Hour(closingTime)}`;

  let statusLabel = '';
  let badgeVariant: 'open' | 'closed' | 'override' = 'open';

  if (isClosedOverride) {
    statusLabel = closedReason ? `Closed • ${closedReason}` : 'Temporarily Closed';
    badgeVariant = 'override';
  } else if (isOpen) {
    statusLabel = `Open Now • Closes at ${formatTime12Hour(closingTime)}`;
    badgeVariant = 'open';
  } else {
    statusLabel = `Closed • Opens ${formattedNextOpen}`;
    badgeVariant = 'closed';
  }

  return {
    isOpen,
    statusLabel,
    badgeVariant,
    formattedHours,
    formattedNextOpen,
    nextOpenDate: nextOpen,
    isClosedOverride,
    closedReason,
  };
}

/**
 * Client-side React hook that avoids Next.js prerender dynamic date errors.
 * Recomputes live every 30 seconds on client.
 */
export function useShopOperatingStatus(
  settings?: Partial<ShopSettings> | null
): ShopOperatingStatus {
  const [status, setStatus] = useState<ShopOperatingStatus>(() =>
    getShopOperatingStatus(settings)
  );

  useEffect(() => {
    const update = () => {
      setStatus(getShopOperatingStatus(settings, new Date()));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [settings]);

  return status;
}

export interface CountdownResult {
  hours: number;
  minutes: number;
  seconds: number;
  formattedString: string;
  isExpired: boolean;
}

/**
 * Real-time hook for ticking countdown to next opening time.
 * Avoids initial dynamic new Date() during SSR.
 */
export function useShopCountdown(targetDate?: Date | null): CountdownResult {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    if (!targetDate) return;
    const interval = setInterval(() => {
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (!targetDate || now === null) {
    return { hours: 0, minutes: 0, seconds: 0, formattedString: '--h : --m : --s', isExpired: false };
  }

  const diffMs = Math.max(0, targetDate.getTime() - now);
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toString().padStart(2, '0');

  return {
    hours,
    minutes,
    seconds,
    formattedString: `${hStr}h : ${mStr}m : ${sStr}s`,
    isExpired: totalSeconds <= 0,
  };
}
