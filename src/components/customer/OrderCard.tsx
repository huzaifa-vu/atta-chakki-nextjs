'use client';

import { useState, useRef } from 'react';
import { Order, ShopSettings } from '@/types/database';
import { formatPrice, formatWeight, formatDate, formatPhoneNumber } from '@/lib/utils';
import { useShopOperatingStatus, useShopCountdown, formatTime12Hour } from '@/lib/utils/shopHours';
import OrderStepper from './OrderStepper';
import { QRCodeSVG } from 'qrcode.react';
import { toBlob, toPng } from 'html-to-image';
import {
  Sparkles,
  Trash2,
  CheckCircle2,
  Clock,
  Wheat,
  QrCode,
  Moon,
  ShieldCheck,
  Sun,
  Coffee,
  Phone,
  Share2,
  Download,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  Copy,
  Check,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OrderCardProps {
  order: Order;
  settings?: ShopSettings | null;
  currency?: string;
  bagIndex?: number;
  totalActiveCount?: number;
  onRemove?: (id: string) => void;
}

export default function OrderCard({
  order,
  settings,
  currency = 'Rs.',
  bagIndex,
  totalActiveCount = 1,
  onRemove,
}: OrderCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const exportSlipRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);
  const [copiedPin, setCopiedPin] = useState(false);
  const [showPin, setShowPin] = useState(false);

  const handleCopyPin = () => {
    if (!order.access_code) return;
    navigator.clipboard.writeText(order.access_code);
    setCopiedPin(true);
    showLocalFeedback(`✓ PIN ${order.access_code} copied to clipboard!`);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  const isReady = order.status === 'ready';
  const isGrinding = order.status === 'grinding';
  const isQueued = order.status === 'queued';
  const isCompleted = order.status === 'completed';

  const shopStatus = useShopOperatingStatus(settings);
  const countdown = useShopCountdown(shopStatus.nextOpenDate);

  const isShopOpen = shopStatus.isOpen;
  const showClosedState = isReady && !isShopOpen;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const trackingUrl = `${origin}/?track=${order.id}`;

  const showLocalFeedback = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  // Dedicated clean export using off-screen unblurred slip template
  const generateCardBlob = async (): Promise<Blob | null> => {
    const targetElement = exportSlipRef.current || cardRef.current;
    if (!targetElement) return null;

    const options = {
      quality: 0.98,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      skipFonts: true,
      cacheBust: true,
    };

    let resultBlob: Blob | null = null;
    try {
      try {
        resultBlob = await toBlob(targetElement, options);
      } catch (err) {
        console.warn('html-to-image toBlob issue, attempting toPng fallback:', err);
      }

      if (!resultBlob) {
        const dataUrl = await toPng(targetElement, options);
        const res = await fetch(dataUrl);
        resultBlob = await res.blob();
      }
    } catch (fallbackErr) {
      console.error('All image capture methods failed:', fallbackErr);
    }

    return resultBlob;
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  const handleShareCard = async () => {
    if (!cardRef.current || isSharing || isSaving) return;
    setIsSharing(true);

    const bagLabel = totalActiveCount > 1 && bagIndex !== undefined ? `-Bag-${bagIndex + 1}` : '';
    const fileName = `${settings?.shop_name || 'Chakki'}-Pickup-PIN-${order.access_code || 'order'}${bagLabel}.png`.replace(/\s+/g, '-');

    try {
      const blob = await generateCardBlob();
      if (!blob) throw new Error('Could not render image');

      const file = new File([blob], fileName, { type: 'image/png' });
      const shopTitle = settings?.shop_name || 'Chakki Fresh';
      const shareTitle = `${shopTitle} - Flour Pickup Slip (PIN #${order.access_code})`;
      const shareText = `🌾 Flour Pickup Slip - ${shopTitle}\n` +
        `• Customer: ${order.customer_name || 'Whole Wheat Flour'}\n` +
        `• 4-Digit PIN: ${order.access_code}\n` +
        `• Weight: ${formatWeight(order.weight_kg)}\n` +
        `• Amount: ${order.is_paid ? 'Paid' : `Pay on Pickup (${formatPrice(order.total_price, currency)})`}\n\n` +
        `Show this slip or QR code at the counter to collect the flour bag.`;

      if (
        typeof navigator !== 'undefined' &&
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [file] })
      ) {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          files: [file],
        });
        showLocalFeedback('Pickup slip shared successfully!');
        return;
      }

      // Fallback for desktop or non-file share: download image + copy text
      downloadBlob(blob, fileName);
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(`${shareText}\n\nLive Link: ${trackingUrl}`);
          showLocalFeedback('Slip image saved & details copied to clipboard!');
          return;
        } catch {
          // ignore clipboard error
        }
      }
      showLocalFeedback('Pickup slip image saved to device!');
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      console.error('Share slip failed:', err);
      try {
        const blob = await generateCardBlob();
        if (blob) {
          downloadBlob(blob, fileName);
          showLocalFeedback('Slip image saved to device!');
        }
      } catch {
        showLocalFeedback('Could not save image. You can take a screenshot.');
      }
    } finally {
      setIsSharing(false);
    }
  };

  const handleSaveCard = async () => {
    if (!cardRef.current || isSharing || isSaving) return;
    setIsSaving(true);

    const bagLabel = totalActiveCount > 1 && bagIndex !== undefined ? `-Bag-${bagIndex + 1}` : '';
    const fileName = `${settings?.shop_name || 'Chakki'}-Pickup-PIN-${order.access_code || 'order'}${bagLabel}.png`.replace(/\s+/g, '-');

    try {
      const blob = await generateCardBlob();
      if (!blob) throw new Error('Could not render image');
      downloadBlob(blob, fileName);
      showLocalFeedback('Pickup card image saved to your device!');
    } catch (err) {
      console.error('Save card failed:', err);
      showLocalFeedback('Could not save image. You can take a screenshot.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <motion.div
        ref={cardRef}
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="relative overflow-hidden rounded-3xl bg-white border border-stone-200/90 shadow-2xs transition-all duration-300"
    >
      {/* 1. Header Banner for Ready State */}
      {isReady && (
        <>
          {/* Night / Break Closed Header (Shown on screen when closed, omitted in capture) */}
          {showClosedState && (
            <div
              data-no-capture="true"
              className="bg-stone-50 border-b border-stone-200/70 px-5 sm:px-6 py-3 flex items-center justify-between"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-100/80 text-amber-800 flex items-center justify-center shrink-0">
                  {shopStatus.isBreakActive ? (
                    <Coffee className="w-3.5 h-3.5" />
                  ) : (
                    <Moon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="text-xs sm:text-sm font-bold text-stone-800">
                  {shopStatus.isBreakActive
                    ? `Flour Ready • ${shopStatus.breakLabel || 'Break'}`
                    : 'Flour Ready & Stored Safely'}
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full">
                {shopStatus.isBreakActive ? 'Break Time' : 'Counter Closed'}
              </span>
            </div>
          )}

          {/* Clean Ready Header (Always used in exported image or when counter is open) */}
          <div
            data-capture-header="true"
            className={`bg-emerald-50 border-b border-emerald-100 px-5 sm:px-6 py-3 items-center justify-between ${
              showClosedState ? 'hidden' : 'flex'
            }`}
          >
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs sm:text-sm font-bold text-emerald-950">
                Flour Ready for Collection!
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-white text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full shadow-2xs">
              Counter Ready
            </span>
          </div>
        </>
      )}

      <div className="p-5 sm:p-7 space-y-4">
        {/* Customer Info & PIN Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {totalActiveCount > 1 && bagIndex !== undefined && (
                <span className="text-xs font-bold uppercase text-amber-900 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 flex items-center gap-1">
                  <Wheat className="w-3.5 h-3.5 text-amber-600" />
                  Bag {bagIndex + 1}
                </span>
              )}

              {order.is_paid ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Paid
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-lg border border-stone-200">
                  <Clock className="w-3.5 h-3.5 text-amber-600" /> Pay on Pickup
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-stone-900 tracking-tight pt-0.5">
              {order.customer_name ? order.customer_name : 'Whole Wheat Flour'}
            </h3>
            <p suppressHydrationWarning className="text-xs text-stone-500 font-normal">
              Received at {formatDate(order.created_at)}
            </p>
          </div>

          {/* 4-digit PIN badge - Small, sleek, blurred normally, click to copy when revealed */}
          {!isCompleted && order.access_code && (
            <div className="inline-flex items-center gap-1.5 bg-stone-100/90 hover:bg-stone-200/70 border border-stone-200/90 rounded-xl px-2.5 py-1 text-xs font-medium text-stone-700 shadow-2xs transition shrink-0 select-none">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-500">
                PIN
              </span>
              <span
                data-pin-digits="true"
                onClick={() => {
                  if (showPin) {
                    handleCopyPin();
                  } else {
                    setShowPin(true);
                  }
                }}
                className={`font-mono font-bold text-xs sm:text-sm tracking-wider transition-all duration-150 ${
                  showPin
                    ? 'filter-none text-stone-900 cursor-pointer hover:text-amber-700 active:scale-95'
                    : 'filter blur-[4px] text-stone-400 cursor-pointer'
                }`}
                title={showPin ? 'Click to copy PIN' : 'Click to reveal PIN'}
              >
                {copiedPin && showPin ? '✓ Copied!' : order.access_code}
              </span>
              <button
                type="button"
                data-no-capture="true"
                onClick={() => setShowPin(!showPin)}
                className="p-0.5 rounded text-stone-400 hover:text-stone-700 transition cursor-pointer active:scale-90"
                title={showPin ? 'Hide PIN' : 'Reveal PIN'}
                aria-label={showPin ? 'Hide PIN' : 'Reveal PIN'}
              >
                {showPin ? (
                  <EyeOff className="w-3.5 h-3.5 text-amber-600" />
                ) : (
                  <Eye className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}

          {isCompleted && onRemove && (
            <button
              data-no-capture="true"
              onClick={() => onRemove(order.id)}
              className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
              title="Remove from history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Stepper Progress (compact when ready to avoid double cards) */}
        <div className="pt-0.5 pb-0.5">
          <OrderStepper status={order.status} compact={isReady} />
        </div>

        {/* Pickup QR & Order Summary Grid */}
        {isReady ? (
          <div className="space-y-3.5">
            {/* Unified Clean Pickup Ticket Card */}
            <div className="p-4 sm:p-5 rounded-2xl text-center flex flex-col items-center justify-center space-y-3 bg-stone-50/80 border border-stone-200/80">
              {/* QR Code Container */}
              <div className="relative p-3 bg-white rounded-2xl shadow-xs border border-stone-200/80 flex items-center justify-center">
                <div
                  data-qr-wrapper="true"
                  className={
                    showClosedState
                      ? 'filter blur-[1.5px] opacity-60 select-none pointer-events-none'
                      : ''
                  }
                >
                  <QRCodeSVG
                    value={trackingUrl}
                    size={148}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                {/* Prominent Center Lock Medallion on QR when store is closed (omitted in exported image) */}
                {showClosedState && (
                  <div
                    data-no-capture="true"
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <div className="w-11 h-11 rounded-xl bg-amber-500 text-white shadow-sm border-2 border-white flex items-center justify-center">
                      <Lock className="w-5 h-5" />
                    </div>
                  </div>
                )}
              </div>

              {/* QR Status Label */}
              <div>
                {/* When store is closed on live screen */}
                {showClosedState && (
                  <div data-closed-label="true" data-no-capture="true">
                    <span className="text-xs font-bold text-stone-800 flex items-center justify-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-600" />
                      Pickup QR Code (Locked)
                    </span>
                    <p className="text-xs text-stone-500 font-normal mt-0.5">
                      QR unlocks automatically when chakki counter opens
                    </p>
                  </div>
                )}

                {/* Clean label for exported image OR when store is open */}
                <div
                  data-clean-label="true"
                  className={showClosedState ? 'hidden' : 'block'}
                >
                  <span className="text-xs font-bold text-stone-800 flex items-center justify-center gap-1.5">
                    <QrCode className="w-4 h-4 text-emerald-700" />
                    Pickup QR Code
                  </span>
                  <p className="text-xs text-stone-500 font-normal mt-0.5">
                    Show this QR at the counter to collect your flour
                  </p>
                </div>
              </div>

              {/* Wide Horizontal Countdown Timer Bar (Omitted from exported image) */}
              {showClosedState && (
                <div
                  data-no-capture="true"
                  className="w-full bg-white rounded-xl p-3 sm:p-3.5 border border-stone-200/80 shadow-2xs flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 border border-amber-200/80 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-amber-700" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-stone-500 leading-none truncate">
                        {shopStatus.isBreakActive ? 'Break Ends In' : 'Counter Opens In'}
                      </span>
                      <span className="block text-xs font-semibold text-stone-700 mt-1 leading-none truncate">
                        Opens {shopStatus.formattedNextOpen}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono text-sm sm:text-base font-bold text-stone-900 tracking-wider">
                      {countdown.compactString}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Price & Summary Details Card */}
            <div className="grid grid-cols-3 gap-2 bg-stone-50/80 rounded-2xl p-3 border border-stone-200/80 text-center">
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-stone-500">Weight</span>
                <span className="block text-sm sm:text-base font-bold text-stone-900 mt-0.5">
                  {formatWeight(order.weight_kg)}
                </span>
              </div>
              <div className="border-x border-stone-200">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-stone-500">Rate</span>
                <span className="block text-sm sm:text-base font-bold text-stone-900 mt-0.5">
                  {currency} {Number(order.rate_per_kg).toFixed(0)}/kg
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-bold uppercase tracking-wider text-stone-500">Total</span>
                <span className="block text-sm sm:text-base font-bold text-amber-600 mt-0.5">
                  {formatPrice(order.total_price, currency)}
                </span>
              </div>
            </div>

            {/* Save & Share Action Console (Excluded from captured image) */}
            <div data-no-capture="true" className="pt-1 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Primary: Share Slip Image */}
                <button
                  type="button"
                  onClick={handleShareCard}
                  disabled={isSharing || isSaving}
                  className="w-full py-2.5 sm:py-3 px-4 rounded-xl font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-xs active:scale-98 cursor-pointer disabled:opacity-60 text-white bg-amber-600 hover:bg-amber-700 shadow-amber-600/20"
                  title="Share pickup slip image with someone on WhatsApp or other apps"
                >
                  {isSharing ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Share2 className="w-4 h-4" />
                  )}
                  <span>{isSharing ? 'Generating Slip...' : 'Share Slip Image'}</span>
                </button>

                {/* Secondary: Save Card as Image */}
                <button
                  type="button"
                  onClick={handleSaveCard}
                  disabled={isSharing || isSaving}
                  className="w-full py-2.5 sm:py-3 px-4 rounded-xl bg-white hover:bg-stone-50 active:scale-98 text-stone-700 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 transition border border-stone-200 shadow-2xs cursor-pointer disabled:opacity-60"
                  title="Download card image to phone or computer gallery"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin text-stone-600" />
                  ) : (
                    <Download className="w-4 h-4 text-stone-600" />
                  )}
                  <span>{isSaving ? 'Saving...' : 'Save Card as Image'}</span>
                </button>
              </div>

              <p className="text-[11px] text-stone-500 text-center font-medium leading-relaxed">
                Sending someone else to collect? Tap <strong className="text-stone-700 font-bold">Share Slip Image</strong> to send this card on WhatsApp.
              </p>

              {/* In-Card Toast Feedback */}
              <AnimatePresence>
                {feedbackToast && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.96 }}
                    className="p-3 rounded-xl bg-stone-900 text-white text-xs font-bold text-center flex items-center justify-center gap-2 shadow-lg"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>{feedbackToast}</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        ) : (
          /* Metric Chips for non-ready states */
          <div className="grid grid-cols-3 gap-2 sm:gap-4 bg-stone-50 rounded-2xl p-3 sm:p-4 border border-stone-200/70 text-center">
            <div>
              <span className="block text-[11px] sm:text-xs font-semibold text-stone-500">Weight</span>
              <span className="block text-sm sm:text-lg font-black text-stone-900 mt-0.5">
                {formatWeight(order.weight_kg)}
              </span>
            </div>

            <div className="border-x border-stone-200">
              <span className="block text-[11px] sm:text-xs font-semibold text-stone-500">Rate</span>
              <span className="block text-sm sm:text-lg font-bold text-stone-900 mt-0.5">
                {currency} {Number(order.rate_per_kg).toFixed(0)}/kg
              </span>
            </div>

            <div>
              <span className="block text-[11px] sm:text-xs font-semibold text-stone-500">Total</span>
              <span className="block text-sm sm:text-lg font-black text-amber-600 mt-0.5">
                {formatPrice(order.total_price, currency)}
              </span>
            </div>
          </div>
        )}

        {/* Official Slip Authenticity Watermark / Footer */}
        {isReady && (
          <div className="pt-2 text-center border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400 font-medium">
            <span className="flex items-center gap-1">
              <Wheat className="w-3 h-3 text-amber-500" />
              {settings?.shop_name || 'Chakki Fresh'} Collection Slip
            </span>
            <span className="text-stone-400 font-medium">Ready for Counter Pickup</span>
          </div>
        )}
      </div>
    </motion.div>

    {/* Dedicated Off-Screen Pickup Slip Template for High-Res, 100% Unblurred Export */}
    <div
      style={{
        position: 'fixed',
        left: '-9999px',
        top: '-9999px',
        width: '400px',
        pointerEvents: 'none',
        zIndex: -1,
      }}
      aria-hidden="true"
    >
      <div
        ref={exportSlipRef}
        className="w-[400px] bg-white p-6 rounded-3xl border border-stone-200 text-stone-900 shadow-xl space-y-4 font-sans"
      >
        {/* Shop Branding Header */}
        <div className="flex items-center justify-between pb-3 border-b border-stone-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-sm shadow-amber-500/20">
              <Wheat className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-stone-900 leading-tight">
                {settings?.shop_name || 'Chakki Fresh'}
              </h3>
              <p className="text-[10px] text-stone-500 font-medium">Official Pickup Slip</p>
            </div>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200 px-2.5 py-0.5 rounded-full">
            Ready for Collection
          </span>
        </div>

        {/* Customer Name */}
        <div className="text-center pt-1">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-stone-400 block">
            Customer
          </span>
          <h4 className="text-lg font-black text-stone-900 mt-0.5">
            {order.customer_name || 'Customer Order'}
          </h4>
        </div>

        {/* Unblurred High-Contrast QR Code */}
        <div className="flex flex-col items-center justify-center p-4 bg-stone-50/80 rounded-2xl border border-stone-200/80 space-y-2">
          <div className="p-3 bg-white rounded-2xl shadow-xs border border-stone-200/80">
            <QRCodeSVG value={trackingUrl} size={160} level="M" includeMargin={false} />
          </div>
          <span className="text-xs font-bold text-stone-700">Scan at counter to collect</span>
        </div>

        {/* Unblurred, Crystal-Clear PIN Banner */}
        {order.access_code && (
          <div className="p-3.5 bg-amber-50/80 rounded-2xl border border-amber-200 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-800 block">
              4-Digit Collection PIN
            </span>
            <span className="text-3xl font-mono font-black text-stone-900 tracking-widest block mt-0.5">
              {order.access_code}
            </span>
          </div>
        )}

        {/* Order Metrics Strip */}
        <div className="grid grid-cols-3 gap-2 bg-stone-50/80 rounded-2xl p-3 border border-stone-100 text-center text-xs">
          <div>
            <span className="text-stone-400 text-[10px] block font-medium">Weight</span>
            <span className="font-bold text-stone-900 mt-0.5 block">{formatWeight(order.weight_kg)}</span>
          </div>
          <div className="border-x border-stone-200">
            <span className="text-stone-400 text-[10px] block font-medium">Rate</span>
            <span className="font-bold text-stone-900 mt-0.5 block">
              {currency} {Number(order.rate_per_kg).toFixed(0)}/kg
            </span>
          </div>
          <div>
            <span className="text-stone-400 text-[10px] block font-medium">Total</span>
            <span className="font-black text-amber-700 mt-0.5 block">
              {formatPrice(order.total_price, currency)}
            </span>
          </div>
        </div>

        {/* Footer Watermark */}
        <div className="pt-2 text-center text-[10px] text-stone-400 border-t border-stone-100 flex items-center justify-between">
          <span>{settings?.shop_name || 'Chakki Fresh'} • Live Tracking</span>
          <span>{settings?.phone_number ? `Helpline: ${settings.phone_number}` : 'Stone Ground Flour'}</span>
        </div>
      </div>
    </div>
  </>
);
}
