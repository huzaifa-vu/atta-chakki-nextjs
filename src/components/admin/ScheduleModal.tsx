'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Clock,
  Coffee,
  Check,
  AlertCircle,
  Save,
  RotateCcw,
  CalendarDays,
  Plus,
  Trash2,
} from 'lucide-react';
import {
  WeeklySchedule,
  DayOfWeek,
  DaySchedule,
  DayBreak,
} from '@/types/database';
import {
  DAYS_ORDER,
  DAY_DISPLAY_NAMES,
  DEFAULT_WEEKLY_SCHEDULE,
  DAY_INDEX_MAP,
  formatTime12Hour,
  getDayBreaks,
} from '@/lib/utils/shopHours';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSchedule?: WeeklySchedule | null;
  onSave: (updatedSchedule: WeeklySchedule) => Promise<void>;
}

function normalizeScheduleWithBreaks(sched?: WeeklySchedule | null): WeeklySchedule {
  const base: WeeklySchedule = sched
    ? JSON.parse(JSON.stringify(sched))
    : JSON.parse(JSON.stringify(DEFAULT_WEEKLY_SCHEDULE));

  DAYS_ORDER.forEach((day) => {
    if (!base[day]) {
      base[day] = { isOpen: true, open: '08:00', close: '21:00', breaks: [] };
    }
    const d = base[day];
    d.breaks = getDayBreaks(d);
    // remove legacy single break object to prevent ambiguity
    delete d.break;
  });

  return base;
}

export default function ScheduleModal({
  isOpen,
  onClose,
  initialSchedule,
  onSave,
}: ScheduleModalProps) {
  const [schedule, setSchedule] = useState<WeeklySchedule>(() =>
    normalizeScheduleWithBreaks(initialSchedule)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSchedule(normalizeScheduleWithBreaks(initialSchedule));
      setError(null);
    }
  }, [isOpen, initialSchedule]);

  const updateDay = (day: DayOfWeek, patch: Partial<DaySchedule>) => {
    setSchedule((prev) => ({
      ...prev,
      [day]: {
        ...prev[day],
        ...patch,
      },
    }));
  };

  const toggleDayOpen = (day: DayOfWeek) => {
    setSchedule((prev) => {
      const current = prev[day];
      return {
        ...prev,
        [day]: {
          ...current,
          isOpen: !current.isOpen,
        },
      };
    });
  };

  // Add a new break for a specific day
  const addBreak = (day: DayOfWeek) => {
    setSchedule((prev) => {
      const current = prev[day] || { isOpen: true, open: '08:00', close: '21:00', breaks: [] };
      const currentBreaks = Array.isArray(current.breaks) ? [...current.breaks] : [];

      const newBreak: DayBreak = {
        id: `brk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        label: day === 'friday' && currentBreaks.length === 0 ? 'Jummah Prayer Break' : '',
        start: '13:00',
        end: day === 'friday' && currentBreaks.length === 0 ? '14:30' : '14:00',
      };

      return {
        ...prev,
        [day]: {
          ...current,
          breaks: [...currentBreaks, newBreak],
        },
      };
    });
  };

  // Remove a break by index for a specific day
  const removeBreak = (day: DayOfWeek, breakIndex: number) => {
    setSchedule((prev) => {
      const current = prev[day];
      if (!current || !Array.isArray(current.breaks)) return prev;
      const updatedBreaks = current.breaks.filter((_, idx) => idx !== breakIndex);
      return {
        ...prev,
        [day]: {
          ...current,
          breaks: updatedBreaks,
        },
      };
    });
  };

  // Update a break field
  const updateBreak = (
    day: DayOfWeek,
    breakIndex: number,
    patch: Partial<DayBreak>
  ) => {
    setSchedule((prev) => {
      const current = prev[day];
      if (!current || !Array.isArray(current.breaks)) return prev;
      const updatedBreaks = current.breaks.map((b, idx) => {
        if (idx === breakIndex) {
          return { ...b, ...patch };
        }
        return b;
      });
      return {
        ...prev,
        [day]: {
          ...current,
          breaks: updatedBreaks,
        },
      };
    });
  };

  // Reset to system defaults
  const resetToDefaults = () => {
    setSchedule(normalizeScheduleWithBreaks(DEFAULT_WEEKLY_SCHEDULE));
  };

  const handleSave = async () => {
    // Validate each open day
    for (const day of DAYS_ORDER) {
      const s = schedule[day];
      if (s?.isOpen) {
        if (!s.open || !s.close) {
          setError(`Please provide opening and closing times for ${DAY_DISPLAY_NAMES[day]}`);
          return;
        }
        if (Array.isArray(s.breaks)) {
          for (let i = 0; i < s.breaks.length; i++) {
            const b = s.breaks[i];
            if (!b.start || !b.end) {
              setError(`Please set start and end times for all breaks on ${DAY_DISPLAY_NAMES[day]}`);
              return;
            }
          }
        }
      }
    }

    setSaving(true);
    setError(null);
    try {
      await onSave(schedule);
      onClose();
    } catch (err: unknown) {
      console.error(err);
      setError('Failed to save weekly schedule. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // Current day index to highlight today (hydrated safely in useEffect)
  const [currentDayName, setCurrentDayName] = useState<DayOfWeek>('friday');

  useEffect(() => {
    setCurrentDayName(DAY_INDEX_MAP[new Date().getDay()] || 'friday');
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-stone-900/60 backdrop-blur-xs">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh]"
          >
            {/* Modal Header */}
            <div className="p-5 border-b border-stone-100 flex items-center justify-between shrink-0 bg-stone-50/80">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center border border-amber-200">
                  <CalendarDays className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-stone-900 leading-tight">
                    Weekly Schedule & Breaks
                  </h3>
                  <p className="text-xs text-stone-500">
                    Set operating hours and add custom mid-day prayer/lunch breaks for each day.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-200/60 transition cursor-pointer"
                title="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mx-5 mt-4 flex items-center gap-2 p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Scrollable Day-by-Day List */}
            <div className="overflow-y-auto px-4 sm:px-6 py-4 space-y-3">
              {DAYS_ORDER.map((day) => {
                const daySched = schedule[day] || {
                  isOpen: true,
                  open: '08:00',
                  close: '21:00',
                  breaks: [],
                };
                const isToday = day === currentDayName;
                const breaks = Array.isArray(daySched.breaks) ? daySched.breaks : [];

                return (
                  <div
                    key={day}
                    className={`rounded-2xl p-4 sm:p-5 transition shadow-2xs ${
                      isToday
                        ? 'bg-amber-50/40 border border-amber-200/80'
                        : 'bg-white border border-stone-200/80'
                    }`}
                  >
                    {/* Day Header Row */}
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-extrabold text-stone-900">
                          {DAY_DISPLAY_NAMES[day]}
                        </span>
                        {isToday && (
                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-amber-500 text-white uppercase tracking-wider">
                            Today
                          </span>
                        )}
                        {day === 'friday' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200">
                            Jummah Day
                          </span>
                        )}
                      </div>

                      {/* Day Open/Close Toggle Button */}
                      <button
                        type="button"
                        onClick={() => toggleDayOpen(day)}
                        className={`text-xs font-bold px-3 py-1.5 rounded-xl border transition flex items-center gap-1.5 cursor-pointer ${
                          daySched.isOpen
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-stone-100 text-stone-500 border-stone-200 hover:bg-stone-200'
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full ${
                            daySched.isOpen ? 'bg-emerald-500' : 'bg-stone-400'
                          }`}
                        />
                        {daySched.isOpen ? 'Open for Business' : 'Closed all day'}
                      </button>
                    </div>

                    {/* If Day is Open */}
                    {daySched.isOpen ? (
                      <div className="mt-3.5 space-y-3">
                        {/* Open & Close Time Inputs */}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-stone-600 block">
                              Opening Time
                            </label>
                            <input
                              type="time"
                              value={daySched.open || '08:00'}
                              onChange={(e) => updateDay(day, { open: e.target.value })}
                              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-extrabold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <p className="text-[10px] text-stone-500 font-medium">
                              Opens: {formatTime12Hour(daySched.open)}
                            </p>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[11px] font-bold text-stone-600 block">
                              Closing Time
                            </label>
                            <input
                              type="time"
                              value={daySched.close || '21:00'}
                              onChange={(e) => updateDay(day, { close: e.target.value })}
                              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 text-xs font-extrabold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <p className="text-[10px] text-stone-500 font-medium">
                              Closes: {formatTime12Hour(daySched.close)}
                            </p>
                          </div>
                        </div>

                        {/* Breaks Section with "+ Add Break" Button */}
                        <div className="pt-3 border-t border-stone-200/60 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-extrabold uppercase tracking-wider text-stone-700 flex items-center gap-1.5">
                              <Coffee className="w-3.5 h-3.5 text-amber-600" />
                              Mid-Day Breaks {breaks.length > 0 && `(${breaks.length})`}
                            </span>
                            <button
                              type="button"
                              onClick={() => addBreak(day)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 hover:text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition cursor-pointer active:scale-95"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>Add Break</span>
                            </button>
                          </div>

                          {breaks.length === 0 ? (
                            <p className="text-[11px] text-stone-400 italic py-0.5">
                              No breaks scheduled. Shop runs continuously throughout operating hours.
                            </p>
                          ) : (
                            <div className="space-y-2">
                              {breaks.map((b, bIdx) => (
                                <div
                                  key={b.id || bIdx}
                                  className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-3 space-y-2.5"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <input
                                      type="text"
                                      placeholder="Break reason (e.g. Jummah Prayer, Lunch, Tea)"
                                      value={b.label || ''}
                                      onChange={(e) =>
                                        updateBreak(day, bIdx, { label: e.target.value })
                                      }
                                      className="flex-1 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-500 placeholder:text-stone-400"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => removeBreak(day, bIdx)}
                                      className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                      title="Delete this break"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-2 gap-2.5">
                                    <div>
                                      <label className="text-[10px] font-semibold text-stone-500 block mb-0.5">
                                        Break Starts (Counter Pauses)
                                      </label>
                                      <input
                                        type="time"
                                        value={b.start || '13:00'}
                                        onChange={(e) =>
                                          updateBreak(day, bIdx, { start: e.target.value })
                                        }
                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-500"
                                      />
                                      <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                                        {formatTime12Hour(b.start)}
                                      </span>
                                    </div>

                                    <div>
                                      <label className="text-[10px] font-semibold text-stone-500 block mb-0.5">
                                        Break Ends (Counter Reopens)
                                      </label>
                                      <input
                                        type="time"
                                        value={b.end || '14:30'}
                                        onChange={(e) =>
                                          updateBreak(day, bIdx, { end: e.target.value })
                                        }
                                        className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1 text-xs font-bold text-stone-800 focus:outline-none focus:border-amber-500"
                                      />
                                      <span className="text-[10px] text-stone-500 font-medium block mt-0.5">
                                        {formatTime12Hour(b.end)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-2 text-xs text-stone-400 italic">
                        Shop will be marked closed on {DAY_DISPLAY_NAMES[day]}s. The customer tracker will inform customers when the shop opens next.
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-stone-100 flex items-center justify-between shrink-0 bg-stone-50/80">
              <button
                type="button"
                onClick={resetToDefaults}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-stone-900 px-3 py-2 rounded-xl hover:bg-stone-200/50 transition cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset Defaults
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 rounded-xl hover:bg-stone-200/50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white rounded-xl text-xs font-extrabold shadow-md hover:shadow-lg transition disabled:opacity-50 cursor-pointer"
                >
                  {saving ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      Save Schedule
                    </>
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
