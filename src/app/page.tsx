'use client';

import { useState } from 'react';
import { useCustomerOrders } from '@/lib/hooks/useCustomerOrders';
import OrderCard from '@/components/customer/OrderCard';
import CodeLookupModal from '@/components/customer/CodeLookupModal';
import LiveQRScannerModal from '@/components/customer/LiveQRScannerModal';
import AddOrderModal from '@/components/customer/AddOrderModal';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types/database';
import { useShopOperatingStatus, useShopCountdown, formatTime12Hour } from '@/lib/utils/shopHours';
import {
  Wheat,
  QrCode,
  KeyRound,
  History,
  RefreshCw,
  Loader2,
  Plus,
  Scale,
  Flame,
  ShoppingBag,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  Clock,
  ArrowRight,
  AlertCircle,
  Moon,
  Coffee,
  Phone,
  PhoneCall,
  Receipt,
  HelpCircle,
  ChevronRight,
  Check,
} from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

export default function CustomerDashboard() {
  const {
    orders,
    activeOrders,
    pastOrders,
    settings,
    loading,
    addOrderId,
    removeOrderId,
    refetch,
  } = useCustomerOrders();

  const [isCodeModalOpen, setIsCodeModalOpen] = useState(false);
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [isAddBagModalOpen, setIsAddBagModalOpen] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Inline PIN entry on hero
  const [inlinePin, setInlinePin] = useState('');
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const supabase = createClient();
  const shopStatus = useShopOperatingStatus(settings);
  const countdown = useShopCountdown(shopStatus.isOpen ? null : shopStatus.nextOpenDate);
  const hasPhoneNumber = Boolean(settings?.phone_number && settings.phone_number.trim().length > 0);

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const handleInlinePinLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = inlinePin.trim();
    if (cleanPin.length !== 4) return;

    setInlineLoading(true);
    setInlineError(null);

    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('access_code', cleanPin)
        .neq('status', 'completed')
        .limit(1);

      if (error) throw error;

      if (!data || data.length === 0) {
        setInlineError(`No active order found for PIN #${cleanPin}. Please check your slip.`);
        return;
      }

      addOrderId(data[0].id);
      setInlinePin('');
      showToast(`✓ Order for ${data[0].customer_name || 'Customer'} (PIN #${cleanPin}) tracked live!`);
    } catch {
      setInlineError('Connection issue. Please verify code and try again.');
    } finally {
      setInlineLoading(false);
    }
  };

  const handleManualOrderFound = (order: Order) => {
    addOrderId(order.id);
    showToast(`✓ Order for ${order.customer_name || 'Customer'} tracked live!`);
  };

  const handleScanSuccess = (orderId: string, code?: string) => {
    addOrderId(orderId);
    showToast(
      code
        ? `✓ Order #${code} tracked live!`
        : `✓ QR code scanned! Bag added to live tracking.`
    );
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 400);
  };

  const currency = settings?.currency || 'Rs.';
  const shopName = settings?.shop_name || 'Chakki Fresh';
  const currentRate =
    settings?.rate_per_kg !== undefined && settings?.rate_per_kg !== null
      ? Number(settings.rate_per_kg)
      : null;
  const displayRate =
    currentRate !== null
      ? Number.isInteger(currentRate)
        ? currentRate.toString()
        : currentRate.toFixed(2)
      : '—';

  const hasActiveOrders = activeOrders.length > 0;

  return (
    <div className="min-h-screen bg-[#fcfbf9] flex flex-col justify-between">
      {/* Top Header - Bright, Fresh & Modern */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-8 py-3.5 shadow-2xs">
        <div className="max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto flex items-center justify-between gap-4">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-500/20">
              <Wheat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-black text-stone-900 tracking-tight leading-none">
                  {shopName}
                </h1>
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    shopStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
              </div>
              <p className="text-[11px] sm:text-xs text-stone-500 font-medium mt-0.5">
                Fresh Stone Ground Atta • Pure & Live
              </p>
            </div>
          </div>

          {/* Center: Live Operating Status & Milling Rate Badge (Desktop & Tablet) */}
          <div className="hidden md:flex items-center gap-2.5">
            {/* Live Open/Closed Pill */}
            <div
              className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${
                shopStatus.isOpen
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200'
              }`}
            >
              {shopStatus.isBreakActive ? (
                <>
                  <Coffee className="w-3.5 h-3.5 text-amber-700" />
                  <span>{shopStatus.breakLabel || 'Break'}</span>
                  <span className="text-amber-700/80 font-medium">• Reopens {shopStatus.formattedNextOpen}</span>
                </>
              ) : shopStatus.isOpen ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Open Now</span>
                  <span className="text-emerald-700/80 font-medium">• Closes {formatTime12Hour(settings?.closing_time)}</span>
                </>
              ) : (
                <>
                  <Moon className="w-3.5 h-3.5 text-amber-700" />
                  <span>Closed</span>
                  <span className="text-amber-700/80 font-medium">• Opens {shopStatus.formattedNextOpen}</span>
                </>
              )}
            </div>

            {/* Milling Rate Chip */}
            <div className="px-3 py-1.5 rounded-full bg-stone-100 border border-stone-200 text-xs font-bold text-stone-700 flex items-center gap-1">
              <span className="text-stone-500 font-medium">Rate:</span>
              <span className="font-extrabold text-stone-900">{currency} {displayRate}/kg</span>
            </div>

            {/* Helpline Chip (only if phone added) */}
            {hasPhoneNumber && (
              <a
                href={`tel:${settings?.phone_number}`}
                className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-stone-100 hover:bg-amber-50 hover:border-amber-300 border border-stone-200 text-xs font-bold text-stone-700 hover:text-amber-800 transition cursor-pointer"
                title="Call Counter Helpline"
              >
                <Phone className="w-3.5 h-3.5 text-amber-600" />
                <span>{settings?.phone_number}</span>
              </a>
            )}
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {hasActiveOrders && (
              <button
                type="button"
                onClick={() => setIsAddBagModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 py-1.5 px-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bag</span>
              </button>
            )}

            <button
              onClick={handleManualRefresh}
              className="p-2 sm:px-3 sm:py-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Refresh status"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </header>

      {/* Floating Action Confirmation Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-18 left-1/2 -translate-x-1/2 z-50 bg-stone-900/95 backdrop-blur-md text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-full shadow-2xl flex items-center gap-2 border border-stone-700/80 pointer-events-none"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Container */}
      <main className="flex-1 max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Loading Indicator */}
        {loading && (
          <div className="p-12 text-center bg-white rounded-3xl border border-stone-200 shadow-sm space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto" />
            <p className="text-xs font-semibold text-stone-500">Connecting to live chakki updates...</p>
          </div>
        )}

        {/* State 1: ZERO active orders - ELEVATED MODERN CONSUMER EXPERIENCE */}
        {!hasActiveOrders && !loading && (
          <div className="space-y-6 sm:space-y-8">
            {/* 1. Hero Tracker Card - Modern Dual-Column Hub */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 lg:p-10 border border-stone-200 shadow-xl shadow-stone-200/30 relative overflow-hidden">
              {/* Subtle Ambient Golden Glow */}
              <div className="absolute -top-20 -right-20 w-96 h-96 rounded-full bg-gradient-to-br from-amber-200/40 via-amber-100/20 to-transparent blur-3xl pointer-events-none" />
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative z-10">
                {/* Left Column: Interactive Tracking Actions (Col 7) */}
                <div className="lg:col-span-7 space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] sm:text-xs uppercase tracking-wider font-extrabold text-amber-900 bg-amber-50 px-3 py-1 rounded-full inline-flex items-center gap-1.5 border border-amber-200 shadow-2xs">
                        <Wheat className="w-3.5 h-3.5 text-amber-600" />
                        Live Stone-Milling Tracker
                      </span>
                      <span
                        className={`text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${
                          shopStatus.isOpen
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            shopStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                          }`}
                        />
                        <span>
                          {shopStatus.isBreakActive
                            ? shopStatus.breakLabel || 'Break'
                            : shopStatus.isOpen
                            ? 'Counter Open'
                            : 'Counter Closed'}
                        </span>
                      </span>
                    </div>

                    <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-stone-900 tracking-tight leading-[1.12]">
                      Track Your Fresh Atta{' '}
                      <span className="bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 bg-clip-text text-transparent">
                        Live & Pure
                      </span>
                    </h1>
                    <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-lg">
                      Received an order slip from our counter? Scan your slip QR code with your phone camera or enter your 4-digit PIN to follow your bag live.
                    </p>
                  </div>

                  {/* Primary Action Console */}
                  <div className="space-y-4">
                    <button
                      type="button"
                      onClick={() => setIsScanModalOpen(true)}
                      className="w-full sm:w-auto py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] text-white transition shadow-lg shadow-amber-500/25 flex items-center justify-between sm:justify-start gap-4 font-black text-sm sm:text-base cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition">
                        <QrCode className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <span className="block leading-tight font-black text-white">
                          Scan Slip QR Code
                        </span>
                        <span className="block text-[11px] font-semibold text-amber-100 mt-0.5">
                          Instant camera lookup from your receipt
                        </span>
                      </div>
                      <ArrowRight className="w-5 h-5 text-amber-200 ml-auto hidden sm:block group-hover:translate-x-1 transition" />
                    </button>

                    {/* Secondary PIN Form */}
                    <div className="pt-3 border-t border-stone-200/80">
                      <form
                        onSubmit={handleInlinePinLookup}
                        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 max-w-md"
                      >
                        <span className="text-xs font-bold text-stone-600 shrink-0 flex items-center gap-1.5">
                          <KeyRound className="w-3.5 h-3.5 text-amber-600" />
                          Or enter 4-digit PIN:
                        </span>
                        <div className="relative flex-1">
                          <input
                            type="text"
                            maxLength={4}
                            value={inlinePin}
                            onChange={(e) => {
                              setInlinePin(e.target.value.replace(/[^0-9]/g, ''));
                              setInlineError(null);
                            }}
                            placeholder="e.g. 9457"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 placeholder:text-stone-400 font-mono font-bold text-sm tracking-widest focus:bg-white focus:border-amber-500 focus:outline-none transition shadow-2xs"
                          />
                        </div>
                        <button
                          type="submit"
                          disabled={inlinePin.length !== 4 || inlineLoading}
                          className="py-2.5 px-4 rounded-xl font-bold text-xs text-white bg-stone-900 hover:bg-stone-800 active:scale-95 transition shadow-xs disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                        >
                          {inlineLoading ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <span>Track PIN</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </>
                          )}
                        </button>
                      </form>

                      {inlineError && (
                        <div className="mt-2.5 inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-xl">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>{inlineError}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Column: Visual Receipt Guide (Col 5) */}
                <div className="lg:col-span-5">
                  <div className="bg-gradient-to-br from-stone-50/90 via-amber-50/30 to-stone-50/90 rounded-2xl p-5 border border-stone-200/90 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-stone-200/70">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center font-bold shadow-2xs">
                          <Receipt className="w-4 h-4 text-amber-700" />
                        </div>
                        <div>
                          <span className="text-xs font-black text-stone-900 block leading-tight">
                            Paper Slip Guide
                          </span>
                          <span className="text-[10px] text-stone-500 font-medium block">
                            How to find your tracking code
                          </span>
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold uppercase bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full">
                        1-Sec Lookup
                      </span>
                    </div>

                    {/* Realistic Slip Mockup */}
                    <div className="bg-white rounded-xl p-4 border border-stone-200/80 shadow-2xs space-y-3">
                      <div className="flex items-center justify-between text-[11px] text-stone-400 font-mono pb-2 border-b border-dashed border-stone-200">
                        <span>CHAKKI FRESH SLIP</span>
                        <span>#BAG-RECEIPT</span>
                      </div>

                      <div className="flex items-center gap-3">
                        <div className="w-14 h-14 bg-stone-900 rounded-lg p-1.5 flex items-center justify-center shrink-0 shadow-xs relative">
                          <QrCode className="w-full h-full text-white" />
                          <span className="absolute -bottom-1 -right-1 flex h-2.5 w-2.5">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                          </span>
                        </div>
                        <div className="space-y-0.5 text-left">
                          <span className="text-[11px] font-bold text-stone-800 block">
                            QR Code on Slip
                          </span>
                          <p className="text-[10px] text-stone-500 leading-tight">
                            Point your camera to jump directly to live bag progress.
                          </p>
                        </div>
                      </div>

                      <div className="pt-2 border-t border-dashed border-stone-200 flex items-center justify-between">
                        <div className="space-y-0.5">
                          <span className="text-[10px] font-bold text-stone-500 uppercase tracking-wider block">
                            4-Digit PIN
                          </span>
                          <span className="text-xs font-mono font-black text-stone-900 bg-stone-100 px-2 py-0.5 rounded-md border border-stone-200">
                            PIN: 9457
                          </span>
                        </div>
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
                          No App Required
                        </span>
                      </div>
                    </div>

                    {/* 3 Steps Mini Timeline */}
                    <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
                      <div className="p-2 rounded-xl bg-white/70 border border-stone-200/60">
                        <span className="block text-[10px] font-extrabold text-stone-700">1. Weighed</span>
                        <span className="block text-[9px] text-stone-400">Slip issued</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white/70 border border-stone-200/60">
                        <span className="block text-[10px] font-extrabold text-amber-700">2. Milling</span>
                        <span className="block text-[9px] text-stone-400">Cold stone</span>
                      </div>
                      <div className="p-2 rounded-xl bg-white/70 border border-stone-200/60">
                        <span className="block text-[10px] font-extrabold text-emerald-700">3. Pickup</span>
                        <span className="block text-[9px] text-stone-400">Sealed bag</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Live Chakki Status & Milling Rates Strip - Crisp Modern Cards */}
            <section
              className={`grid grid-cols-1 ${
                hasPhoneNumber ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
              } gap-3 sm:gap-4`}
            >
              {/* Card 1: Milling Rate */}
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Wheat className="w-3.5 h-3.5 text-amber-600" />
                  Milling Rate
                </span>
                <div className="flex items-baseline gap-1.5 pt-0.5">
                  <span className="text-2xl font-black text-stone-900">
                    {currency} {displayRate}
                  </span>
                  <span className="text-xs text-stone-500 font-bold">/ kg</span>
                </div>
                <p className="text-[11px] text-stone-600 font-medium">
                  100% whole wheat stone grinding
                </p>
              </div>

              {/* Card 2: Chakki Status (Visually accurate with live open badge or countdown timer) */}
              <div
                className={`rounded-2xl p-4 sm:p-5 border transition shadow-2xs space-y-1.5 ${
                  shopStatus.isOpen
                    ? 'bg-gradient-to-br from-emerald-50/50 via-white to-white border-emerald-200'
                    : 'bg-gradient-to-br from-amber-50/60 via-white to-white border-amber-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`text-[11px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                      shopStatus.isOpen ? 'text-emerald-800' : 'text-amber-800'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        shopStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    Chakki Status
                  </span>

                  <span
                    className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                      shopStatus.isOpen
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-amber-100 text-amber-900 border border-amber-300'
                    }`}
                  >
                    {shopStatus.isOpen
                      ? 'Open Now'
                      : shopStatus.isBreakActive
                      ? 'Break Time'
                      : 'Closed'}
                  </span>
                </div>

                <div className="pt-0.5">
                  {shopStatus.isOpen ? (
                    <div>
                      <span className="text-lg sm:text-xl font-black text-emerald-950 block leading-tight">
                        Operational & Milling
                      </span>
                      <p className="text-[11px] text-emerald-800/80 font-semibold mt-1">
                        Today: {shopStatus.formattedHours}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xl sm:text-2xl font-black text-amber-950 font-mono tracking-tight">
                          {countdown.formattedString}
                        </span>
                        <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-wide">
                          until open
                        </span>
                      </div>
                      <p className="text-[11px] text-stone-600 font-semibold mt-1 flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Reopens {shopStatus.formattedNextOpen}</span>
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Card 3: Counter Phone Contact (ONLY shown if admin configured phone number) */}
              {hasPhoneNumber && (
                <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-2xs space-y-1.5 flex flex-col justify-between hover:border-amber-300 transition group">
                  <div>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Phone className="w-3.5 h-3.5 text-amber-600" />
                        Counter Helpline
                      </span>
                      <span className="text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-md">
                        Direct Call
                      </span>
                    </div>

                    <div className="pt-1">
                      <a
                        href={`tel:${settings?.phone_number}`}
                        className="inline-flex items-center gap-2 text-lg sm:text-xl font-black text-stone-900 group-hover:text-amber-700 transition tracking-tight"
                      >
                        <PhoneCall className="w-4 h-4 text-amber-600 shrink-0 group-hover:scale-110 transition" />
                        <span>{settings?.phone_number}</span>
                      </a>
                    </div>
                  </div>

                  <p className="text-[11px] text-stone-500 font-medium">
                    Call counter for orders, timings & support
                  </p>
                </div>
              )}
            </section>

            {/* 3. "How Live Milling Works" 4-Stage Visual Pipeline */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
                <div className="space-y-1">
                  <span className="text-[11px] font-extrabold text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                    Transparent Process
                  </span>
                  <h3 className="text-xl sm:text-2xl font-black text-stone-900 tracking-tight">
                    How Your Flour is Milled & Tracked
                  </h3>
                </div>
                <p className="text-xs text-stone-500 max-w-sm">
                  From electronic weighing to slow cold stone grinding, watch every step in real-time.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gradient-to-b from-stone-50/80 to-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs space-y-3 relative overflow-hidden group hover:border-amber-300 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full">
                      Step 01
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
                      <Scale className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-stone-900">Weighed & Logged</h4>
                    <p className="text-xs text-stone-600 leading-relaxed mt-1">
                      Wheat is weighed on digital scales. A counter receipt with QR code and 4-digit PIN is assigned to your bag.
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-b from-stone-50/80 to-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs space-y-3 relative overflow-hidden group hover:border-amber-300 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full">
                      Step 02
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
                      <Flame className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-stone-900">Cold-Stone Milling</h4>
                    <p className="text-xs text-stone-600 leading-relaxed mt-1">
                      Heavy traditional chakki stones grind slowly without heat friction to preserve natural bran fiber and germ oils.
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-b from-stone-50/80 to-white rounded-2xl p-5 border border-stone-200/80 shadow-2xs space-y-3 relative overflow-hidden group hover:border-amber-300 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-amber-800 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full">
                      Step 03
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center font-bold">
                      <ShoppingBag className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-stone-900">Sealed & Stored</h4>
                    <p className="text-xs text-stone-600 leading-relaxed mt-1">
                      Fresh whole atta is immediately packed and heat-sealed in food-grade packaging ready for collection.
                    </p>
                  </div>
                </div>

                <div className="bg-gradient-to-b from-emerald-50/50 via-white to-white rounded-2xl p-5 border border-emerald-200/80 shadow-2xs space-y-3 relative overflow-hidden group hover:border-emerald-300 transition">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                      Step 04
                    </span>
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div>
                    <h4 className="font-extrabold text-sm text-stone-900">Instant Pickup</h4>
                    <p className="text-xs text-stone-600 leading-relaxed mt-1">
                      Show your pickup QR code or 4-digit PIN at the counter for instant, queue-free collection.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. Trust Badges - Nutrition & Craft Quality */}
            <section className="bg-gradient-to-br from-amber-50/40 via-white to-stone-50/50 rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-5">
              <div className="text-center max-w-lg mx-auto space-y-1">
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-widest">
                  Why Stone-Ground Chakki Flour?
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-stone-900">
                  Pure Whole Grain. Uncompromised Health.
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs text-center space-y-2.5 hover:border-amber-300 transition">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-2xs">
                    <ShieldCheck className="w-6 h-6 text-amber-700" />
                  </div>
                  <h5 className="font-black text-sm text-stone-900">100% Whole Wheat</h5>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Zero maida or industrial bleaching. Every gram contains pure, natural bran, germ, and endosperm.
                  </p>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs text-center space-y-2.5 hover:border-amber-300 transition">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-2xs">
                    <Sparkles className="w-6 h-6 text-amber-700" />
                  </div>
                  <h5 className="font-black text-sm text-stone-900">Cold-Milled Nutrients</h5>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Slow stone friction prevents thermal damage, keeping heat-sensitive Vitamin E and B-complex vitamins alive.
                  </p>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-stone-200/80 shadow-2xs text-center space-y-2.5 hover:border-amber-300 transition">
                  <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-2xs">
                    <Clock className="w-6 h-6 text-amber-700" />
                  </div>
                  <h5 className="font-black text-sm text-stone-900">Zero Queue Waiting</h5>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Hand over your wheat, go home, and track everything live. Arrive exactly when your bag is ready.
                  </p>
                </div>
              </div>
            </section>

            {/* 5. Frequently Asked Questions / Quick Help Guide */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-5">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-amber-600" />
                <h3 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                  Customer Quick Guide & FAQ
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-stone-50/70 border border-stone-200/70 space-y-1.5">
                  <span className="text-xs font-black text-stone-900 block">
                    Do I have to wait at the shop?
                  </span>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    No! Hand in your wheat, take your printed slip, and leave. You can check this live tracker from home on your phone.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50/70 border border-stone-200/70 space-y-1.5">
                  <span className="text-xs font-black text-stone-900 block">
                    Where is my 4-digit PIN?
                  </span>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Look near the top of your counter receipt slip. Your 4-digit PIN is printed clearly right under the QR code.
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-stone-50/70 border border-stone-200/70 space-y-1.5">
                  <span className="text-xs font-black text-stone-900 block">
                    Can someone else collect my bag?
                  </span>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Yes! You can share your tracking link or screenshot of the pickup QR code with your family member or driver.
                  </p>
                </div>
              </div>
            </section>
          </div>
        )}

        {/* State 2: HAS active orders - Active Tracking Feed */}
        {hasActiveOrders && (
          <div className="space-y-6">
            {/* Header info & Add Bag trigger */}
            <div className="flex items-center justify-between pb-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                  Your Active Order{activeOrders.length > 1 ? 's' : ''} ({activeOrders.length})
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsAddBagModalOpen(true)}
                className="py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Bag</span>
              </button>
            </div>

            {/* Active Order Card(s) with Settings passed */}
            <div className="space-y-5">
              <AnimatePresence>
                {activeOrders.map((order, idx) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    settings={settings}
                    currency={currency}
                    bagIndex={idx}
                    totalActiveCount={activeOrders.length}
                    onRemove={removeOrderId}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Helper to track another bag */}
            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setIsScanModalOpen(true)}
                className="text-xs text-amber-800 hover:text-amber-950 font-bold underline underline-offset-4 cursor-pointer"
              >
                Have another token or slip? Scan or Enter PIN
              </button>
            </div>
          </div>
        )}

        {/* Past Orders Toggle */}
        {pastOrders.length > 0 && (
          <div className="pt-4 border-t border-stone-200">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="w-full py-3 px-4 rounded-2xl bg-white border border-stone-200 text-stone-700 text-xs font-bold hover:bg-stone-50 transition flex items-center justify-between cursor-pointer"
            >
              <span className="flex items-center gap-2">
                <History className="w-4 h-4 text-stone-400" />
                <span>Recently Completed Orders ({pastOrders.length})</span>
              </span>
              <span>{showHistory ? '▲ Hide' : '▼ Show'}</span>
            </button>

            {showHistory && (
              <div className="mt-4 space-y-3">
                {pastOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    settings={settings}
                    currency={currency}
                    onRemove={removeOrderId}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="mt-12 py-6 px-4 border-t border-stone-200 bg-white/60 text-stone-600 text-xs text-center font-medium">
        <div className="max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto flex items-center justify-between">
          <span>{shopName} • Fresh Stone Ground Atta</span>
          <span>Live Tracking</span>
        </div>
      </footer>

      {/* Modals */}
      <CodeLookupModal
        isOpen={isCodeModalOpen}
        onClose={() => setIsCodeModalOpen(false)}
        onOrderFound={handleManualOrderFound}
      />

      <LiveQRScannerModal
        isOpen={isScanModalOpen}
        onClose={() => setIsScanModalOpen(false)}
        onScanSuccess={handleScanSuccess}
        onOpenCodeInput={() => setIsCodeModalOpen(true)}
      />

      <AddOrderModal
        isOpen={isAddBagModalOpen}
        onClose={() => setIsAddBagModalOpen(false)}
        onSelectScan={() => setIsScanModalOpen(true)}
        onSelectPin={() => setIsCodeModalOpen(true)}
      />
    </div>
  );
}
