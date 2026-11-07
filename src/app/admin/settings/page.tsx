'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ShopSettings } from '@/types/database';
import { formatTime12Hour, useShopOperatingStatus } from '@/lib/utils/shopHours';
import {
  ArrowLeft,
  Store,
  Phone,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Clock,
  Moon,
  Sun,
  ShieldAlert,
} from 'lucide-react';
import { motion } from 'framer-motion';

export default function AdminSettingsPage() {
  const router = useRouter();
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [shopName, setShopName] = useState('');
  const [ratePerKg, setRatePerKg] = useState('15');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [openingTime, setOpeningTime] = useState('08:00');
  const [closingTime, setClosingTime] = useState('21:00');
  const [isClosedOverride, setIsClosedOverride] = useState(false);
  const [closedReason, setClosedReason] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  const supabase = createClient();

  useEffect(() => {
    async function loadSettings() {
      const { data, error } = await supabase
        .from('shop_settings')
        .select('*')
        .limit(1)
        .single();

      if (!error && data) {
        setSettings(data as ShopSettings);
        setShopName(data.shop_name || 'Chakki Fresh');
        setRatePerKg(data.rate_per_kg?.toString() || '15');
        setPhoneNumber(data.phone_number || '');
        setOpeningTime(data.opening_time || '08:00');
        setClosingTime(data.closing_time || '21:00');
        setIsClosedOverride(!!data.is_closed_override);
        setClosedReason(data.closed_reason || '');
      }
      setLoading(false);
    }
    loadSettings();
  }, [supabase]);

  const currentPreviewStatus = useShopOperatingStatus({
    opening_time: openingTime,
    closing_time: closingTime,
    is_closed_override: isClosedOverride,
    closed_reason: closedReason,
  });

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

      const { error } = await supabase
        .from('shop_settings')
        .update({
          shop_name: shopName.trim() || 'Chakki Fresh',
          rate_per_kg: numRate,
          phone_number: phoneNumber.trim(),
          opening_time: openingTime || '08:00',
          closing_time: closingTime || '21:00',
          is_closed_override: isClosedOverride,
          closed_reason: closedReason.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', settings.id);

      if (error) throw error;

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

  return (
    <div className="min-h-screen bg-[#faf8f5] p-4 sm:p-6">
      <div className="max-w-xl mx-auto space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/admin')}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-stone-700 hover:text-amber-700 bg-white border border-stone-200 px-3 py-2 rounded-xl transition shadow-xs cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Orders
          </button>
          <span className="text-xs font-extrabold uppercase tracking-wider text-stone-600">
            Shop Configuration
          </span>
        </div>

        {/* Settings Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl border border-stone-200 space-y-6"
        >
          <div className="flex items-center gap-3 pb-4 border-b border-stone-100">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center border border-amber-200">
              <Store className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-stone-900">Chakki Settings & Hours</h2>
              <p className="text-xs text-stone-600">
                Manage operating hours, pickup schedule, rate per kg, and shop info.
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

          {loading ? (
            <div className="py-12 text-center space-y-2">
              <Loader2 className="w-7 h-7 animate-spin text-amber-600 mx-auto" />
              <p className="text-xs text-stone-600 font-medium">Loading settings...</p>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {/* SECTION 1: Operating Hours & Schedule */}
              <div className="bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 p-5 rounded-2xl border border-amber-200/80 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-black text-stone-900 uppercase tracking-wider">
                      Daily Operating Hours
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
                    {currentPreviewStatus.isOpen ? 'Currently Open' : 'Currently Closed'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                      <Sun className="w-3.5 h-3.5 text-amber-600" /> Opening Time
                    </label>
                    <input
                      type="time"
                      required
                      value={openingTime}
                      onChange={(e) => setOpeningTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                    <span className="block text-[10px] text-stone-500 mt-1">
                      {formatTime12Hour(openingTime)}
                    </span>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-stone-700 mb-1 flex items-center gap-1">
                      <Moon className="w-3.5 h-3.5 text-indigo-600" /> Closing Time
                    </label>
                    <input
                      type="time"
                      required
                      value={closingTime}
                      onChange={(e) => setClosingTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-stone-300 bg-white text-sm font-bold text-stone-900 focus:outline-none focus:border-amber-600"
                    />
                    <span className="block text-[10px] text-stone-500 mt-1">
                      {formatTime12Hour(closingTime)}
                    </span>
                  </div>
                </div>

                {/* Force Closed / Holiday Override Toggle */}
                <div className="pt-3 border-t border-amber-200/60">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-stone-900 block">
                        Manual Shop Override
                      </span>
                      <span className="text-[11px] text-stone-500 block">
                        Temporarily mark shop closed (e.g. holiday, break)
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
                        placeholder="Notice e.g. Closed for Friday Prayers until 2 PM"
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
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Shop Settings & Hours
                  </>
                )}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </div>
  );
}
