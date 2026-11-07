'use client';

import { OrderStatus } from '@/types/database';
import { Clock, Flame, ShoppingBag, Check } from 'lucide-react';

interface StatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md';
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const isSm = size === 'sm';

  switch (status) {
    case 'queued':
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold text-amber-800 bg-amber-100/80 border border-amber-200/80 rounded-lg ${
            isSm ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <Clock className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          In Queue
        </span>
      );
    case 'grinding':
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold text-blue-800 bg-blue-100/80 border border-blue-200/80 rounded-lg animate-pulse ${
            isSm ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <Flame className={isSm ? 'w-3 h-3 text-blue-600' : 'w-3.5 h-3.5 text-blue-600'} />
          Grinding
        </span>
      );
    case 'ready':
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold text-emerald-800 bg-emerald-100/90 border border-emerald-300 rounded-lg ring-1 ring-emerald-300 ${
            isSm ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <ShoppingBag className={isSm ? 'w-3 h-3 text-emerald-600' : 'w-3.5 h-3.5 text-emerald-600'} />
          Ready for Pickup
        </span>
      );
    case 'completed':
      return (
        <span
          className={`inline-flex items-center gap-1 font-bold text-stone-600 bg-stone-100 border border-stone-200 rounded-lg ${
            isSm ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs'
          }`}
        >
          <Check className={isSm ? 'w-3 h-3' : 'w-3.5 h-3.5'} />
          Completed
        </span>
      );
  }
}
