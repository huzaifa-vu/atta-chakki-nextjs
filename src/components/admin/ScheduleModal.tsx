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
  Sparkles,
  CalendarDays,
} from 'lucide-react';
import {
  WeeklySchedule,
  DayOfWeek,
  DaySchedule,
} from '@/types/database';
import {
  DAYS_ORDER,
  DAY_DISPLAY_NAMES,
  DEFAULT_WEEKLY_SCHEDULE,
  DAY_INDEX_MAP,
  formatTime12Hour,
} from '@/lib/utils/shopHours';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialSchedule?: WeeklySchedule | null;
  onSave: (updatedSchedule: WeeklySchedule) => Promise<void>;
}

export default function ScheduleModal({
  isOpen,
  onClose,
  initialSchedule,
  onSave,
}: ScheduleModalProps) {
  // Deep clone initial schedule or fall back to default
  const [schedule, setSchedule] = useState<WeeklySchedule>(() => {
    return initialSchedule
      ? JSON.parse(JSON.stringify(initialSchedule))
      : JSON.parse(JSON.stringify(DEFAULT_WEEKLY_SCHEDULE));
  });

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state if initialSchedule changes when opened
  const handleOpenReset = () => {
    setSchedule(
      initialSchedule
        ? JSON.parse(JSON.stringify(initialSchedule))
        : JSON.parse(JSON.stringify(DEFAULT_WEEKLY_SCHEDULE))
    );
    setError(null);
  };

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

  const toggleBreak = (day: DayOfWeek) => {
    setSchedule((prev) => {
      const current = prev[day];
      const breakObj = current.break || {
        enabled: false,
        start: '13:00',
        end: '14:30',
        label: day === 'friday' ? 'Jummah Prayer Break' : 'Lunch Break',
      };
      return {
        ...prev,
        [day]: {
          ...current,
          break: {
            ...breakObj,
            enabled: !breakObj.enabled,
          },
        },
      };
    });
  };

  const updateBreakField = (
    day: DayOfWeek,
    field: 'start' | 'end' | 'label',
    value: string
  ) => {
    setSchedule((prev) => {
      const current = prev[day];
      const breakObj = current.break || {
        enabled: true,
        start: '13:00',
        end: '14:30',
        label: 'Lunch Break',
      };
      return {
        ...prev,
        [day]: {
          ...current,
          break: {
            ...breakObj,
            [field]: value,
          },
        },
      };
    });
  };

  // Quick Action 1: Standard 8am - 9pm every day
  const applyStandardAllDays = () => {
    setSchedule((prev) => {
      const next = { ...prev };
      DAYS_ORDER.forEach((day) => {
        next[day] = {
          ...next[day],
          isOpen: true,
          open: '08:00',
          close: '21:00',
        };
      });
      return next;
    });
  };

  // Quick Action 2: Ensure Friday Jummah break is active
  const applyFridayJummah = () => {
    setSchedule((prev) => ({
      ...prev,
      friday: {
        ...prev.friday,
        isOpen: true,
        open: prev.friday?.open || '08:00',
        close: prev.friday?.close || '21:00',
        break: {
          enabled: true,
          start: '13:00',
          end: '14:30',
          label: 'Jummah Prayer Break',
        },
      },
    }));
  };

  // Quick Action 3: Copy Monday schedule to Tuesday through Thursday
  const copyMondayToWeekdays = () => {
    const mondaySched = schedule.monday;
    setSchedule((prev) => ({
      ...prev,
      tuesday: JSON.parse(JSON.stringify(mondaySched)),
      wednesday: JSON.parse(JSON.stringify(mondaySched)),
      thursday: JSON.parse(JSON.stringify(mondaySched)),
    }));
  };

  // Reset to system defaults
  const resetToDefaults = () => {
    setSchedule(JSON.parse(JSON.stringify(DEFAULT_WEEKLY_SCHEDULE)));
  };

  const handleSave = async () => {
    // Basic validation
    for (const day of DAYS_ORDER) {
      const s = schedule[day];
      if (s?.isOpen) {
        if (!s.open || !s.close) {
          setError(`Please provide opening and closing times for ${DAY_DISPLAY_NAMES[day]}`);
          return;
        }
        if (s.break?.enabled) {
          if (!s.break.start || !s.break.end) {
            setError(`Please set break start and end times for ${DAY_DISPLAY_NAMES[day]}`);
            return;
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
                    Set operating hours and mid-day prayer/lunch breaks for each day.
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

            {/* Quick Action Bar */}
            <div className="px-5 py-3 border-b border-stone-100 bg-amber-50/50 flex flex-wrap items-center gap-2 shrink-0">
              <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                Quick Actions:
              </span>
              <button
                type="button"
                onClick={applyStandardAllDays}
                className="text-[11px] font-bold bg-white text-stone-700 hover:text-amber-700 border border-stone-200 hover:border-amber-300 px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer"
              >
                Set 8am – 9pm All Days
              </button>
              <button
                type="button"
                onClick={applyFridayJummah}
                className="text-[11px] font-bold bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer flex items-center gap-1"
              >
                <Coffee className="w-3 h-3 text-emerald-600" />
                Add Jummah Break (Fri 1-2:30 PM)
              </button>
              <button
                type="button"
                onClick={copyMondayToWeekdays}
                className="text-[11px] font-bold bg-white text-stone-700 hover:text-stone-900 border border-stone-200 px-2.5 py-1 rounded-lg transition shadow-2xs cursor-pointer"
              >
                Copy Mon to Tue–Thu
              </button>
            </div>

            {error && (
              <div className="mx-5 mt-4 flex items-center gap-2 p-3 bg-rose-50 text-rose-700 text-xs font-semibold rounded-xl border border-rose-200 shrink-0">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{error}</span>
              </div>
            )}

            {/* Scrollable Day-by-Day List */}
            <div className="overflow-y-auto px-4 sm:px-6 py-4 space-y-3.5 divide-y divide-stone-100">
              {DAYS_ORDER.map((day) => {
                const daySched = schedule[day] || {
                  isOpen: true,
                  open: '08:00',
                  close: '21:00',
                };
                const isToday = day === currentDayName;
                const isBreakActive = !!daySched.break?.enabled;

                return (
                  <div
                    key={day}
                    className={`pt-3.5 first:pt-0 rounded-2xl p-3.5 sm:p-4 transition ${
                      isToday
                        ? 'bg-amber-50/40 border border-amber-200/80 shadow-2xs'
                        : 'bg-white border border-stone-150'
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

                        {/* Mid-Day Break Sub-card */}
                        <div
                          className={`p-3 rounded-xl border transition ${
                            isBreakActive
                              ? 'bg-amber-50/60 border-amber-200'
                              : 'bg-stone-50/60 border-stone-200/70'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={isBreakActive}
                                onChange={() => toggleBreak(day)}
                                className="w-4 h-4 text-amber-600 rounded border-stone-300 focus:ring-amber-500 cursor-pointer"
                              />
                              <span className="text-xs font-bold text-stone-800 flex items-center gap-1.5">
                                <Coffee className="w-3.5 h-3.5 text-amber-600" />
                                Mid-Day Break (Prayer / Lunch)
                              </span>
                            </label>

                            {isBreakActive && (
                              <span className="text-[11px] font-extrabold text-amber-800">
                                {formatTime12Hour(daySched.break?.start)} – {formatTime12Hour(daySched.break?.end)}
                              </span>
                            )}
                          </div>

                          {/* Break Details Form */}
                          {isBreakActive && (
                            <div className="mt-3 pt-3 border-t border-amber-200/60 space-y-3">
                              <div className="grid grid-cols-2 gap-3">
                                <div>
                                  <label className="text-[10px] font-bold text-stone-600 block mb-1">
                                    Break Starts (Shop Pauses)
                                  </label>
                                  <input
                                    type="time"
                                    value={daySched.break?.start || '13:00'}
                                    onChange={(e) =>
                                      updateBreakField(day, 'start', e.target.value)
                                    }
                                    className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-stone-600 block mb-1">
                                    Break Ends (Shop Reopens)
                                  </label>
                                  <input
                                    type="time"
                                    value={daySched.break?.end || '14:30'}
                                    onChange={(e) =>
                                      updateBreakField(day, 'end', e.target.value)
                                    }
                                    className="w-full bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-bold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-stone-600 block mb-1">
                                  Break Reason / Display Label for Customers
                                </label>
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={daySched.break?.label || ''}
                                    onChange={(e) =>
                                      updateBreakField(day, 'label', e.target.value)
                                    }
                                    placeholder={day === 'friday' ? 'Jummah Prayer Break' : 'Lunch Break'}
                                    className="flex-1 bg-white border border-stone-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-stone-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                                  />
                                </div>
                                <div className="mt-1.5 flex flex-wrap gap-1.5">
                                  {['Jummah Prayer Break', 'Lunch Break', 'Rest & Cleaning'].map(
                                    (preset) => (
                                      <button
                                        key={preset}
                                        type="button"
                                        onClick={() => updateBreakField(day, 'label', preset)}
                                        className="text-[10px] font-semibold bg-white border border-stone-200 hover:border-amber-400 text-stone-600 hover:text-stone-900 px-2 py-0.5 rounded-md cursor-pointer transition"
                                      >
                                        + {preset}
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
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
