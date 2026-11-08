'use client';

import { useState } from 'react';
import { Order, OrderStatus } from '@/types/database';
import { formatPrice, formatWeight, formatDate } from '@/lib/utils';
import StatusBadge from './StatusBadge';
import {
  Flame,
  ShoppingBag,
  Check,
  QrCode,
  Trash2,
  CheckCircle2,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { motion } from 'framer-motion';

interface AdminOrderCardProps {
  order: Order;
  currency?: string;
  isSelected?: boolean;
  selectionDisabled?: boolean;
  onToggleSelect?: (orderId: string) => void;
  onUpdateStatus: (orderId: string, nextStatus: OrderStatus) => void;
  onTogglePayment: (orderId: string, currentPaid: boolean) => void;
  onViewSlip: (order: Order) => void;
  onDeleteOrder: (orderId: string) => void;
}

export default function AdminOrderCard({
  order,
  currency = 'Rs.',
  isSelected = false,
  selectionDisabled = false,
  onToggleSelect,
  onUpdateStatus,
  onTogglePayment,
  onViewSlip,
  onDeleteOrder,
}: AdminOrderCardProps) {
  const isQueued = order.status === 'queued';
  const isGrinding = order.status === 'grinding';
  const isReady = order.status === 'ready';
  const isCompleted = order.status === 'completed';
  const [copiedPin, setCopiedPin] = useState(false);

  const handleCopyPin = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!order.access_code) return;
    navigator.clipboard.writeText(order.access_code);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`rounded-2xl bg-white border p-4 sm:p-5 transition-all duration-200 ${
        isSelected
          ? 'border-amber-400 ring-2 ring-amber-500 bg-amber-50/20 shadow-md'
          : isReady
          ? 'border-emerald-300 ring-1 ring-emerald-100 bg-emerald-50/20 shadow-xs'
          : isGrinding
          ? 'border-blue-200 ring-1 ring-blue-50 bg-blue-50/10 shadow-xs'
          : isCompleted
          ? 'border-stone-200 bg-stone-50/40 opacity-80 shadow-xs'
          : 'border-stone-200 shadow-xs'
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100 min-w-0">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Multi-Select Checkbox */}
          {onToggleSelect && !isCompleted && (
            <button
              type="button"
              disabled={selectionDisabled}
              onClick={() => onToggleSelect(order.id)}
              className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition shrink-0 ${
                selectionDisabled
                  ? 'opacity-20 cursor-not-allowed bg-stone-100 border-stone-200 text-transparent'
                  : isSelected
                  ? 'bg-amber-600 border-amber-600 text-white shadow-xs cursor-pointer'
                  : 'bg-white border-stone-300 hover:border-amber-500 text-transparent cursor-pointer'
              }`}
              title={
                selectionDisabled
                  ? 'Can only select orders with the same status'
                  : isSelected
                  ? 'Deselect order'
                  : 'Select for batch action'
              }
            >
              <Check className="w-3.5 h-3.5 stroke-[3]" />
            </button>
          )}

          {/* 4-digit PIN Badge - Click to Copy */}
          <button
            type="button"
            onClick={handleCopyPin}
            className={`w-14 h-12 rounded-xl text-white flex flex-col items-center justify-center shadow-xs shrink-0 cursor-pointer active:scale-95 transition-all ${
              copiedPin ? 'bg-emerald-600 ring-2 ring-emerald-300' : 'bg-stone-900 hover:bg-stone-800'
            }`}
            title="Click to copy PIN"
          >
            <span className="text-[9px] font-bold text-amber-300 uppercase leading-none tracking-widest">
              {copiedPin ? 'COPIED' : 'PIN'}
            </span>
            <span className="text-base font-mono font-black tracking-wider leading-tight">
              {order.access_code || '---'}
            </span>
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <h4 className="font-extrabold text-stone-900 text-sm truncate">
                {order.customer_name ? order.customer_name : 'Customer'}
              </h4>
              <StatusBadge status={order.status} size="sm" />
            </div>
            <span suppressHydrationWarning className="text-xs text-stone-500 block mt-0.5 truncate">
              Received at {formatDate(order.created_at)}
            </span>
          </div>
        </div>

        {/* Payment toggle */}
        <div className="flex items-center gap-2 self-start sm:self-center">
          <button
            type="button"
            onClick={() => onTogglePayment(order.id, order.is_paid)}
            className={`px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1 border cursor-pointer ${
              order.is_paid
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                : 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
            }`}
            title="Click to toggle payment status"
          >
            {order.is_paid ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Paid
              </>
            ) : (
              <>
                <Clock className="w-3.5 h-3.5 text-amber-600" /> Due
              </>
            )}
          </button>
        </div>
      </div>

      {/* Details Row */}
      <div className="grid grid-cols-3 gap-2 py-3 text-center text-xs">
        <div className="bg-stone-50 p-2 rounded-xl">
          <span className="text-stone-500 block text-[10px]">Weight</span>
          <span className="font-bold text-stone-900">{formatWeight(order.weight_kg)}</span>
        </div>
        <div className="bg-stone-50 p-2 rounded-xl">
          <span className="text-stone-500 block text-[10px]">Rate</span>
          <span className="font-bold text-stone-900">{currency} {Number(order.rate_per_kg).toFixed(0)}</span>
        </div>
        <div className="bg-amber-50/50 p-2 rounded-xl border border-amber-100">
          <span className="text-amber-800 block text-[10px]">Total</span>
          <span className="font-black text-amber-700">{formatPrice(order.total_price, currency)}</span>
        </div>
      </div>

      {/* Action Footer */}
      <div className="pt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onViewSlip(order)}
            className="p-2 text-stone-600 hover:text-amber-700 bg-stone-100 hover:bg-amber-50 rounded-xl transition flex items-center gap-1 text-xs font-semibold cursor-pointer"
            title="Show QR Code & Slip"
          >
            <QrCode className="w-4 h-4 text-amber-600" />
            <span className="hidden sm:inline">QR Slip</span>
          </button>

          <button
            type="button"
            onClick={() => onDeleteOrder(order.id)}
            className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
            title="Delete Order"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* Status Advance Button */}
        <div className="flex-1 sm:flex-initial flex justify-end">
          {isQueued && (
            <button
              type="button"
              onClick={() => onUpdateStatus(order.id, 'grinding')}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:scale-95 transition flex items-center justify-center gap-1.5 shadow-xs shadow-blue-500/20 cursor-pointer"
            >
              <Flame className="w-3.5 h-3.5" />
              Start Grinding
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isGrinding && (
            <button
              type="button"
              onClick={() => onUpdateStatus(order.id, 'ready')}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 active:scale-95 transition flex items-center justify-center gap-1.5 shadow-xs shadow-emerald-500/20 animate-pulse cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              Mark Ready for Pickup
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}

          {isReady && (
            <button
              type="button"
              onClick={() => onUpdateStatus(order.id, 'completed')}
              className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-bold text-white bg-stone-900 hover:bg-black active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              Complete & Handover
            </button>
          )}

          {isCompleted && (
            <span className="text-[11px] font-semibold text-stone-500 py-1 px-2 bg-stone-100 rounded-lg">
              Completed
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
