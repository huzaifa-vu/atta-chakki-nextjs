'use client';

import { OrderStatus } from '@/types/database';
import { Check, Clock, Flame, ShoppingBag, Sparkles, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface OrderStepperProps {
  status: OrderStatus;
}

interface StepConfig {
  key: OrderStatus;
  shortLabel: string;
  badgeLabel: string;
  headline: string;
  subtext: string;
  icon: React.ElementType;
}

const STEPS: StepConfig[] = [
  {
    key: 'queued',
    shortLabel: 'Queued',
    badgeLabel: 'Stage 1 of 4',
    headline: 'Wheat Weighed & Queued',
    subtext: 'Your wheat is logged and waiting for the stone mill',
    icon: Clock,
  },
  {
    key: 'grinding',
    shortLabel: 'Grinding',
    badgeLabel: 'Stage 2 of 4',
    headline: 'Fresh Stone Grinding',
    subtext: 'Currently grinding fresh on traditional stone chakki',
    icon: Flame,
  },
  {
    key: 'ready',
    shortLabel: 'Ready',
    badgeLabel: 'Stage 3 of 4',
    headline: 'Ready for Pickup!',
    subtext: 'Your fresh atta is packed and ready at the counter',
    icon: ShoppingBag,
  },
  {
    key: 'completed',
    shortLabel: 'Picked Up',
    badgeLabel: 'Stage 4 of 4',
    headline: 'Order Completed',
    subtext: 'Flour picked up and collected. Thank you!',
    icon: CheckCircle2,
  },
];

const STATUS_INDEX: Record<OrderStatus, number> = {
  queued: 0,
  grinding: 1,
  ready: 2,
  completed: 3,
};

export default function OrderStepper({ status }: OrderStepperProps) {
  const currentIndex = STATUS_INDEX[status] ?? 0;
  const currentStep = STEPS[currentIndex] || STEPS[0];
  const CurrentIcon = currentStep.icon;

  const isQueued = status === 'queued';
  const isGrinding = status === 'grinding';
  const isReady = status === 'ready';
  const isCompleted = status === 'completed';

  return (
    <div className="w-full space-y-3.5">
      {/* 1. Modern Segmented Progress Bar (Instagram Stories / Apple style) */}
      <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
        {STEPS.map((step, idx) => {
          const isDone = idx < currentIndex;
          const isCurrent = idx === currentIndex;

          return (
            <div key={step.key} className="space-y-1.5">
              {/* Segmented Capsule Bar */}
              <div
                className={`h-2 sm:h-2.5 rounded-full overflow-hidden relative transition-all duration-500 ${
                  isDone
                    ? 'bg-emerald-600'
                    : isCurrent
                    ? isReady
                      ? 'bg-emerald-500'
                      : 'bg-amber-500'
                    : 'bg-stone-200/90'
                }`}
              >
                {/* Active Animated Shimmer / Pulse */}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                    animate={{ x: ['-100%', '200%'] }}
                    transition={{
                      repeat: Infinity,
                      duration: 1.8,
                      ease: 'easeInOut',
                    }}
                  />
                )}
              </div>

              {/* Step Mini Label */}
              <div className="flex items-center justify-center gap-1">
                {isDone ? (
                  <Check className="w-3 h-3 text-emerald-600 stroke-[3]" />
                ) : isCurrent ? (
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      isReady ? 'bg-emerald-500 animate-ping' : 'bg-amber-500 animate-ping'
                    }`}
                  />
                ) : null}
                <span
                  className={`text-[10px] sm:text-[11px] font-bold tracking-tight text-center truncate ${
                    isCurrent
                      ? 'text-stone-900 font-extrabold'
                      : isDone
                      ? 'text-emerald-700'
                      : 'text-stone-600'
                  }`}
                >
                  {step.shortLabel}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 2. Hero Active Status Spotlight Card */}
      <motion.div
        layout
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className={`p-4 sm:p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden ${
          isReady
            ? 'bg-gradient-to-br from-emerald-50 to-teal-50/60 border-emerald-300 shadow-sm shadow-emerald-500/10'
            : isGrinding
            ? 'bg-gradient-to-br from-amber-50 via-orange-50/40 to-amber-50/60 border-amber-300 shadow-sm shadow-amber-500/10'
            : isCompleted
            ? 'bg-stone-50 border-stone-200'
            : 'bg-stone-50/80 border-stone-200'
        }`}
      >
        <div className="flex items-center justify-between gap-3 relative z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            {/* Dynamic Animated Icon Avatar */}
            <div
              className={`w-12 h-12 sm:w-13 sm:h-13 rounded-2xl flex items-center justify-center shrink-0 shadow-md transition-all ${
                isReady
                  ? 'bg-emerald-600 text-white shadow-emerald-600/30 ring-4 ring-emerald-100 animate-bounce'
                  : isGrinding
                  ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white shadow-amber-500/30 ring-4 ring-amber-100'
                  : isCompleted
                  ? 'bg-stone-800 text-white shadow-stone-800/20'
                  : 'bg-stone-200 text-stone-700'
              }`}
            >
              {isGrinding ? (
                <motion.div
                  animate={{ scale: [1, 1.15, 1], rotate: [-2, 2, -2] }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: 'easeInOut' }}
                >
                  <CurrentIcon className="w-6 h-6 stroke-[2.5]" />
                </motion.div>
              ) : isReady ? (
                <CurrentIcon className="w-6 h-6 stroke-[2.5]" />
              ) : (
                <CurrentIcon className="w-6 h-6 stroke-[2]" />
              )}
            </div>

            {/* Stage Text & Details */}
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                    isReady
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : isGrinding
                      ? 'bg-amber-100 text-amber-800 border border-amber-200'
                      : isCompleted
                      ? 'bg-stone-200 text-stone-700'
                      : 'bg-stone-200 text-stone-700'
                  }`}
                >
                  {currentStep.badgeLabel}
                </span>

                {isGrinding && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                    Chakki Running
                  </span>
                )}
                {isReady && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    Ready for Collection
                  </span>
                )}
              </div>

              <h4 className="text-base sm:text-lg font-black text-stone-900 tracking-tight leading-snug mt-1">
                {currentStep.headline}
              </h4>
              <p className="text-xs text-stone-600 font-medium leading-relaxed mt-0.5 line-clamp-1 sm:line-clamp-none">
                {currentStep.subtext}
              </p>
            </div>
          </div>

          {/* Right Status Indicator */}
          <div className="shrink-0 hidden xs:block sm:block">
            {isGrinding && (
              <div className="bg-white/80 border border-amber-200 rounded-xl px-3 py-1.5 text-center shadow-2xs">
                <span className="block text-[9px] font-bold text-amber-800 uppercase tracking-wider">
                  Mill Status
                </span>
                <span className="block text-xs font-black text-amber-600">
                  Grinding
                </span>
              </div>
            )}
            {isReady && (
              <div className="bg-emerald-600 text-white rounded-xl px-3 py-1.5 text-center shadow-xs">
                <span className="block text-[9px] font-bold text-emerald-100 uppercase tracking-wider">
                  Counter
                </span>
                <span className="block text-xs font-black">
                  Ready
                </span>
              </div>
            )}
            {isQueued && (
              <div className="bg-white/80 border border-stone-200 rounded-xl px-3 py-1.5 text-center shadow-2xs">
                <span className="block text-[9px] font-bold text-stone-500 uppercase tracking-wider">
                  Status
                </span>
                <span className="block text-xs font-black text-stone-700">
                  In Queue
                </span>
              </div>
            )}
            {isCompleted && (
              <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl px-3 py-1.5 text-center shadow-2xs">
                <span className="block text-[9px] font-bold uppercase tracking-wider">
                  Order
                </span>
                <span className="block text-xs font-black">
                  Done
                </span>
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
