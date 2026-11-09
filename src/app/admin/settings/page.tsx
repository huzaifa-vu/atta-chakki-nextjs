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
  Wheat,
  LogOut,
  Loader2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CACHE_KEY = 'chakki_cached_settings';

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [shopName, setShopName] = useState('Chakki Waly');
  const [ratePerKg, setRatePerKg] = useState('');
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

  // Sign out confirmation states
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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
        setShopName(parsed.shop_name || 'Chakki Waly');
        setRatePerKg(parsed.rate_per_kg != null ? parsed.rate_per_kg.toString() : '');
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
        setShopName(data.shop_name || 'Chakki Waly');
        setRatePerKg(data.rate_per_kg != null ? data.rate_per_kg.toString() : '');
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
        shop_name: shopName.trim() || 'Chakki Waly',
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

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await supabase.auth.signOut();
      router.replace('/admin/login');
    } catch (err) {
      console.error('Sign out error:', err);
      window.location.href = '/admin/login';
    }
  };

  return (
    <div className="min-h-screen bg-[#faf8f5] p-3.5 sm:p-6 overflow-x-hidden w-full">
      <div className="max-w-lg mx-auto space-y-4 sm:space-y-5">
        {/* Sleek Top Navigation Bar */}
        <div className="flex items-center justify-between pt-1">
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
            className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-amber-700 bg-white border border-stone-200/80 hover:border-amber-300 px-3.5 py-1.5 rounded-full transition shadow-2xs cursor-pointer active:scale-95"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Orders</span>
          </Link>

          <div className="flex items-center gap-2">
            {isSyncing ? (
              <span className="text-[11px] font-semibold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                Syncing...
              </span>
            ) : (
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-2.5 py-1 rounded-full flex items-center gap-1.5 shadow-2xs">
                <Check className="w-3 h-3 text-emerald-600" />
                Saved & Live
              </span>
            )}

            <button
              type="button"
              onClick={() => setShowSignOutConfirm(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-600 hover:text-rose-700 bg-white hover:bg-rose-50 border border-stone-200/80 hover:border-rose-200 px-3 py-1.5 rounded-full transition shadow-2xs cursor-pointer active:scale-95"
              title="Sign Out of Admin Portal"
            >
              <LogOut className="w-3.5 h-3.5 text-stone-500 hover:text-rose-600" />
              <span>Logout</span>
            </button>
          </div>
        </div>

        {/* Clean Header */}
        <div className="flex items-center gap-3 pt-0.5">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-700 flex items-center justify-center border border-amber-200/60 shadow-2xs shrink-0">
            <Store className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-extrabold text-stone-900 tracking-tight leading-normal pb-0.5">
              Shop Settings
            </h1>
            <p className="text-xs text-stone-500 font-medium">
              Operating hours, milling rate, and shop contact
            </p>
          </div>
        </div>

        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`p-3 rounded-2xl text-xs font-semibold flex items-center gap-2 border shadow-2xs ${
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
          </motion.div>
        )}

        {/* Modular, Soft Settings Cards */}
        <form onSubmit={handleSave} className="space-y-4">
          {/* CARD 1: Operating Hours & Status */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-2xs space-y-3.5"
          >
            {/* Header + Status Pill */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-200/50">
                  <Clock className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs sm:text-sm font-extrabold text-stone-900 leading-tight">
                    Operating Schedule
                  </h2>
                </div>
              </div>

              {/* Status Pill */}
              <span
                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                  currentPreviewStatus.isOpen
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-stone-100 text-stone-600 border border-stone-200'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    currentPreviewStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-stone-400'
                  }`}
                />
                {currentPreviewStatus.isOpen
                  ? 'Currently Open'
                  : currentPreviewStatus.isBreakActive
                  ? currentPreviewStatus.statusLabel
                  : 'Currently Closed'}
              </span>
            </div>

            {/* Today's Schedule Strip */}
            <div className="bg-stone-50/80 rounded-xl p-3 border border-stone-100 flex items-center justify-between">
              <div>
                <span className="text-[10px] font-extrabold uppercase text-stone-400 block tracking-wider">
                  Today ({DAY_DISPLAY_NAMES[todayKey]})
                </span>
                <span className="text-xs sm:text-sm font-black text-stone-800 block mt-0.5">
                  {todaySchedule?.isOpen
                    ? `${formatTime12Hour(todaySchedule.open)} – ${formatTime12Hour(todaySchedule.close)}`
                    : 'Closed All Day'}
                </span>
              </div>

              {todayBreaks.length > 0 && (
                <div className="flex flex-wrap gap-1 justify-end">
                  {todayBreaks.map((b, idx) => (
                    <span
                      key={b.id || idx}
                      className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200/60 px-2 py-0.5 rounded-md flex items-center gap-1"
                    >
                      <Coffee className="w-3 h-3 text-amber-600" />
                      {b.label || 'Break'}: {formatTime12Hour(b.start)} – {formatTime12Hour(b.end)}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Edit Weekly Schedule Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsScheduleModalOpen(true)}
              className="w-full p-2.5 sm:p-3 rounded-xl bg-amber-50/50 hover:bg-amber-100/60 border border-amber-200/70 text-amber-950 transition active:scale-[0.99] flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <CalendarDays className="w-4 h-4 text-amber-700 shrink-0" />
                <div className="text-left">
                  <span className="text-xs font-bold text-stone-900 block leading-tight">
                    Weekly Hours & Prayer Breaks
                  </span>
                  <span className="text-[10px] text-stone-500 block">
                    Set custom open/close & prayer breaks per day
                  </span>
                </div>
              </div>
              <span className="text-xs font-bold text-amber-800 bg-white border border-amber-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1 group-hover:bg-amber-50 shadow-2xs shrink-0">
                <span>Edit</span>
                <span className="group-hover:translate-x-0.5 transition-transform font-bold">→</span>
              </span>
            </button>

            {/* Default Open & Close Hours */}
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-700 flex items-center gap-1">
                  <Sun className="w-3.5 h-3.5 text-amber-600" />
                  Default Open
                </label>
                <input
                  type="time"
                  required
                  value={openingTime}
                  onChange={(e) => handleDefaultOpenChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-white focus:bg-white text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600 transition"
                />
                <span className="text-[10px] text-stone-500 font-medium block">
                  {formatTime12Hour(openingTime)}
                </span>
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-stone-700 flex items-center gap-1">
                  <Moon className="w-3.5 h-3.5 text-indigo-600" />
                  Default Close
                </label>
                <input
                  type="time"
                  required
                  value={closingTime}
                  onChange={(e) => handleDefaultCloseChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-white focus:bg-white text-xs font-bold text-stone-900 focus:outline-none focus:border-amber-600 transition"
                />
                <span className="text-[10px] text-stone-500 font-medium block">
                  {formatTime12Hour(closingTime)}
                </span>
              </div>
            </div>

            {/* Temporary Shop Closure Toggle */}
            <div className="pt-3 border-t border-stone-100 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-stone-900 block">
                    Temporarily Close Shop
                  </span>
                  <span className="text-[11px] text-stone-500 block">
                    Mark shop closed right now (e.g. power cut, rain, emergency)
                  </span>
                </div>
                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                  <input
                    type="checkbox"
                    checked={isClosedOverride}
                    onChange={(e) => setIsClosedOverride(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-stone-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-rose-500" />
                </label>
              </div>

              {isClosedOverride && (
                <div className="pt-1">
                  <input
                    type="text"
                    value={closedReason}
                    onChange={(e) => setClosedReason(e.target.value)}
                    placeholder="Reason for customers (e.g. Power cut, back at 4 PM)"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-rose-200 bg-rose-50/80 text-rose-900 placeholder-rose-400 focus:outline-none focus:border-rose-400"
                  />
                </div>
              )}
            </div>
          </motion.div>

          {/* CARD 2: Milling Rate */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-2xs space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-200/50">
                <Wheat className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-extrabold text-stone-900 leading-tight">
                  Milling Rate
                </h2>
                <p className="text-[11px] text-stone-500">
                  Stone grinding rate charged per kilogram
                </p>
              </div>
            </div>

            <div className="relative flex items-center">
              <span className="absolute left-3.5 text-xs font-bold text-amber-800 select-none">
                Rs.
              </span>
              <input
                type="number"
                step="0.5"
                min="1"
                required
                value={ratePerKg}
                onChange={(e) => setRatePerKg(e.target.value)}
                className="w-full pl-11 pr-14 py-2.5 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-white focus:bg-white text-base font-extrabold text-stone-900 focus:outline-none focus:border-amber-600 transition"
                placeholder="150"
              />
              <span className="absolute right-3.5 text-xs font-semibold text-stone-400 select-none">
                / kg
              </span>
            </div>
            <p className="text-[10px] text-stone-500 font-medium">
              Applied automatically when logging new bags at the counter.
            </p>
          </motion.div>

          {/* CARD 3: Shop Information */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-2xs space-y-3"
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 border border-amber-200/50">
                <Store className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-xs sm:text-sm font-extrabold text-stone-900 leading-tight">
                  Shop Information
                </h2>
                <p className="text-[11px] text-stone-500">
                  Contact details shown to customers and printed on slips
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Shop Name
                </label>
                <div className="relative">
                  <Store className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    placeholder="Chakki Waly"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-white focus:bg-white text-xs font-semibold text-stone-900 focus:border-amber-600 focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-stone-700 mb-1">
                  Counter Helpline Number
                </label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="0312-345-6789"
                    className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-stone-200 bg-stone-50/60 hover:bg-white focus:bg-white text-xs font-semibold text-stone-900 focus:border-amber-600 focus:outline-none transition"
                  />
                </div>
                <p className="text-[10px] text-stone-500 mt-1">
                  Printed on token slips and tapped by customers for direct calling
                </p>
              </div>
            </div>
          </motion.div>

          {/* Primary Save Action */}
          <button
            type="submit"
            disabled={saving}
            className="w-full py-3.5 px-4 rounded-2xl font-black text-sm text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.99] transition shadow-md shadow-amber-600/20 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving Settings...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Shop Settings
              </>
            )}
          </button>
        </form>

        {/* CARD 4: Admin Account & Sign Out */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-4"
        >
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-50 border border-rose-200/60 text-rose-600 flex items-center justify-center shrink-0">
              <LogOut className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-xs sm:text-sm font-extrabold text-stone-900 leading-tight">
                Admin Session
              </h2>
              <p className="text-[11px] text-stone-500">
                Sign out of the admin panel on this device
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs transition cursor-pointer active:scale-95 flex items-center justify-center gap-1.5 shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </motion.div>
      </div>

      {/* Pop-up Weekly Schedule & Breaks Modal */}
      <ScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        initialSchedule={weeklySchedule}
        onSave={handleSaveWeeklySchedule}
      />

      {/* Sign Out Confirmation Modal */}
      <AnimatePresence>
        {showSignOutConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="w-full max-w-sm rounded-3xl bg-white shadow-2xl border border-stone-200 overflow-hidden p-6 space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200/70 text-rose-600 flex items-center justify-center mx-auto shadow-2xs">
                <LogOut className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <h3 className="text-base font-black text-stone-900">
                  Sign out of Admin?
                </h3>
                <p className="text-xs text-stone-500 leading-relaxed max-w-xs mx-auto">
                  You will need your admin credentials to log back in and manage orders or shop settings.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={isSigningOut}
                  onClick={() => setShowSignOutConfirm(false)}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-stone-700 bg-stone-100 hover:bg-stone-200 active:scale-95 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={isSigningOut}
                  onClick={handleSignOut}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 active:scale-95 transition shadow-sm shadow-rose-600/30 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSigningOut ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Signing out...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Yes, Sign Out</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
