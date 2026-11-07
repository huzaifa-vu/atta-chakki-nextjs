'use client';

import { Order, ShopSettings } from '@/types/database';
import { formatPrice, formatWeight, formatDate } from '@/lib/utils';
import { useShopOperatingStatus, useShopCountdown } from '@/lib/utils/shopHours';
import OrderStepper from './OrderStepper';
import { QRCodeSVG } from 'qrcode.react';
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
} from 'lucide-react';
import { motion } from 'framer-motion';

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

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className={`relative overflow-hidden rounded-3xl bg-white border transition-all duration-300 ${
        isReady
          ? showClosedState
            ? 'border-indigo-300 ring-2 ring-indigo-100 shadow-xl shadow-indigo-500/10'
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
          {showClosedState ? (
            /* Night / Shop Closed Header - Bright & Light */
            <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50 px-5 sm:px-6 py-3.5 text-stone-900 flex items-center justify-between border-b border-amber-200/80 shadow-2xs">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center">
                  <Moon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs sm:text-sm font-black tracking-tight text-stone-900">
                  Flour Ready & Stored Safely
                </span>
              </div>
              <span className="text-[11px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-2.5 py-0.5 rounded-full">
                Counter Closed
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
        {/* Closed Night Alert: Countdown Timer & Opening Notice */}
        {showClosedState && (
          <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-950 text-xs font-bold">
                <Clock className="w-4 h-4 text-amber-600" />
                <span>Chakki Counter Opens In</span>
              </div>
              <span className="text-[11px] font-semibold text-amber-900">
                {shopStatus.formattedNextOpen}
              </span>
            </div>

            {/* Countdown Digits */}
            <div className="text-center py-2 bg-white rounded-xl border border-amber-200/70 shadow-2xs">
              <span className="font-mono text-2xl sm:text-3xl font-black text-amber-950 tracking-wider">
                {countdown.formattedString}
              </span>
            </div>

            <p className="text-[11px] text-stone-600 leading-relaxed text-center">
              Your wheat has been freshly stone-milled and packed in a sealed bag. Please visit the counter when doors open to collect it.
            </p>
          </div>
        )}

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
              className={`p-4 sm:p-5 rounded-2xl text-center flex flex-col items-center justify-center space-y-3 border ${
                showClosedState
                  ? 'bg-slate-50/80 border-indigo-200'
                  : 'bg-emerald-50/70 border-emerald-300/80'
              }`}
            >
              <div className="p-3 bg-white rounded-2xl shadow-sm border border-stone-200">
                <QRCodeSVG
                  value={trackingUrl}
                  size={140}
                  level="M"
                  includeMargin={false}
                />
              </div>

              <div>
                <span
                  className={`text-xs font-black flex items-center justify-center gap-1.5 ${
                    showClosedState ? 'text-indigo-950' : 'text-emerald-950'
                  }`}
                >
                  <QrCode className="w-4 h-4" />
                  Pickup QR Code
                </span>
                <p
                  className={`text-[11px] font-medium mt-0.5 ${
                    showClosedState ? 'text-indigo-800' : 'text-emerald-800'
                  }`}
                >
                  {showClosedState
                    ? `Keep this QR ready for pickup when counter opens`
                    : 'Show this QR at the counter to collect your flour'}
                </p>
              </div>
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
      </div>
    </motion.div>
  );
}
