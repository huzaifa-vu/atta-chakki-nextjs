'use client';

import { X, QrCode, KeyRound, Wheat } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface AddOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectScan: () => void;
  onSelectPin: () => void;
}

export default function AddOrderModal({
  isOpen,
  onClose,
  onSelectScan,
  onSelectPin,
}: AddOrderModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-stone-100 space-y-5"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center">
                  <Wheat className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-extrabold text-stone-900 text-sm">
                    Add Another Wheat Bag
                  </h3>
                  <p className="text-[11px] text-stone-500">Track multiple orders together</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3 pt-1">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectScan();
                }}
                className="w-full p-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold text-xs sm:text-sm flex items-center gap-3 shadow-md shadow-amber-500/20 active:scale-[0.98] transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-extrabold text-sm">Scan QR Code</div>
                  <div className="text-[11px] text-amber-100 font-normal">
                    Use your phone camera on order slip
                  </div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSelectPin();
                }}
                className="w-full p-4 rounded-2xl bg-stone-50 hover:bg-stone-100 border border-stone-200 text-stone-900 font-bold text-xs sm:text-sm flex items-center gap-3 active:scale-[0.98] transition cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-stone-200/70 text-stone-700 flex items-center justify-center shrink-0">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="font-extrabold text-sm">Enter 4-Digit PIN</div>
                  <div className="text-[11px] text-stone-500 font-normal">
                    Type the code printed on your slip
                  </div>
                </div>
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
