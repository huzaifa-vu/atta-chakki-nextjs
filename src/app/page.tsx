'use client';

import { useState } from 'react';
import { useCustomerOrders } from '@/lib/hooks/useCustomerOrders';
import OrderCard from '@/components/customer/OrderCard';
import CodeLookupModal from '@/components/customer/CodeLookupModal';
import LiveQRScannerModal from '@/components/customer/LiveQRScannerModal';
import AddOrderModal from '@/components/customer/AddOrderModal';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types/database';
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

  // Inline PIN entry on hero
  const [inlinePin, setInlinePin] = useState('');
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const supabase = createClient();

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
    } catch {
      setInlineError('Connection issue. Please verify code and try again.');
    } finally {
      setInlineLoading(false);
    }
  };

  const handleManualOrderFound = (order: Order) => {
    addOrderId(order.id);
  };

  const handleScanSuccess = (orderId: string) => {
    addOrderId(orderId);
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
    <div className="min-h-screen bg-[#faf8f5] flex flex-col justify-between">
      {/* Top Header - Responsive & Clean */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-8 py-3.5">
        <div className="max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-sm shadow-amber-500/20">
              <Wheat className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-black text-stone-900 tracking-tight">
                  {shopName}
                </h1>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[11px] sm:text-xs text-stone-500 font-medium">
                Live Flour Grinding • {currency} {Number(currentRate).toFixed(0)}/kg
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={handleManualRefresh}
              className="p-2 text-stone-500 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition cursor-pointer"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* Loading Indicator */}
        {loading && (
          <div className="p-12 text-center bg-white rounded-3xl border border-stone-200 shadow-sm space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto" />
            <p className="text-xs font-semibold text-stone-500">Connecting to live chakki updates...</p>
          </div>
        )}

        {/* State 1: ZERO active orders - Rich, engaging customer landing experience */}
        {!hasActiveOrders && !loading && (
          <div className="space-y-6 sm:space-y-8">
            {/* 1. Hero Tracker Card with Direct Inline PIN Input */}
            <section className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 rounded-3xl p-6 sm:p-10 text-white shadow-xl shadow-amber-600/15 relative overflow-hidden">
              <div className="space-y-5 max-w-2xl">
                <div className="space-y-1.5">
                  <span className="text-[10px] sm:text-xs uppercase tracking-wider font-extrabold text-amber-100 bg-black/15 px-3 py-1 rounded-full inline-block backdrop-blur-sm">
                    Live Milling Tracker
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-black tracking-tight leading-tight">
                    Track Your Wheat Grinding Live
                  </h2>
                  <p className="text-xs sm:text-sm text-amber-50/90 leading-relaxed">
                    Have an order slip from our counter? Enter your 4-digit PIN or scan your QR code with your camera to follow the stone milling progress in real-time.
                  </p>
                </div>

                {/* Inline Direct PIN Input Box */}
                <div className="space-y-2 pt-1">
                  <form onSubmit={handleInlinePinLookup} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-md">
                    <div className="relative flex-1">
                      <KeyRound className="w-4 h-4 text-amber-200 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        maxLength={4}
                        value={inlinePin}
                        onChange={(e) => {
                          setInlinePin(e.target.value.replace(/[^0-9]/g, ''));
                          setInlineError(null);
                        }}
                        placeholder="Enter 4-Digit PIN (e.g. 9457)"
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/20 text-white placeholder-amber-200/60 font-mono font-bold text-sm tracking-wider border border-white/20 focus:border-amber-300 focus:outline-none transition"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={inlinePin.length !== 4 || inlineLoading}
                      className="py-3 px-5 rounded-xl font-black text-xs sm:text-sm text-stone-900 bg-white hover:bg-amber-50 active:scale-95 transition shadow-sm disabled:opacity-50 cursor-pointer flex items-center justify-center gap-1.5 shrink-0"
                    >
                      {inlineLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                          <span>Checking...</span>
                        </>
                      ) : (
                        <>
                          <span>Track Bag</span>
                          <ArrowRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </form>

                  {/* Inline Error Message */}
                  {inlineError && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-rose-950/40 text-rose-100 border border-rose-400/40 px-3 py-1.5 rounded-xl backdrop-blur-xs">
                      <AlertCircle className="w-3.5 h-3.5 text-rose-300 shrink-0" />
                      <span>{inlineError}</span>
                    </div>
                  )}

                  {/* Secondary Camera QR Scan Button */}
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setIsScanModalOpen(true)}
                      className="inline-flex items-center gap-2 py-2 px-3.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold border border-white/20 transition cursor-pointer backdrop-blur-xs"
                    >
                      <QrCode className="w-4 h-4 text-amber-200" />
                      <span>Or Scan Slip with Camera</span>
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* 2. Live Chakki Status & Rates Strip */}
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
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Chakki Status
                </span>
                <div className="pt-0.5">
                  <span className="text-lg sm:text-xl font-black text-emerald-800">
                    Operational & Running
                  </span>
                </div>
                <p className="text-[11px] text-stone-600 font-medium">Fresh bags currently being ground</p>
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
                <p className="text-[11px] text-stone-600 font-medium">Ready for pickup at counter</p>
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
                  From grain weighing to hot stone grinding, follow every milestone transparently.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-stone-50/70 rounded-2xl p-4 border border-stone-200/80 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-sm">
                    <Scale className="w-5 h-5 text-amber-700" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-stone-900">1. Weighed & Logged</h4>
                    <p className="text-xs text-stone-600 font-medium mt-1 leading-relaxed">
                      Grain is weighed digitally, price is confirmed, and a unique 4-digit PIN is issued.
                    </p>
                  </div>
                </div>

                <div className="bg-stone-50/70 rounded-2xl p-4 border border-stone-200/80 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-800 flex items-center justify-center font-black text-sm">
                    <Flame className="w-5 h-5 text-orange-700" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-stone-900">2. Cold-Stone Milling</h4>
                    <p className="text-xs text-stone-600 font-medium mt-1 leading-relaxed">
                      Traditional slow stone chakki rotation grinds wheat without heating or nutrient loss.
                    </p>
                  </div>
                </div>

                <div className="bg-stone-50/70 rounded-2xl p-4 border border-stone-200/80 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-800 flex items-center justify-center font-black text-sm">
                    <ShoppingBag className="w-5 h-5 text-teal-700" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-stone-900">3. Hygienic Packaging</h4>
                    <p className="text-xs text-stone-600 font-medium mt-1 leading-relaxed">
                      Flour is cooled, weighed, and sealed in clean bags with your pickup slip ready.
                    </p>
                  </div>
                </div>

                <div className="bg-stone-50/70 rounded-2xl p-4 border border-stone-200/80 space-y-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h4 className="text-sm font-extrabold text-stone-900">4. Instant Counter Pickup</h4>
                    <p className="text-xs text-stone-600 font-medium mt-1 leading-relaxed">
                      Receive live notification on your phone. Show pickup QR at counter for instant handover.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 4. "Why Traditional Stone-Ground?" Quality Trust Badges */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center">
                  <Wheat className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-extrabold text-stone-900">100% Whole Wheat</h4>
                <p className="text-xs text-stone-600 leading-relaxed font-medium">
                  We never strip the wheat bran or germ. You get full natural dietary fiber and minerals.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-extrabold text-stone-900">Zero Preservatives</h4>
                <p className="text-xs text-stone-600 leading-relaxed font-medium">
                  Pure unadulterated flour ground fresh before your eyes, free from chemicals or bleaches.
                </p>
              </div>

              <div className="bg-white rounded-2xl p-5 border border-stone-200 shadow-2xs space-y-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-extrabold text-stone-900">Zero Queue Waiting</h4>
                <p className="text-xs text-stone-600 leading-relaxed font-medium">
                  Track from home, market, or car. Arrive right when your fresh bag is ground and ready.
                </p>
              </div>
            </section>
          </div>
        )}

        {/* State 2: When user has ACTIVE ORDERS, they take full priority at the top! */}
        {hasActiveOrders && (
          <section className="space-y-4">
            {/* Mobile-bulletproof header row */}
            <div className="flex items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <h2 className="text-base font-black text-stone-900 truncate">
                  Order Progress
                </h2>
                {activeOrders.length > 1 && (
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full shrink-0">
                    {activeOrders.length} Bags
                  </span>
                )}
              </div>

              <button
                onClick={() => setIsAddBagModalOpen(true)}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200/90 px-3 py-1.5 rounded-xl transition shrink-0 cursor-pointer whitespace-nowrap shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bag</span>
              </button>
            </div>

            {/* Active Order Card(s) */}
            <div className="space-y-4">
              <AnimatePresence>
                {activeOrders.map((order, idx) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    currency={currency}
                    bagIndex={idx}
                    totalActiveCount={activeOrders.length}
                    onRemove={removeOrderId}
                  />
                ))}
              </AnimatePresence>
            </div>

            {/* Discreet helper to add another bag */}
            <div className="pt-2 text-center">
              <button
                onClick={() => setIsAddBagModalOpen(true)}
                className="text-xs font-semibold text-stone-500 hover:text-amber-700 inline-flex items-center gap-1.5 transition cursor-pointer"
              >
                <Wheat className="w-3.5 h-3.5" />
                Have another bag of wheat? Track another order
              </button>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-stone-200/80 bg-white/50 py-4 px-4 sm:px-8 text-center text-xs text-stone-500">
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
