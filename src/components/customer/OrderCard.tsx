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
  const [isSharing, setIsSharing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [feedbackToast, setFeedbackToast] = useState<string | null>(null);

  const isReady = order.status === 'ready';
  const isGrinding = order.status === 'grinding';
  const isQueued = order.status === 'queued';
  const isCompleted = order.status === 'completed';

  const shopStatus = useShopOperatingStatus(settings);
  const countdown = useShopCountdown(shopStatus.nextOpenDate);

  const isShopOpen = shopStatus.isOpen;
  const showClosedState = isReady && !isShopOpen;
  // During image export / share, always present a clean, unblurred, scannable QR ticket
  const effectiveClosedState = showClosedState && !isCapturing;

  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const trackingUrl = `${origin}/?track=${order.id}`;

  const showLocalFeedback = (msg: string) => {
    setFeedbackToast(msg);
    setTimeout(() => setFeedbackToast(null), 3500);
  };

  const generateCardBlob = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;

    // Temporarily switch off blur, lock medallion, and timer for clean image export
    setIsCapturing(true);
    await new Promise((resolve) => setTimeout(resolve, 80));

    const options = {
      quality: 0.95,
      pixelRatio: 2,
      backgroundColor: '#ffffff',
      skipFonts: true,
      cacheBust: true,
      filter: (node: HTMLElement) => {
        if (node.getAttribute && node.getAttribute('data-no-capture') === 'true') {
          return false;
        }
        return true;
      },
    };

    let resultBlob: Blob | null = null;
    try {
      try {
        resultBlob = await toBlob(cardRef.current, options);
      } catch (err) {
        console.warn('html-to-image toBlob issue, attempting toPng fallback:', err);
      }

      if (!resultBlob) {
        const dataUrl = await toPng(cardRef.current, options);
        const res = await fetch(dataUrl);
        resultBlob = await res.blob();
      }
    } catch (fallbackErr) {
      console.error('All image capture methods failed:', fallbackErr);
    } finally {
      setIsCapturing(false);
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
    <motion.div
      ref={cardRef}
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-3xl bg-white border transition-all duration-300 ${
        isReady
          ? effectiveClosedState
            ? 'border-amber-200/90 ring-2 ring-amber-100/60 shadow-lg shadow-amber-500/5'
            : 'border-emerald-400 ring-4 ring-emerald-100 shadow-xl shadow-emerald-500/10'
          : isGrinding
          ? 'border-amber-300 ring-2 ring-amber-100 shadow-md shadow-amber-500/5'
          : isCompleted
          ? 'border-stone-200 bg-stone-50/50 opacity-90'
          : 'border-amber-200/90 shadow-md shadow-amber-500/5'
      }`}
    >
      {/* 1. Header Banner for Ready State */}
      {isReady && (
        <>
          {effectiveClosedState ? (
            /* Night / Break Closed Header - Bright & Light */
            <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50 px-5 sm:px-6 py-3.5 text-stone-900 flex items-center justify-between border-b border-amber-200/80 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  {shopStatus.isBreakActive ? (
                    <Coffee className="w-3.5 h-3.5" />
                  ) : (
                    <Moon className="w-3.5 h-3.5" />
                  )}
                </div>
                <span className="text-xs sm:text-sm font-black tracking-tight text-stone-900">
                  {shopStatus.isBreakActive
                    ? `Flour Ready • ${shopStatus.breakLabel || 'Break'}`
                    : 'Flour Ready & Stored Safely'}
                </span>
              </div>
              <span className="text-[11px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2.5 py-0.5 rounded-full">
                {shopStatus.isBreakActive ? 'Break Time' : 'Counter Closed'}
              </span>
            </div>
          ) : (
            /* Open / Immediate Pickup Header */
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-5 sm:px-6 py-3.5 text-white flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 shrink-0 animate-spin" style={{ animationDuration: '3s' }} />
                <span className="text-xs sm:text-sm font-extrabold tracking-wide">
                  Flour Ready for Collection!
                </span>
              </div>
              <span className="text-xs bg-white text-emerald-800 font-extrabold px-3 py-1 rounded-full shadow-2xs">
                Counter Ready
              </span>
            </div>
          )}
        </>
      )}

      <div className="p-5 sm:p-7 space-y-4">
        {/* Customer Info & PIN Row */}
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {totalActiveCount > 1 && bagIndex !== undefined && (
                <span className="text-xs font-black uppercase text-amber-900 bg-amber-100 px-2.5 py-0.5 rounded-lg border border-amber-300 flex items-center gap-1">
                  <Wheat className="w-3.5 h-3.5 text-amber-700" />
                  Bag {bagIndex + 1}
                </span>
              )}

              {order.is_paid ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Paid
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200">
                  <Clock className="w-3.5 h-3.5 text-amber-600" /> Pay on Pickup
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-black text-stone-900 tracking-tight pt-0.5">
              {order.customer_name ? order.customer_name : 'Whole Wheat Flour'}
            </h3>
            <p suppressHydrationWarning className="text-xs text-stone-500 font-medium">
              Received at {formatDate(order.created_at)}
            </p>
          </div>

          {/* 4-digit PIN badge */}
          {!isCompleted && order.access_code && (
            <div className="bg-stone-900 text-white rounded-2xl px-3.5 py-2 text-center shadow-md shrink-0">
              <span className="block text-[9px] font-bold text-amber-300 uppercase tracking-widest">
                PIN
              </span>
              <span className="block text-xl sm:text-2xl font-mono font-black tracking-widest text-white leading-tight">
                {order.access_code}
              </span>
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
            <div
              className={`p-4 sm:p-5 rounded-2xl text-center flex flex-col items-center justify-center space-y-3.5 border ${
                effectiveClosedState
                  ? 'bg-amber-50/40 border-amber-200/70'
                  : 'bg-emerald-50/70 border-emerald-300/80'
              }`}
            >
              {/* QR Code Container */}
              <div className="relative p-3.5 bg-white rounded-2xl shadow-sm border border-stone-200 flex items-center justify-center">
                <div
                  className={
                    effectiveClosedState
                      ? 'filter blur-[1.5px] opacity-60 select-none pointer-events-none transition-all'
                      : 'transition-all'
                  }
                >
                  <QRCodeSVG
                    value={trackingUrl}
                    size={152}
                    level="M"
                    includeMargin={false}
                  />
                </div>

                {/* Prominent Center Lock Medallion on QR when store is closed (omitted in exported image) */}
                {effectiveClosedState && (
                  <div
                    data-no-capture="true"
                    className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white shadow-md border-2 border-white flex items-center justify-center">
                      <Lock className="w-6 h-6" />
                    </div>
                  </div>
                )}
              </div>

              {/* QR Status Label */}
              <div>
                <span
                  className={`text-xs font-black flex items-center justify-center gap-1.5 ${
                    effectiveClosedState ? 'text-amber-950' : 'text-emerald-950'
                  }`}
                >
                  {effectiveClosedState ? (
                    <Lock className="w-4 h-4 text-amber-700" />
                  ) : (
                    <QrCode className="w-4 h-4 text-emerald-700" />
                  )}
                  Pickup QR Code {effectiveClosedState && '(Locked)'}
                </span>
                <p
                  className={`text-[11px] font-medium mt-0.5 ${
                    effectiveClosedState ? 'text-stone-600' : 'text-emerald-800'
                  }`}
                >
                  {effectiveClosedState
                    ? 'Chakki is currently closed • QR unlocks when doors open'
                    : 'Show this QR at the counter to collect your flour'}
                </p>
              </div>

              {/* Wide Horizontal Countdown Timer Bar (Omitted from exported image) */}
              {effectiveClosedState && (
                <div
                  data-no-capture="true"
                  className="w-full bg-white rounded-xl p-3 sm:p-3.5 border border-amber-200/90 shadow-2xs flex items-center justify-between gap-3 text-left"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                      <Clock className="w-4 h-4 text-amber-700" />
                    </div>
                    <div className="min-w-0">
                      <span className="block text-[10px] font-black uppercase tracking-wider text-amber-900 leading-none truncate">
                        {shopStatus.isBreakActive ? 'Break Ends In' : 'Counter Opens In'}
                      </span>
                      <span className="block text-[11px] font-semibold text-stone-600 mt-1 leading-none truncate">
                        Opens {shopStatus.formattedNextOpen}
                      </span>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="font-mono text-sm sm:text-base font-black text-amber-950 tracking-wider">
                      {countdown.formattedString}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Price & Summary Details Card */}
            <div className="grid grid-cols-3 gap-2 bg-stone-50 rounded-2xl p-3 border border-stone-200/80 text-center">
              <div>
                <span className="block text-[11px] font-medium text-stone-500">Weight</span>
                <span className="block text-sm sm:text-base font-black text-stone-900 mt-0.5">
                  {formatWeight(order.weight_kg)}
                </span>
              </div>
              <div className="border-x border-stone-200">
                <span className="block text-[11px] font-medium text-stone-500">Rate</span>
                <span className="block text-sm sm:text-base font-bold text-stone-900 mt-0.5">
                  {currency} {Number(order.rate_per_kg).toFixed(0)}/kg
                </span>
              </div>
              <div>
                <span className="block text-[11px] font-medium text-stone-500">Total</span>
                <span className="block text-sm sm:text-base font-black text-amber-600 mt-0.5">
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
                  className={`w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition shadow-xs active:scale-98 cursor-pointer disabled:opacity-60 text-white ${
                    showClosedState
                      ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                  }`}
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
                  className="w-full py-3 px-4 rounded-xl bg-stone-100 hover:bg-stone-200 active:scale-98 text-stone-800 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition border border-stone-200/90 cursor-pointer disabled:opacity-60"
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

        {/* Optional Helpline Button if Counter Phone is Configured */}
        {settings?.phone_number && (
          <div className="pt-2 text-center border-t border-stone-100">
            <a
              href={`tel:${settings.phone_number}`}
              className="inline-flex items-center gap-1.5 text-[11px] font-bold text-stone-600 hover:text-amber-700 transition"
            >
              <Phone className="w-3 h-3 text-amber-600" />
              <span>Questions? Call Counter {formatPhoneNumber(settings.phone_number)}</span>
            </a>
          </div>
        )}

        {/* Official Slip Authenticity Watermark / Footer */}
        {isReady && (
          <div className="pt-2 text-center border-t border-stone-100 flex items-center justify-between text-[10px] text-stone-400 font-medium">
            <span className="flex items-center gap-1">
              <Wheat className="w-3 h-3 text-amber-500" />
              {settings?.shop_name || 'Chakki Fresh'} Collection Slip
            </span>
            <span className="font-mono text-stone-500 font-bold">PIN: {order.access_code}</span>
          </div>
        )}
      </div>
    </motion.div>
  );
}
