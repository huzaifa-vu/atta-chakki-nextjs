'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShopSettings, WeeklySchedule, DayOfWeek } from '@/types/database';
import {
  formatTime12Hour,
  useShopOperatingStatus,
  DAY_DISPLAY_NAMES,
  DEFAULT_WEEKLY_SCHEDULE,
  DAY_INDEX_MAP,
  getDayBreaks,
  getMostFrequentWeeklyTimes,
  updateWeeklyDefaultTime,
} from '@/lib/utils/shopHours';
import ScheduleModal from '@/components/admin/ScheduleModal';
import {
  ArrowLeft,
  Store,
  Phone,
  Save,
  CheckCircle2,
  AlertCircle,
  Clock,
  Moon,
  Sun,
  CalendarDays,
  Coffee,
  Check,
  Sparkles,
} from 'lucide-react';
import { motion } from 'framer-motion';

const CACHE_KEY = 'chakki_cached_settings';

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [shopName, setShopName] = useState('Chakki Fresh');
  const [ratePerKg, setRatePerKg] = useState('15');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('21:00');
  const [isClosedOverride, setIsClosedOverride] = useState(false);
  const [closedReason, setClosedReason] = useState('');
  const [weeklySchedule, setWeeklySchedule] = useState<WeeklySchedule | null>(null);

  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const supabase = createClient();

  // 1. Instant Cache Hydration to eliminate any loading wait
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached) as ShopSettings;
        const weekly = parsed.weekly_schedule || DEFAULT_WEEKLY_SCHEDULE;
        const { defaultOpen, defaultClose } = getMostFrequentWeeklyTimes(
          weekly,
          parsed.opening_time || '08:00',
          parsed.closing_time || '21:00'
        );

        setSettings(parsed);
        setShopName(parsed.shop_name || 'Chakki Fresh');
        setRatePerKg(parsed.rate_per_kg?.toString() || '15');
        setPhoneNumber(parsed.phone_number || '');
        setOpeningTime(defaultOpen);
        setClosingTime(defaultClose);
        setIsClosedOverride(!!parsed.is_closed_override);
        setClosedReason(parsed.closed_reason || '');
        setWeeklySchedule(weekly);
      }
    } catch {
      // Ignore localStorage parse errors
    }
  }, []);

  // 2. Background Fetch & Silent Sync (never blocks the screen)
  const fetchSettings = useCallback(async () => {
    setIsSyncing(true);
    try {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .limit(1)
        .single();

      if (!error && data) {
        const weekly = (data.weekly_schedule as WeeklySchedule) || DEFAULT_WEEKLY_SCHEDULE;
        const { defaultOpen, defaultClose } = getMostFrequentWeeklyTimes(
          weekly,
          data.opening_time || '08:00',
          data.closing_time || '21:00'
        );

        setSettings(data as ShopSettings);
        setShopName(data.shop_name || 'Chakki Fresh');
        setRatePerKg(data.rate_per_kg?.toString() || '15');
        setPhoneNumber(data.phone_number || '');
        setOpeningTime(defaultOpen);
        setClosingTime(defaultClose);
        setIsClosedOverride(!!data.is_closed_override);
        setClosedReason(data.closed_reason || '');
        setWeeklySchedule(weekly);

        // Update local cache
        localStorage.setItem(CACHE_KEY, JSON.stringify(data));
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setIsSyncing(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  // Real-time operating preview based on live inputs (memoized for performance)
  const previewSettings = useMemo(
    () => ({
      opening_time: openingTime,
      closing_time: closingTime,
      is_closed_override: isClosedOverride,
      closed_reason: closedReason,
      weekly_schedule: weeklySchedule,
    }),
    [openingTime, closingTime, isClosedOverride, closedReason, weeklySchedule]
  );
  const currentPreviewStatus = useShopOperatingStatus(previewSettings);

  // Calculate current day's configured schedule (hydrated safely in useEffect)
  const [todayKey, setTodayKey] = useState<DayOfWeek>('friday');

  useEffect(() => {
    setTodayKey(DAY_INDEX_MAP[new Date().getDay()] || 'friday');
  }, []);
  const todaySchedule = weeklySchedule
    ? weeklySchedule[todayKey]
    : DEFAULT_WEEKLY_SCHEDULE[todayKey];
  const todayBreaks = getDayBreaks(todaySchedule);

  // When default open time changes: update state and all days that previously matched old default
  const handleDefaultOpenChange = (newOpen: string) => {
    const oldDefault = openingTime;
    setOpeningTime(newOpen);
    if (weeklySchedule) {
      const updated = updateWeeklyDefaultTime(weeklySchedule, 'open', oldDefault, newOpen);
      setWeeklySchedule(updated);
    }
  };

  // When default close time changes: update state and all days that previously matched old default
  const handleDefaultCloseChange = (newClose: string) => {
    const oldDefault = closingTime;
    setClosingTime(newClose);
    if (weeklySchedule) {
      const updated = updateWeeklyDefaultTime(weeklySchedule, 'close', oldDefault, newClose);
      setWeeklySchedule(updated);
    }
  };

  // Handle Main Settings Form Save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const numRate = parseFloat(ratePerKg);
    if (isNaN(numRate) || numRate <= 0) {
      setFeedback({ type: 'error', message: 'Please enter a valid price per kg' });
      return;
    }

    setSaving(true);
    setFeedback(null);

    try {
      if (!settings?.id) throw new Error('Settings record not found');

      // Sync default open and close with current weekly schedule mode
      const { defaultOpen, defaultClose } = getMostFrequentWeeklyTimes(
        weeklySchedule || DEFAULT_WEEKLY_SCHEDULE,
        openingTime,
        closingTime
      );

      const updatedPayload = {
        shop_name: shopName.trim() || 'Chakki Fresh',
        rate_per_kg: numRate,
        phone_number: phoneNumber.trim(),
        opening_time: defaultOpen,
        closing_time: defaultClose,
        is_closed_override: isClosedOverride,
        closed_reason: closedReason.trim(),
        weekly_schedule: weeklySchedule || DEFAULT_WEEKLY_SCHEDULE,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('shop_settings')
        .update(updatedPayload)
        .eq('id', settings.id);

      if (error) throw error;

      // Update local storage
      const merged = { ...settings, ...updatedPayload };
      setSettings(merged as ShopSettings);
      localStorage.setItem(CACHE_KEY, JSON.stringify(merged));

      setFeedback({
        type: 'success',
        message: 'Settings updated successfully! Working hours and live status are now active.',
      });
      setTimeout(() => setFeedback(null), 3500);
    } catch (err: unknown) {
      console.error(err);
      setFeedback({ type: 'error', message: 'Failed to update settings.' });
    } finally {
      setSaving(false);
    }
  };

  // Handle Saving Weekly Schedule from Modal
  const handleSaveWeeklySchedule = async (updatedWeekly: WeeklySchedule) => {
    setWeeklySchedule(updatedWeekly);

    // Compute mode open & close times from the customized schedule
    const { defaultOpen, defaultClose } = getMostFrequentWeeklyTimes(
      updatedWeekly,
      openingTime,
      closingTime
    );
    setOpeningTime(defaultOpen);
    setClosingTime(defaultClose);

    if (settings?.id) {
      const { error } = await supabase
        .from('shop_settings')
        .update({
          weekly_schedule: updatedWeekly,
          opening_time: defaultOpen,
          closing_time: defaultClose,
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);

      if (error) {
        throw error;
      }

      // Update local storage
      const merged = {
        ...settings,
        weekly_schedule: updatedWeekly,
        opening_time: defaultOpen,
        closing_time: defaultClose,
      };
      setSettings(merged as ShopSettings);
      localStorage.setItem(CACHE_KEY, JSON.stringify(merged));
    }

    setFeedback({
      type: 'success',
      message: 'Weekly schedule and breaks saved! Default hours synced.',
    });
    setTimeout(() => setFeedback(null), 3500);
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] p-4 sm:p-6">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <Link
            href="/admin"
            prefetch={true}
            onClick={(e) => {
              // Ensure immediate navigation regardless of router state
              try {
                router.push('/admin');
              } catch {
                window.location.href = '/admin';
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-amber-700 bg-white border border-stone-200 hover:border-amber-300 px-3 py-2 rounded-xl transition shadow-2xs cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </Link>
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Syncing...
              </span>
            ) : (
              <span className="text-[10px] font-bold text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-600" />
                Synced
              </span>
            )}
            <span className="text-xs font-extrabold uppercase tracking-wider text-stone-600">
              Shop Configuration
            </span>
          </div>
        </div>

        {/* Settings Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-200 space-y-6"
        >
          {/* Card Header */}
          <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center border border-amber-200">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-900">Chakki Settings & Hours</h2>
              <p className="text-xs text-stone-600">
                Manage operating hours, weekly prayer/lunch breaks, grinding rate, and shop info.
              </p>
            </div>
          </div>

          {feedback && (
            <div
              className={`p-3.5 rounded-2xl text-xs font-semibold flex items-center gap-2 border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-rose-50 text-rose-800 border-rose-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            {/* SECTION 1: Operating Hours & Weekly Schedule */}
            <div className="bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 p-5 rounded-2xl border border-amber-200/80 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-black text-stone-900 uppercase tracking-wider">
                    Operating Schedule & Status
                  </span>
                </div>
                {/* Live Status Pill Preview */}
                <span
                  className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 ${
                    currentPreviewStatus.isOpen
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-stone-200 text-stone-700 border border-stone-300'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      currentPreviewStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-stone-500'
                    }`}
                  />
                  {currentPreviewStatus.isOpen
                    ? 'Currently Open'
                    : currentPreviewStatus.isBreakActive
                    ? currentPreviewStatus.statusLabel
                    : 'Currently Closed'}
                </span>
              </div>

              {/* Clean Today's Summary + Modal Trigger Button */}
              <div className="bg-white p-4 rounded-xl border border-stone-200/80 space-y-3 shadow-2xs">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase text-stone-400 block tracking-wide">
                      Today ({DAY_DISPLAY_NAMES[todayKey]})
                    </span>
                    <span className="text-sm font-black text-stone-900 block">
                      {todaySchedule?.isOpen
                        ? `${formatTime12Hour(todaySchedule.open)} – ${formatTime12Hour(todaySchedule.close)}`
                        : 'Closed All Day'}
                    </span>
                  </div>

                  {todayBreaks.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 justify-end">
                      {todayBreaks.map((b, idx) => (
                        <span
                          key={b.id || idx}
                          className="text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-200 px-2.5 py-1 rounded-lg flex items-center gap-1"
                        >
                          <Coffee className="w-3 h-3 text-amber-700" />
                          {b.label || 'Break'}: {formatTime12Hour(b.start)} – {formatTime12Hour(b.end)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Dedicated Clean Modal Trigger */}
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-extrabold text-xs flex items-center justify-between group transition shadow-sm hover:shadow-md cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    <CalendarDays className="w-4 h-4 text-amber-200" />
                    <span>Customize Weekly Schedule & Breaks</span>
                  </div>
                  <span className="text-[11px] font-bold bg-white/20 px-2 py-0.5 rounded-md flex items-center gap-1 group-hover:bg-white/30 transition">
                    7 Days & Breaks <Sparkles className="w-3 h-3 text-amber-200" />
                  </span>
                </button>
              </div>

              {/* Default Hours (Synced with Weekly Mode) */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                    <Sun className="w-3.5 h-3.5 text-amber-600" /> Default Open Time
                  </label>
                  <input
                    type="time"
                    required
                    value={openingTime}
                    onChange={(e) => handleDefaultOpenChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                  <span className="block text-[10px] text-stone-500 mt-0.5 font-medium">
                    {formatTime12Hour(openingTime)} • Updates matching days
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                    <Moon className="w-3.5 h-3.5 text-indigo-600" /> Default Close Time
                  </label>
                  <input
                    type="time"
                    required
                    value={closingTime}
                    onChange={(e) => handleDefaultCloseChange(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-stone-300 bg-white text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                  />
                  <span className="block text-[10px] text-stone-500 mt-0.5 font-medium">
                    {formatTime12Hour(closingTime)} • Updates matching days
                  </span>
                </div>
              </div>

              {/* Force Closed / Emergency Override Toggle */}
              <div className="pt-3 border-t border-amber-200/60">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-stone-900 block">
                      Emergency / Holiday Override
                    </span>
                    <span className="text-[11px] text-stone-500 block">
                      Temporarily mark shop closed immediately (e.g. rain, maintenance)
                    </span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isClosedOverride}
                      onChange={(e) => setIsClosedOverride(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-600" />
                  </label>
                </div>

                {isClosedOverride && (
                  <div className="mt-2.5">
                    <input
                      type="text"
                      value={closedReason}
                      onChange={(e) => setClosedReason(e.target.value)}
                      placeholder="Notice e.g. Closed for Maintenance until 4 PM"
                      className="w-full px-3 py-2 text-xs rounded-xl border border-rose-200 bg-rose-50 text-rose-900 placeholder-rose-400 focus:outline-none focus:border-rose-400"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SECTION 2: Price Per KG */}
            <div className="bg-amber-50/60 p-4 rounded-2xl border border-amber-200/70 space-y-2">
              <label className="block text-xs font-black text-amber-950 uppercase tracking-wider">
                Grinding Price Per KG (Rs.)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-black text-amber-700">
                  Rs.
                </span>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  required
                  value={ratePerKg}
                  onChange={(e) => setRatePerKg(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-amber-300 font-bold text-lg text-stone-900 focus:outline-none focus:border-amber-600 bg-white transition"
                />
              </div>
              <p className="text-[11px] text-amber-900/70">
                This rate applies automatically to all new incoming orders.
              </p>
            </div>

            {/* SECTION 3: Shop Name & Phone */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Shop Name
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Chakki Fresh"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-sm font-medium focus:border-amber-500 focus:outline-none transition bg-stone-50/50"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1.5">
                  Counter Phone Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="e.g. 0300 1234567"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-200 text-sm font-medium focus:border-amber-500 focus:outline-none transition bg-stone-50/50"
                  />
                </div>
                <p className="text-[11px] text-stone-500 mt-1">
                  Printed on receipts and available to customers
                </p>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.98] transition shadow-md shadow-amber-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              {saving ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Shop Settings
                </>
              )}
            </button>
          </form>
        </motion.div>
      </div>

      {/* Pop-up Weekly Schedule & Breaks Modal */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        initialSchedule={weeklySchedule}
        onSave={handleSaveWeeklySchedule}
      />
    </div>
  );
}
