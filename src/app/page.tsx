'use client';

import { useState } from 'react';
import { useCustomerOrders } from '@/lib/hooks/useCustomerOrders';
import OrderCard from '@/components/customer/OrderCard';
import CodeLookupModal from '@/components/customer/CodeLookupModal';
import LiveQRScannerModal from '@/components/customer/LiveQRScannerModal';
import AddOrderModal from '@/components/customer/AddOrderModal';
import { Order } from '@/types/database';
import {
  Wheat,
  QrCode,
  KeyRound,
  History,
  RefreshCw,
  Loader2,
  Plus,
} from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

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

  const handleManualOrderFound = (order: Order) => {
    addOrderId(order.id);
  };

  const handleScanSuccess = (orderId: string) => {
    addOrderId(orderId);
  };

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const currency = settings?.currency || 'Rs.';
  const shopName = settings?.shop_name || 'Chakki Fresh';
  const currentRate = settings?.rate_per_kg || 15;

  const hasActiveOrders = activeOrders.length > 0;

  return (
    <div className="min-h-screen bg-[#faf8f5] flex flex-col justify-between">
      {/* Top Header - Ultra-clean & minimal */}
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
              className="p-2 text-stone-500 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container - Responsive: Compact on mobile, expansive & spacious on desktop */}
      <main className="flex-1 max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        {/* State 1: When ZERO active orders, show onboarding tracker card */}
        {!hasActiveOrders && !loading && (
          <section className="bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 rounded-3xl p-6 sm:p-10 text-white shadow-xl shadow-amber-600/15 relative overflow-hidden">
            <div className="space-y-5 max-w-2xl">
              <div className="space-y-1.5">
                <span className="text-[10px] sm:text-xs uppercase tracking-wider font-extrabold text-amber-100 bg-black/15 px-3 py-1 rounded-full inline-block backdrop-blur-sm">
                  Live Grinding Tracker
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                  Track Your Atta Order
                </h2>
                <p className="text-xs sm:text-sm text-amber-50/90 leading-relaxed">
                  Scan the QR code from your slip with your camera or enter your 4-digit PIN to track grinding live.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-1">
                <button
                  onClick={() => setIsScanModalOpen(true)}
                  className="py-3.5 px-5 rounded-2xl bg-white text-stone-900 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md hover:bg-amber-50 active:scale-[0.98] transition cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-amber-600" />
                  Scan QR Code
                </button>

                <button
                  onClick={() => setIsCodeModalOpen(true)}
                  className="py-3.5 px-5 rounded-2xl bg-black/20 hover:bg-black/30 backdrop-blur-sm text-white font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 border border-white/20 active:scale-[0.98] transition cursor-pointer"
                >
                  <KeyRound className="w-4 h-4 text-amber-200" />
                  Enter PIN
                </button>
              </div>
            </div>
          </section>
        )}

        {/* State 2: When user has ACTIVE ORDERS, they take full priority at the top! */}
        {hasActiveOrders && (
          <section className="space-y-4">
            {/* Mobile-bulletproof header row */}
            <div className="flex items-center justify-between gap-2 pb-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <h2 className="text-sm sm:text-base font-black text-stone-900 truncate">
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

            {/* Discreet helper to add a 2nd bag if desired */}
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

        {/* Loading Indicator */}
        {loading && (
          <div className="bg-white rounded-3xl p-10 border border-stone-200 text-center space-y-3">
            <Loader2 className="w-7 h-7 animate-spin text-amber-600 mx-auto" />
            <p className="text-xs font-semibold text-stone-500">Checking your order...</p>
          </div>
        )}

        {/* Completed History (Collapsible) */}
        {pastOrders.length > 0 && (
          <section className="pt-4 border-t border-stone-200 space-y-3">
            <button
              onClick={() => setShowHistory(!showHistory)}
              className="text-xs font-bold text-stone-500 hover:text-stone-800 flex items-center gap-1.5 transition cursor-pointer"
            >
              <History className="w-3.5 h-3.5" />
              {showHistory ? 'Hide Past Completed Orders' : `View Past Orders (${pastOrders.length})`}
            </button>

            {showHistory && (
              <div className="space-y-3 pt-1">
                {pastOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    currency={currency}
                    onRemove={removeOrderId}
                  />
                ))}
              </div>
            )}
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
