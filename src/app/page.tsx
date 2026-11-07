'use client';

import { useState } from 'react';
import { useCustomerOrders } from '@/lib/hooks/useCustomerOrders';
import OrderCard from '@/components/customer/OrderCard';
import CodeLookupModal from '@/components/customer/CodeLookupModal';
import LiveQRScannerModal from '@/components/customer/LiveQRScannerModal';
import AddOrderModal from '@/components/customer/AddOrderModal';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types/database';
import { useShopOperatingStatus, formatTime12Hour } from '@/lib/utils/shopHours';
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
  const currentRate = settings?.rate_per_kg || 15;

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
              {shopStatus.isOpen ? (
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
              <span className="font-extrabold text-stone-900">{currency} {Number(currentRate).toFixed(0)}/kg</span>
            </div>
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

        {/* State 1: ZERO active orders - BRIGHT, LIGHT, FRIENDLY HERO */}
        {!hasActiveOrders && !loading && (
          <div className="space-y-6 sm:space-y-8">
            {/* 1. Hero Tracker Card - Bright Light Mode with QR Focal Centerpiece */}
            <section className="bg-white rounded-3xl p-6 sm:p-10 border border-stone-200 shadow-lg shadow-stone-200/40 relative overflow-hidden">
              {/* Subtle fresh decorative glow */}
              <div className="absolute -top-16 -right-16 w-80 h-80 rounded-full bg-gradient-to-br from-amber-100/70 via-amber-50/40 to-transparent blur-3xl pointer-events-none" />
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600" />
              <div className="absolute right-6 bottom-4 opacity-10 pointer-events-none text-amber-600">
                <Wheat className="w-56 h-56" />
              </div>

              <div className="space-y-6 max-w-2xl relative z-10">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] sm:text-xs uppercase tracking-wider font-extrabold text-amber-800 bg-amber-50 px-3 py-1 rounded-full inline-block border border-amber-200">
                      Live Milling Tracker
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
                      <span>{shopStatus.isOpen ? 'Counter Open' : 'Counter Closed'}</span>
                    </span>
                  </div>

                  <h2 className="text-2xl sm:text-4xl font-black text-stone-900 tracking-tight leading-tight">
                    Track Your Wheat Grinding Live
                  </h2>
                  <p className="text-xs sm:text-sm text-stone-600 leading-relaxed max-w-xl">
                    Received an order slip from our counter? Scan your slip QR code with your phone camera for instant 1-second live tracking.
                  </p>
                </div>

                {/* PRIMARY ACTION: High-Visibility Vibrant QR Scanner Button */}
                <div className="space-y-3.5">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setIsScanModalOpen(true)}
                      className="py-4 px-6 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 active:scale-[0.98] text-white transition shadow-lg shadow-amber-500/25 flex items-center justify-center sm:justify-start gap-3.5 font-black text-sm sm:text-base cursor-pointer group"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center shadow-xs group-hover:scale-105 transition">
                        <QrCode className="w-6 h-6" />
                      </div>
                      <div className="text-left">
                        <span className="block leading-tight font-black text-white">
                          Scan Slip QR Code
                        </span>
                        <span className="block text-[11px] font-semibold text-amber-100 mt-0.5">
                          Instant camera lookup from your slip
                        </span>
                      </div>
                      <ArrowRight className="w-5 h-5 text-amber-200 ml-auto hidden sm:block group-hover:translate-x-1 transition" />
                    </button>
                  </div>

                  {/* SECONDARY ACTION: Crisp Clean Light-Mode PIN Input */}
                  <div className="pt-2.5 border-t border-stone-200/80">
                    <form
                      onSubmit={handleInlinePinLookup}
                      className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 max-w-md"
                    >
                      <span className="text-xs font-bold text-stone-600 shrink-0">
                        Or enter 4-digit PIN:
                      </span>
                      <div className="relative flex-1">
                        <KeyRound className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          maxLength={4}
                          value={inlinePin}
                          onChange={(e) => {
                            setInlinePin(e.target.value.replace(/[^0-9]/g, ''));
                            setInlineError(null);
                          }}
                          placeholder="e.g. 9457"
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-stone-50 border border-stone-200 text-stone-900 placeholder:text-stone-400 font-mono font-bold text-xs tracking-wider focus:bg-white focus:border-amber-500 focus:outline-none transition"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={inlinePin.length !== 4 || inlineLoading}
                        className="py-2 px-4 rounded-xl font-bold text-xs text-white bg-stone-900 hover:bg-stone-800 active:scale-95 transition shadow-xs disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1 shrink-0"
                      >
                        {inlineLoading ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <span>Track PIN</span>
                        )}
                      </button>
                    </form>

                    {/* Inline Error Message */}
                    {inlineError && (
                      <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-50 text-rose-800 border border-rose-200 px-3 py-1.5 rounded-xl">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>{inlineError}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Live Chakki Status & Rates Strip - Crisp White Cards */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Wheat className="w-3.5 h-3.5 text-amber-600" />
                  Milling Rate
                </span>
                <div className="flex items-baseline gap-1.5 pt-0.5">
                  <span className="text-2xl font-black text-stone-900">
                    {currency} {Number(currentRate).toFixed(0)}
                  </span>
                  <span className="text-xs text-stone-500 font-bold">/ kg</span>
                </div>
                <p className="text-[11px] text-stone-600 font-medium">100% whole wheat stone grinding</p>
              </div>

              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-2xs space-y-1">
                <span
                  className={`text-[11px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
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
                <div className="pt-0.5">
                  <span
                    className={`text-lg sm:text-xl font-black ${
                      shopStatus.isOpen ? 'text-emerald-800' : 'text-amber-900'
                    }`}
                  >
                    {shopStatus.isOpen ? 'Operational & Running' : 'Closed for the Night'}
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 font-medium">
                  {shopStatus.isOpen
                    ? `Hours: ${shopStatus.formattedHours}`
                    : `Opens ${shopStatus.formattedNextOpen}`}
                </p>
              </div>

              <div className="bg-white rounded-2xl p-4 sm:p-5 border border-stone-200 shadow-2xs space-y-1">
                <span className="text-[11px] font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-blue-600" />
                  Avg. Turnaround
                </span>
                <div className="pt-0.5">
                  <span className="text-lg sm:text-xl font-black text-stone-900">
                    15 – 25 Minutes
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 font-medium">Fast live stone rotation</p>
              </div>
            </section>

            {/* 3. "How Live Milling Works" 4-Stage Visual Pipeline */}
            <section className="bg-white rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-6">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider">
                  Our Process
                </span>
                <h3 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight">
                  How Your Flour is Milled & Tracked
                </h3>
                <p className="text-xs text-stone-600">
                  From grain weighing to cold stone grinding, follow every milestone transparently.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-stone-50/70 rounded-2xl p-4 border border-stone-200/80 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm">
                    <Scale className="w-5 h-5 text-amber-700" />
                  </div>
                  <h4 className="font-bold text-sm text-stone-900">1. Weighed & Logged</h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Wheat is weighed on digital scales and a 4-digit PIN is assigned to your bag.
                  </p>
                </div>

                <div className="bg-stone-50/70 rounded-2xl p-4 border border-stone-200/80 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm">
                    <Flame className="w-5 h-5 text-amber-700" />
                  </div>
                  <h4 className="font-bold text-sm text-stone-900">2. Cold-Stone Milling</h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Traditional heavy chakki stones rotate slowly to preserve bran vitamins and wheat germ oils.
                  </p>
                </div>

                <div className="bg-stone-50/70 rounded-2xl p-4 border border-stone-200/80 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm">
                    <ShoppingBag className="w-5 h-5 text-amber-700" />
                  </div>
                  <h4 className="font-bold text-sm text-stone-900">3. Sealed & Stored</h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Fresh flour is immediately packed in food-grade packaging ready for collection.
                  </p>
                </div>

                <div className="bg-stone-50/70 rounded-2xl p-4 border border-stone-200/80 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                  </div>
                  <h4 className="font-bold text-sm text-stone-900">4. Instant Counter Pickup</h4>
                  <p className="text-xs text-stone-600 leading-relaxed">
                    Show your pickup QR code at the counter for 1-second handover.
                  </p>
                </div>
              </div>
            </section>

            {/* 4. Trust Badges - BRIGHT LIGHT MODERN STYLE */}
            <section className="bg-gradient-to-br from-amber-50/40 via-white to-stone-50/50 rounded-3xl p-6 sm:p-8 border border-stone-200 shadow-xs space-y-4">
              <div className="text-center max-w-lg mx-auto space-y-1">
                <span className="text-[10px] font-extrabold text-amber-800 uppercase tracking-widest">
                  Why Stone-Ground Chakki Flour?
                </span>
                <h3 className="text-lg sm:text-xl font-black text-stone-900">Pure Wheat. Maximum Nutrition.</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-2xs text-center space-y-2">
                  <div className="w-11 h-11 mx-auto rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-2xs">
                    <ShieldCheck className="w-5 h-5 text-amber-700" />
                  </div>
                  <h5 className="font-black text-sm text-stone-900">100% Whole Wheat</h5>
                  <p className="text-xs text-stone-600 leading-relaxed">Zero maida, zero starch dilution. 100% genuine wheat grain.</p>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-2xs text-center space-y-2">
                  <div className="w-11 h-11 mx-auto rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-2xs">
                    <Sparkles className="w-5 h-5 text-amber-700" />
                  </div>
                  <h5 className="font-black text-sm text-stone-900">Zero Preservatives</h5>
                  <p className="text-xs text-stone-600 leading-relaxed">Freshly milled on demand. No chemical bleaches or shelf stabilizers.</p>
                </div>

                <div className="p-5 bg-white rounded-2xl border border-stone-200 shadow-2xs text-center space-y-2">
                  <div className="w-11 h-11 mx-auto rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shadow-2xs">
                    <Clock className="w-5 h-5 text-amber-700" />
                  </div>
                  <h5 className="font-black text-sm text-stone-900">Zero Queue Waiting</h5>
                  <p className="text-xs text-stone-600 leading-relaxed">Drop your wheat, track from home, and collect the moment it is ready.</p>
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
