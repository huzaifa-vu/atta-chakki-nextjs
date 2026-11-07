'use client';

import { Order } from '@/types/database';
import { formatPrice, formatWeight, formatDate } from '@/lib/utils';
import OrderStepper from './OrderStepper';
import { QRCodeSVG } from 'qrcode.react';
import {
  Sparkles,
  Trash2,
  CheckCircle2,
  Clock,
  Wheat,
  Scale,
  Receipt,
  QrCode,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface OrderCardProps {
  order: Order;
  currency?: string;
  bagIndex?: number;
  totalActiveCount?: number;
  onRemove?: (id: string) => void;
}

export default function OrderCard({
  order,
  currency = 'Rs.',
  bagIndex,
  totalActiveCount = 1,
  onRemove,
}: OrderCardProps) {
  const isReady = order.status === 'ready';
  const isGrinding = order.status === 'grinding';
  const isQueued = order.status === 'queued';
  const isCompleted = order.status === 'completed';

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
          ? 'border-emerald-400 ring-4 ring-emerald-100 shadow-xl shadow-emerald-500/10'
          : isGrinding
          ? 'border-amber-300 ring-2 ring-amber-100 shadow-md shadow-amber-500/5'
          : isCompleted
          ? 'border-stone-200 bg-stone-50/50 opacity-90'
          : 'border-amber-200/90 shadow-md shadow-amber-500/5'
      }`}
    >
      {/* Ready Alert Header */}
      {isReady && (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-white flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 animate-spin" style={{ animationDuration: '3s' }} />
            <span className="text-sm font-black tracking-wide">
              Flour Ready for Collection!
            </span>
          </div>
          <span className="text-xs bg-white text-emerald-800 font-extrabold px-3 py-1 rounded-full shadow-2xs">
            Ready
          </span>
        </div>
      )}

      <div className="p-5 sm:p-7 space-y-5">
        {/* Top Info Header */}
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
            <div className="bg-stone-900 text-white rounded-2xl px-3.5 py-2.5 text-center shadow-md shrink-0">
              <span className="block text-[10px] font-bold text-amber-300 uppercase tracking-widest">
                PIN
              </span>
              <span className="block text-xl sm:text-2xl font-mono font-black tracking-widest text-white">
                {order.access_code}
              </span>
            </div>
          )}

          {isCompleted && onRemove && (
            <button
              onClick={() => onRemove(order.id)}
              className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition"
              title="Remove from history"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Stepper Progress */}
        <div className="pt-1 pb-1">
          <OrderStepper status={order.status} />
        </div>

        {/* Pickup QR & Order Summary Grid */}
        {isReady ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-stretch">
            {/* Pickup QR Code Block */}
            <div className="p-5 bg-emerald-50/70 border-2 border-emerald-300/80 rounded-2xl text-center flex flex-col items-center justify-center space-y-3">
              <div className="inline-block p-3 bg-white rounded-2xl shadow-sm border border-emerald-200">
                <QRCodeSVG
                  value={trackingUrl}
                  size={145}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <div>
                <span className="block text-xs font-extrabold text-emerald-950 flex items-center justify-center gap-1.5">
                  <QrCode className="w-4 h-4 text-emerald-600" />
                  Pickup QR Code
                </span>
                <p className="text-[11px] text-emerald-800 font-medium mt-0.5">
                  Show this QR at the counter to collect your flour
                </p>
              </div>
            </div>

            {/* Price & Summary Details Card on Desktop */}
            <div className="flex flex-col justify-between gap-3 bg-stone-50 rounded-2xl p-5 border border-stone-200/80">
              <div className="space-y-3">
                <span className="text-[11px] font-black uppercase tracking-wider text-stone-500 block">
                  Order Details
                </span>

                <div className="flex items-center justify-between text-sm py-1.5 border-b border-stone-200/60">
                  <span className="text-stone-600 font-medium">Wheat Weight</span>
                  <span className="font-black text-stone-900">{formatWeight(order.weight_kg)}</span>
                </div>

                <div className="flex items-center justify-between text-sm py-1.5 border-b border-stone-200/60">
                  <span className="text-stone-600 font-medium">Grinding Rate</span>
                  <span className="font-bold text-stone-900">{currency} {Number(order.rate_per_kg).toFixed(0)}/kg</span>
                </div>

                <div className="flex items-center justify-between text-sm py-1.5 border-b border-stone-200/60">
                  <span className="text-stone-600 font-medium">Payment</span>
                  <span className={`font-extrabold ${order.is_paid ? 'text-emerald-700' : 'text-amber-800'}`}>
                    {order.is_paid ? 'Paid' : 'Pay on Pickup'}
                  </span>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between border-t border-stone-200">
                <span className="text-xs font-bold text-stone-600">Total Amount</span>
                <span className="text-xl sm:text-2xl font-black text-amber-600">
                  {formatPrice(order.total_price, currency)}
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* Clean Weight & Price Metric Chips for non-ready states */
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
