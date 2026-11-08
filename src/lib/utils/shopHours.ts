'use client';

import { useState, useEffect } from 'react';
import { ShopSettings, WeeklySchedule, DaySchedule, DayOfWeek, DayBreak } from '@/types/database';

export interface ShopOperatingStatus {
  isOpen: boolean;
  statusLabel: string;
  badgeVariant: 'open' | 'closed' | 'override';
  formattedHours: string;
  formattedNextOpen: string;
  nextOpenDate: Date;
  isClosedOverride: boolean;
  closedReason?: string;
  isBreakActive?: boolean;
  breakLabel?: string;
  breakEnd?: string;
  todaySchedule?: DaySchedule;
}

export const DAYS_ORDER: DayOfWeek[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
];

export const DAY_INDEX_MAP: Record<number, DayOfWeek> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};

export const DAY_DISPLAY_NAMES: Record<DayOfWeek, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

export const DEFAULT_WEEKLY_SCHEDULE: WeeklySchedule = {
  monday: { isOpen: true, open: '08:00', close: '21:00', breaks: [] },
  tuesday: { isOpen: true, open: '08:00', close: '21:00', breaks: [] },
  wednesday: { isOpen: true, open: '08:00', close: '21:00', breaks: [] },
  thursday: { isOpen: true, open: '08:00', close: '21:00', breaks: [] },
  friday: {
    isOpen: true,
    open: '08:00',
    close: '21:00',
    breaks: [
      {
        id: 'fri-jummah',
        start: '13:00',
        end: '14:30',
        label: 'Jummah Prayer Break',
      },
    ],
  },
  saturday: { isOpen: true, open: '08:00', close: '21:00', breaks: [] },
  sunday: { isOpen: true, open: '08:00', close: '21:00', breaks: [] },
};

/**
 * Normalizes all breaks for a day from either breaks array or legacy break field
 */
export function getDayBreaks(daySched?: DaySchedule | null): DayBreak[] {
  if (!daySched) return [];
  if (Array.isArray(daySched.breaks)) {
    return daySched.breaks.filter((b) => b && (b.enabled !== false));
  }
  if (daySched.break && (daySched.break.enabled ?? true) && daySched.break.start && daySched.break.end) {
    return [daySched.break];
  }
  return [];
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

/**
 * Strips redundant text like "Today at " from next open strings, producing compact formats
 * e.g. "Today at 8:00 AM" -> "8:00 AM", "Tomorrow at 8:00 AM" -> "Tomorrow 8:00 AM"
 */
export function formatNextOpenShort(formatted?: string): string {
  if (!formatted) return '8:00 AM';
  return formatted
    .replace(/^Today at /i, '')
    .replace(/^Tomorrow at /i, 'Tomorrow ')
    .replace(/ at /i, ' ');
}

export function parseTimeToMinutes(timeStr?: string, defaultMinutes = 480): number {
  if (!timeStr || !timeStr.includes(':')) return defaultMinutes;
  const [hStr, mStr] = timeStr.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h)) return defaultMinutes;
  return h * 60 + (isNaN(m) ? 0 : m);
}

/**
 * Helper to resolve the schedule for a given DayOfWeek from settings or defaults
 */
export function getScheduleForDay(
  weeklySchedule: WeeklySchedule | null | undefined,
  dayKey: DayOfWeek,
  fallbackOpen = '08:00',
  fallbackClose = '21:00'
): DaySchedule {
  if (weeklySchedule && weeklySchedule[dayKey]) {
    return weeklySchedule[dayKey];
  }
  if (DEFAULT_WEEKLY_SCHEDULE[dayKey]) {
    return DEFAULT_WEEKLY_SCHEDULE[dayKey];
  }
  return {
    isOpen: true,
    open: fallbackOpen,
    close: fallbackClose,
  };
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

  const fallbackOpen = settings?.opening_time || '08:00';
  const fallbackClose = settings?.closing_time || '21:00';
  const isClosedOverride = !!settings?.is_closed_override;
  const closedReason = settings?.closed_reason || '';
  const weekly = settings?.weekly_schedule || null;

  const currentDayIndex = ref.getDay();
  const currentDayKey = DAY_INDEX_MAP[currentDayIndex];
  const todaySchedule = getScheduleForDay(weekly, currentDayKey, fallbackOpen, fallbackClose);

  const openMinutes = parseTimeToMinutes(todaySchedule.open, 8 * 60);
  const closeMinutes = parseTimeToMinutes(todaySchedule.close, 21 * 60);
  const nowMinutes = ref.getHours() * 60 + ref.getMinutes();

  // 1. Emergency or Manual Override
  if (isClosedOverride) {
    const nextOpen = new Date(ref);
    const [openH, openM] = (todaySchedule.open || fallbackOpen).split(':').map((s) => parseInt(s, 10) || 0);
    nextOpen.setHours(openH, openM, 0, 0);
    if (ref.getTime() >= nextOpen.getTime()) {
      nextOpen.setDate(nextOpen.getDate() + 1);
    }

    return {
      isOpen: false,
      statusLabel: closedReason ? `Closed • ${closedReason}` : 'Temporarily Closed',
      badgeVariant: 'override',
      formattedHours: `${formatTime12Hour(todaySchedule.open)} – ${formatTime12Hour(todaySchedule.close)}`,
      formattedNextOpen: `Tomorrow at ${formatTime12Hour(todaySchedule.open)}`,
      nextOpenDate: nextOpen,
      isClosedOverride: true,
      closedReason,
      todaySchedule,
    };
  }

  // Helper to find next open day
  const findNextOpening = (fromDayOffset = 1): { nextDate: Date; formatted: string } => {
    for (let offset = fromDayOffset; offset <= 7; offset++) {
      const targetDate = new Date(ref);
      targetDate.setDate(targetDate.getDate() + offset);
      const targetDayKey = DAY_INDEX_MAP[targetDate.getDay()];
      const targetSched = getScheduleForDay(weekly, targetDayKey, fallbackOpen, fallbackClose);

      if (targetSched.isOpen) {
        const [targetOpenH, targetOpenM] = targetSched.open.split(':').map((s) => parseInt(s, 10) || 0);
        targetDate.setHours(targetOpenH, targetOpenM, 0, 0);
        const dayLabel = offset === 1 ? 'Tomorrow' : DAY_DISPLAY_NAMES[targetDayKey];
        return {
          nextDate: targetDate,
          formatted: `${dayLabel} at ${formatTime12Hour(targetSched.open)}`,
        };
      }
    }
    // Fallback if all days marked closed
    const fallbackDate = new Date(ref);
    fallbackDate.setDate(fallbackDate.getDate() + 1);
    fallbackDate.setHours(8, 0, 0, 0);
    return { nextDate: fallbackDate, formatted: `Tomorrow at ${formatTime12Hour(fallbackOpen)}` };
  };

  // 2. Day is configured as Closed
  if (!todaySchedule.isOpen) {
    const next = findNextOpening(1);
    return {
      isOpen: false,
      statusLabel: `Closed Today • Opens ${next.formatted}`,
      badgeVariant: 'closed',
      formattedHours: 'Closed Today',
      formattedNextOpen: next.formatted,
      nextOpenDate: next.nextDate,
      isClosedOverride: false,
      todaySchedule,
    };
  }

  // Check all scheduled breaks for today
  const allBreaks = getDayBreaks(todaySchedule);
  const activeBreak = allBreaks.find((b) => {
    if (!b.start || !b.end) return false;
    const bStart = parseTimeToMinutes(b.start);
    const bEnd = parseTimeToMinutes(b.end);
    return nowMinutes >= bStart && nowMinutes < bEnd;
  });

  const isDuringBreak = !!activeBreak;
  const formattedHours = `${formatTime12Hour(todaySchedule.open)} – ${formatTime12Hour(todaySchedule.close)}`;

  // 3. During Mid-Day Break (e.g. Jummah prayer 1:00 PM - 2:30 PM, Lunch, etc.)
  if (isDuringBreak && activeBreak) {
    const nextOpen = new Date(ref);
    const [bEndH, bEndM] = activeBreak.end.split(':').map((s) => parseInt(s, 10) || 0);
    nextOpen.setHours(bEndH, bEndM, 0, 0);
    const breakLabel = activeBreak.label?.trim() || 'Break';

    return {
      isOpen: false,
      statusLabel: `Closed • ${breakLabel} until ${formatTime12Hour(activeBreak.end)}`,
      badgeVariant: 'closed',
      formattedHours,
      formattedNextOpen: `Today at ${formatTime12Hour(activeBreak.end)}`,
      nextOpenDate: nextOpen,
      isClosedOverride: false,
      isBreakActive: true,
      breakLabel,
      breakEnd: activeBreak.end,
      todaySchedule,
    };
  }

  // 4. Before Opening Time Today
  if (nowMinutes < openMinutes) {
    const nextOpen = new Date(ref);
    const [openH, openM] = todaySchedule.open.split(':').map((s) => parseInt(s, 10) || 0);
    nextOpen.setHours(openH, openM, 0, 0);
    const formattedNext = `Today at ${formatTime12Hour(todaySchedule.open)}`;

    return {
      isOpen: false,
      statusLabel: `Closed • Opens ${formattedNext}`,
      badgeVariant: 'closed',
      formattedHours,
      formattedNextOpen: formattedNext,
      nextOpenDate: nextOpen,
      isClosedOverride: false,
      todaySchedule,
    };
  }

  // 5. After Closing Time Today
  if (nowMinutes >= closeMinutes) {
    const next = findNextOpening(1);
    return {
      isOpen: false,
      statusLabel: `Closed • Opens ${next.formatted}`,
      badgeVariant: 'closed',
      formattedHours,
      formattedNextOpen: next.formatted,
      nextOpenDate: next.nextDate,
      isClosedOverride: false,
      todaySchedule,
    };
  }

  // 6. Currently Open! Check if there is an upcoming break later today
  let statusLabel = `Open Now • Closes at ${formatTime12Hour(todaySchedule.close)}`;
  const upcomingBreak = allBreaks.find((b) => {
    if (!b.start) return false;
    const bStart = parseTimeToMinutes(b.start);
    return nowMinutes < bStart;
  });

  if (upcomingBreak) {
    const breakLabel = upcomingBreak.label?.trim() || 'Break';
    statusLabel = `Open Now • ${breakLabel} at ${formatTime12Hour(upcomingBreak.start)}`;
  }

  return {
    isOpen: true,
    statusLabel,
    badgeVariant: 'open',
    formattedHours,
    formattedNextOpen: '',
    nextOpenDate: new Date(ref),
    isClosedOverride: false,
    todaySchedule,
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

  // Serialize to prevent infinite re-render loops when settings is passed as an object literal
  const serialized = JSON.stringify({
    o: settings?.opening_time,
    c: settings?.closing_time,
    ov: settings?.is_closed_override,
    r: settings?.closed_reason,
    w: settings?.weekly_schedule,
  });

  useEffect(() => {
    const update = () => {
      setStatus(getShopOperatingStatus(settings, new Date()));
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serialized]);

  return status;
}

export interface CountdownResult {
  hours: number;
  minutes: number;
  seconds: number;
  formattedString: string;
  compactString: string;
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
    return {
      hours: 0,
      minutes: 0,
      seconds: 0,
      formattedString: '--h : --m : --s',
      compactString: '--h --m',
      isExpired: false,
    };
  }

  const diffMs = Math.max(0, targetDate.getTime() - now);
  const totalSeconds = Math.floor(diffMs / 1000);

  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const hStr = hours.toString().padStart(2, '0');
  const mStr = minutes.toString().padStart(2, '0');
  const sStr = seconds.toString().padStart(2, '0');

  const compactString =
    hours > 0
      ? `${hours}h ${minutes.toString().padStart(2, '0')}m`
      : `${minutes}m`;

  return {
    hours,
    minutes,
    seconds,
    formattedString: `${hStr}h : ${mStr}m : ${sStr}s`,
    compactString,
    isExpired: totalSeconds <= 0,
  };
}

/**
 * Calculates the most frequent (mode) open and close time across open days in the weekly schedule.
 */
export function getMostFrequentWeeklyTimes(
  weekly?: WeeklySchedule | null,
  fallbackOpen = '08:00',
  fallbackClose = '21:00'
): { defaultOpen: string; defaultClose: string } {
  if (!weekly) {
    return { defaultOpen: fallbackOpen, defaultClose: fallbackClose };
  }

  const openCounts: Record<string, number> = {};
  const closeCounts: Record<string, number> = {};

  DAYS_ORDER.forEach((day) => {
    const d = weekly[day];
    if (d && d.isOpen) {
      if (d.open) openCounts[d.open] = (openCounts[d.open] || 0) + 1;
      if (d.close) closeCounts[d.close] = (closeCounts[d.close] || 0) + 1;
    }
  });

  let defaultOpen = fallbackOpen;
  let maxOpenCount = 0;
  for (const [time, count] of Object.entries(openCounts)) {
    if (count > maxOpenCount) {
      maxOpenCount = count;
      defaultOpen = time;
    }
  }

  let defaultClose = fallbackClose;
  let maxCloseCount = 0;
  for (const [time, count] of Object.entries(closeCounts)) {
    if (count > maxCloseCount) {
      maxCloseCount = count;
      defaultClose = time;
    }
  }

  return { defaultOpen, defaultClose };
}

/**
 * Propagates a change in default open or close time to all days currently matching the old default.
 */
export function updateWeeklyDefaultTime(
  weekly: WeeklySchedule,
  field: 'open' | 'close',
  oldDefault: string,
  newDefault: string
): WeeklySchedule {
  const updated: WeeklySchedule = { ...weekly };
  DAYS_ORDER.forEach((day) => {
    const d = updated[day];
    if (d && d[field] === oldDefault) {
      updated[day] = {
        ...d,
        [field]: newDefault,
      };
    }
  });
  return updated;
}
