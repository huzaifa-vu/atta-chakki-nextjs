'use client';

import { useState, useRef } from 'react';
import { useCustomerOrders } from '@/lib/hooks/useCustomerOrders';
import OrderCard from '@/components/customer/OrderCard';
import CodeLookupModal from '@/components/customer/CodeLookupModal';
import LiveQRScannerModal from '@/components/customer/LiveQRScannerModal';
import AddOrderModal from '@/components/customer/AddOrderModal';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types/database';
import { useShopOperatingStatus, useShopCountdown, formatTime12Hour } from '@/lib/utils/shopHours';
import { formatPhoneNumber } from '@/lib/utils';
import { extractOrderInfoFromQR, playSuccessFeedback } from '@/lib/utils/qrUtils';
import {
  Wheat,
  QrCode,
  KeyRound,
  History,
  RefreshCw,
  Loader2,
  Plus,
  CheckCircle2,
  Clock,
  ArrowRight,
  AlertCircle,
  Phone,
  PhoneCall,
  ChevronRight,
  Camera,
  Upload,
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

  // Inline PIN & QR File Upload
  const [inlinePin, setInlinePin] = useState('');
  const [inlineLoading, setInlineLoading] = useState(false);
  const [inlineError, setInlineError] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

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

  // Direct QR Image Upload & Decoding
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadLoading(true);
    setActionError(null);
    setInlineError(null);

    try {
      const { Html5Qrcode } = await import('html5-qrcode');

      let container = document.getElementById('qr-file-scanner-temp');
      if (!container) {
        container = document.createElement('div');
        container.id = 'qr-file-scanner-temp';
        container.style.position = 'absolute';
        container.style.top = '-9999px';
        container.style.left = '-9999px';
        container.style.width = '1px';
        container.style.height = '1px';
        container.style.overflow = 'hidden';
        document.body.appendChild(container);
      }

      const html5Qr = new Html5Qrcode('qr-file-scanner-temp');
      const decodedResult = await html5Qr.scanFile(file, true);
      try {
        await html5Qr.clear();
      } catch {
        // Ignore clear error
      }

      const { orderId, code } = extractOrderInfoFromQR(decodedResult);
      let targetOrderId = orderId;

      if (!targetOrderId && code) {
        const { data } = await supabase
          .from('orders')
          .select('id, customer_name')
          .eq('access_code', code)
          .neq('status', 'completed')
          .limit(1)
          .maybeSingle();

        if (data?.id) {
          targetOrderId = data.id;
        }
      }

      if (targetOrderId) {
        playSuccessFeedback();
        addOrderId(targetOrderId);
        showToast(code ? `✓ Order #${code} tracked from QR photo!` : '✓ Order tracked from QR photo!');
      } else {
        setActionError('Could not find an active order in this QR image. Please check your slip.');
      }
    } catch (err) {
      console.error('Image scan error:', err);
      setActionError('Could not detect a QR code in this image. Please upload a clear photo or enter your PIN.');
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleInlinePinLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPin = inlinePin.trim();
    if (cleanPin.length !== 4) return;

    setInlineLoading(true);
    setInlineError(null);
    setActionError(null);

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
      {/* Top Header - Clean, Modern Dashboard Navigation */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-stone-200/80 px-4 sm:px-8 py-3 shadow-2xs">
        <div className="max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand Identity */}
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-sm shadow-amber-500/20 shrink-0">
              <Wheat className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1 className="text-base sm:text-lg font-black text-stone-900 tracking-tight leading-none truncate">
                  {shopName}
                </h1>
                <span
                  className={`inline-block w-2 h-2 rounded-full shrink-0 ${
                    shopStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                  title={shopStatus.isOpen ? 'Counter Open' : 'Counter Closed'}
                />
              </div>
              <p className="text-[11px] sm:text-xs text-stone-500 font-medium mt-0.5 truncate">
                Fresh Stone Ground Atta • Live Tracking
              </p>
            </div>
          </div>

          {/* Right: Quick Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
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
              className="p-2 sm:px-3 sm:py-2 text-stone-600 hover:text-stone-900 bg-stone-100 hover:bg-stone-200 rounded-xl transition cursor-pointer flex items-center gap-1.5 text-xs font-semibold shrink-0"
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
      <main className="flex-1 max-w-xl md:max-w-3xl lg:max-w-4xl xl:max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-7 space-y-5 sm:space-y-6">
        {/* Loading Indicator */}
        {loading && (
          <div className="p-10 text-center bg-white rounded-3xl border border-stone-200/80 shadow-2xs space-y-3">
            <Loader2 className="w-7 h-7 animate-spin text-amber-600 mx-auto" />
            <p className="text-xs font-semibold text-stone-500">Connecting to live chakki updates...</p>
          </div>
        )}

        {/* Hidden File Input for QR Image Upload */}
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          className="hidden"
          onChange={handleImageUpload}
        />

        {/* 1. At-A-Glance Dashboard Stat Cards (Unified White Surface, Matching Stone Borders, Cohesive Typography) */}
        <section
          className={`grid grid-cols-2 ${
            hasPhoneNumber ? 'sm:grid-cols-3' : 'sm:grid-cols-2'
          } gap-2.5 sm:gap-4`}
        >
          {/* Card 1: Chakki Status */}
          <div className="col-span-2 sm:col-span-1 bg-white rounded-2xl p-3.5 sm:p-5 border border-stone-200/80 shadow-2xs space-y-2 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    shopStatus.isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                  }`}
                />
                <span>Chakki Status</span>
              </span>

              <span
                className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                  shopStatus.isOpen
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-amber-50 text-amber-800 border border-amber-200'
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
                  <span className="text-xl sm:text-2xl font-bold text-stone-900 block leading-tight">
                    Milling Active
                  </span>
                  <p className="text-xs text-stone-500 font-normal mt-1">
                    Today: {shopStatus.formattedHours}
                  </p>
                </div>
              ) : (
                <div>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-xl sm:text-2xl font-bold font-mono text-stone-900 tracking-tight">
                      {countdown.formattedString}
                    </span>
                    <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                      until open
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 font-normal mt-1 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Reopens {shopStatus.formattedNextOpen}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Milling Rate */}
          <div className="col-span-1 bg-white rounded-2xl p-3.5 sm:p-5 border border-stone-200/80 shadow-2xs space-y-2 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5">
                <Wheat className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Milling Rate</span>
              </span>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-stone-100 text-stone-600 border border-stone-200">
                Stone Ground
              </span>
            </div>
            <div>
              <div className="flex items-baseline gap-1 pt-0.5">
                <span className="text-xl sm:text-2xl font-bold text-stone-900 leading-none">
                  {currency} {displayRate}
                </span>
                <span className="text-xs text-stone-500 font-semibold">/ kg</span>
              </div>
              <p className="text-xs text-stone-500 font-normal mt-1 truncate">
                100% whole wheat cold-milled
              </p>
            </div>
          </div>

          {/* Card 3: Counter Phone Contact */}
          {hasPhoneNumber && (
            <div className="col-span-1 bg-white rounded-2xl p-3.5 sm:p-5 border border-stone-200/80 shadow-2xs space-y-2 flex flex-col justify-between hover:border-amber-300 transition group">
              <div className="flex items-center justify-between gap-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-stone-500 flex items-center gap-1.5 truncate">
                  <Phone className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>Helpline</span>
                </span>
                <span className="text-[10px] font-bold uppercase bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full shrink-0">
                  Direct Call
                </span>
              </div>

              <div>
                <div className="pt-0.5">
                  <a
                    href={`tel:${settings?.phone_number}`}
                    className="inline-flex items-center gap-1.5 text-sm xs:text-base sm:text-lg font-bold text-stone-900 group-hover:text-amber-700 transition tracking-tight truncate w-full"
                  >
                    <PhoneCall className="w-3.5 h-3.5 text-amber-600 shrink-0 group-hover:scale-110 transition" />
                    <span className="truncate">{formatPhoneNumber(settings?.phone_number)}</span>
                  </a>
                </div>
                <p className="text-xs text-stone-500 font-normal mt-1 truncate">
                  Tap for instant counter call
                </p>
              </div>
            </div>
          )}
        </section>

        {/* 2. Main Content Area: Active Orders Feed OR Tracking Console */}
        {hasActiveOrders ? (
          <div className="space-y-4">
            {/* Header info & Add Bag trigger */}
            <div className="flex items-center justify-between pb-0.5">
              <div className="flex items-center gap-2">
                <Wheat className="w-4 h-4 text-amber-600" />
                <h2 className="text-base sm:text-lg font-bold text-stone-900 tracking-tight">
                  Your Active Order{activeOrders.length > 1 ? 's' : ''} ({activeOrders.length})
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setIsAddBagModalOpen(true)}
                className="inline-flex items-center gap-1.5 py-1.5 sm:py-2 px-3.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-semibold text-xs shadow-xs transition active:scale-98 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Bag</span>
              </button>
            </div>

            {/* Active Order Card(s) with Settings passed */}
            <div className="space-y-4">
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
          </div>
        ) : (
          !loading && (
            /* Order Tracking Console - Shown ONLY when no active orders are tracked */
            <section className="bg-white rounded-3xl p-5 sm:p-6 border border-stone-200/80 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 pb-3 border-b border-stone-100">
                <div>
                  <h2 className="text-base sm:text-lg font-black text-stone-900 tracking-tight flex items-center gap-2">
                    <Wheat className="w-4 h-4 text-amber-600" />
                    Track Your Grinding Order
                  </h2>
                  <p className="text-xs text-stone-500 font-medium mt-0.5">
                    Scan your counter slip QR, upload a photo of your receipt, or enter your 4-digit PIN.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
                {/* 1. Camera Scan */}
                <div className="md:col-span-4">
                  <button
                    type="button"
                    onClick={() => setIsScanModalOpen(true)}
                    className="w-full p-3.5 rounded-2xl bg-amber-500 hover:bg-amber-600 active:scale-[0.99] text-white transition shadow-sm hover:shadow-md shadow-amber-500/20 flex items-center gap-3 text-left font-bold cursor-pointer group"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white/20 text-white flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-2xs">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="block text-xs sm:text-sm font-extrabold text-white leading-tight">
                        Scan Slip QR
                      </span>
                      <span className="block text-[11px] font-medium text-amber-100 mt-0.5">
                        Open camera scanner
                      </span>
                    </div>
                  </button>
                </div>

                {/* 2. Upload QR Photo */}
                <div className="md:col-span-4">
                  <button
                    type="button"
                    disabled={uploadLoading}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-3.5 rounded-2xl bg-amber-50/80 hover:bg-amber-100/90 active:scale-[0.99] border border-amber-200/80 text-amber-950 transition shadow-2xs flex items-center gap-3 text-left font-bold cursor-pointer group disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 text-amber-800 flex items-center justify-center shrink-0 group-hover:scale-105 transition shadow-2xs">
                      {uploadLoading ? (
                        <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
                      ) : (
                        <Upload className="w-5 h-5 text-amber-700" />
                      )}
                    </div>
                    <div>
                      <span className="block text-xs sm:text-sm font-extrabold text-stone-900 leading-tight">
                        {uploadLoading ? 'Reading QR...' : 'Upload QR Photo'}
                      </span>
                      <span className="block text-[11px] font-medium text-stone-500 mt-0.5">
                        Select slip from gallery
                      </span>
                    </div>
                  </button>
                </div>

                {/* 3. Inline 4-Digit PIN Input Form */}
                <div className="md:col-span-4">
                  <form
                    onSubmit={handleInlinePinLookup}
                    className="flex items-center gap-2 p-1.5 rounded-2xl bg-stone-50 border border-stone-200/80 focus-within:border-amber-400 focus-within:bg-white transition"
                  >
                    <div className="relative flex-1 pl-2">
                      <input
                        type="text"
                        maxLength={4}
                        value={inlinePin}
                        onChange={(e) => {
                          setInlinePin(e.target.value.replace(/[^0-9]/g, ''));
                          setInlineError(null);
                          setActionError(null);
                        }}
                        placeholder="PIN: 9457"
                        className="w-full py-2 bg-transparent text-stone-900 placeholder:text-stone-400 font-mono font-bold text-xs sm:text-sm tracking-widest focus:outline-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={inlinePin.length !== 4 || inlineLoading}
                      className="py-2.5 px-3.5 rounded-xl font-bold text-xs text-amber-950 bg-amber-100 hover:bg-amber-200/80 active:scale-95 transition border border-amber-200/80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1 shrink-0 shadow-2xs"
                    >
                      {inlineLoading ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-800" />
                      ) : (
                        <>
                          <span>Track</span>
                          <ChevronRight className="w-3.5 h-3.5 text-amber-700" />
                        </>
                      )}
                    </button>
                  </form>
                </div>
              </div>

              {/* Error Message Feedback */}
              {(inlineError || actionError) && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-800 border border-rose-200 rounded-xl text-xs font-semibold">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{inlineError || actionError}</span>
                </div>
              )}
            </section>
          )
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
