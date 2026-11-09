'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Order, ShopSettings } from '@/types/database';
import { formatPrice } from '@/lib/utils';
import {
  X,
  Scale,
  User,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  DollarSign,
  AlertCircle,
  Pencil,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface NewOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ShopSettings | null;
  onOrderCreated: (order: Order) => void;
}

const PRESET_WEIGHTS = [5, 10, 15, 20, 25, 40];

export default function NewOrderModal({
  isOpen,
  onClose,
  settings,
  onOrderCreated,
}: NewOrderModalProps) {
  const defaultRate = Number(settings?.rate_per_kg || 0);
  const currency = settings?.currency || 'Rs.';

  const [step, setStep] = useState<1 | 2>(1);
  const [weight, setWeight] = useState<string>('10');
  const [isEditingRate, setIsEditingRate] = useState(false);
  const [customRate, setCustomRate] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [isPaid, setIsPaid] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const supabase = createClient();

  const effectiveRate =
    isEditingRate && customRate !== '' && !isNaN(parseFloat(customRate))
      ? Math.max(0, parseFloat(customRate))
      : defaultRate;

  const numWeight = parseFloat(weight) || 0;
  const totalPrice = numWeight * effectiveRate;

  const resetForm = () => {
    setStep(1);
    setWeight('10');
    setIsEditingRate(false);
    setCustomRate('');
    setCustomerName('');
    setIsPaid(false);
    setError(null);
    setLoading(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleNextStep = (e: React.FormEvent) => {
    e.preventDefault();
    if (numWeight <= 0) {
      setError('Please enter a valid weight in kg');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numWeight <= 0) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Get unique ephemeral 4-digit access code from Supabase function
      const { data: codeData, error: codeError } = await supabase.rpc(
        'generate_access_code'
      );
      if (codeError) throw codeError;

      const accessCode = codeData || Math.floor(1000 + Math.random() * 9000).toString();

      // 2. Insert order
      const { data: newOrder, error: insertError } = await supabase
        .from('orders')
        .insert({
          weight_kg: numWeight,
          rate_per_kg: effectiveRate,
          total_price: totalPrice,
          customer_name: customerName.trim() || null,
          status: 'queued',
          access_code: accessCode,
          is_paid: isPaid,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      resetForm();
      onOrderCreated(newOrder as Order);
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to create order';
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="w-full max-w-md rounded-3xl bg-white shadow-2xl border border-stone-200 overflow-hidden"
          >
            {/* Header */}
            <div className="p-5 border-b border-stone-100 flex items-center justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">
                  Step {step} of 2
                </span>
                <h3 className="text-lg font-black text-stone-900">
                  {step === 1 ? 'Enter Wheat Weight' : 'Customer & Payment'}
                </h3>
              </div>
              <button
                onClick={handleClose}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="m-4 mb-0 flex items-center gap-2 p-3 bg-rose-50 text-rose-700 text-xs rounded-xl border border-rose-200">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Step 1: Weight */}
            {step === 1 && (
              <form onSubmit={handleNextStep} className="p-6 space-y-6">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-2">
                    Total Weight of Received Wheat (kg)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="1000"
                      required
                      autoFocus
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="10"
                      className="w-full px-4 py-4 text-center text-4xl font-extrabold text-stone-900 bg-stone-50 border-2 border-stone-200 rounded-2xl focus:border-amber-500 focus:outline-none transition"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">
                      KG
                    </span>
                  </div>

                  {/* Preset Quick Chips */}
                  <div className="flex flex-wrap gap-2 mt-3 justify-center">
                    {PRESET_WEIGHTS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setWeight(preset.toString())}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold transition border ${
                          parseFloat(weight) === preset
                            ? 'bg-amber-600 text-white border-amber-600 shadow-sm'
                            : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
                        }`}
                      >
                        {preset} kg
                      </button>
                    ))}
                  </div>
                </div>

                {/* Live Calculated Price Summary with Optional Rate Override */}
                <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold text-amber-900/80">
                          Rate: {currency} {effectiveRate.toFixed(0)} / kg
                        </span>
                        {isEditingRate && effectiveRate !== defaultRate && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 text-amber-900">
                            Custom
                          </span>
                        )}
                        {!isEditingRate && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditingRate(true);
                              setCustomRate(defaultRate.toString());
                            }}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold text-amber-800 hover:text-amber-950 hover:bg-amber-200/70 transition cursor-pointer"
                            title="Override rate for this order"
                          >
                            <Pencil className="w-2.5 h-2.5" />
                            <span>Edit</span>
                          </button>
                        )}
                      </div>
                      <span className="block text-xs font-medium text-stone-600 mt-0.5">
                        Calculated Total:
                      </span>
                    </div>
                    <span className="text-2xl font-black text-amber-700">
                      {formatPrice(totalPrice, currency)}
                    </span>
                  </div>

                  {/* Inline Rate Edit Field (revealed when Edit is clicked) */}
                  {isEditingRate && (
                    <div className="pt-2.5 border-t border-amber-200/60 space-y-2">
                      <div className="flex items-center justify-between text-[11px] font-semibold text-stone-700">
                        <span>Custom Rate for this order:</span>
                        <button
                          type="button"
                          onClick={() => {
                            setIsEditingRate(false);
                            setCustomRate('');
                          }}
                          className="inline-flex items-center gap-1 text-[10px] font-bold text-stone-500 hover:text-amber-800 transition cursor-pointer"
                        >
                          <RotateCcw className="w-2.5 h-2.5" />
                          <span>Reset to default ({currency} {defaultRate.toFixed(0)})</span>
                        </button>
                      </div>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-500">
                          {currency}
                        </span>
                        <input
                          type="number"
                          step="1"
                          min="0"
                          max="10000"
                          value={customRate}
                          onChange={(e) => setCustomRate(e.target.value)}
                          placeholder={defaultRate.toString()}
                          autoFocus
                          className="w-full pl-10 pr-14 py-2 text-sm font-bold text-stone-900 bg-white border border-amber-300 rounded-xl focus:border-amber-500 focus:outline-none transition shadow-2xs"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-stone-400">
                          / kg
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.98] transition shadow-md shadow-amber-600/20 flex items-center justify-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
            )}

            {/* Step 2: Customer Name & Payment */}
            {step === 2 && (
              <form onSubmit={handleCreateOrder} className="p-6 space-y-5">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1.5">
                    Customer Name <span className="text-stone-400 font-normal">(Optional)</span>
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      autoFocus
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="e.g. Ahmed or leave blank"
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-stone-200 text-sm focus:border-amber-500 focus:outline-none transition bg-stone-50/50"
                    />
                  </div>
                </div>

                {/* Payment Status Toggle */}
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-2">
                    Payment Status
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setIsPaid(false)}
                      className={`p-3 rounded-xl text-xs font-bold border transition text-center ${
                        !isPaid
                          ? 'bg-amber-50 border-amber-400 text-amber-900 ring-1 ring-amber-400'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      Pay on Pickup
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsPaid(true)}
                      className={`p-3 rounded-xl text-xs font-bold border transition text-center ${
                        isPaid
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 ring-1 ring-emerald-500'
                          : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'
                      }`}
                    >
                      Cash Paid Upfront
                    </button>
                  </div>
                </div>

                {/* Quick Order Review */}
                <div className="p-3.5 rounded-2xl bg-stone-50 border border-stone-200 text-xs space-y-1.5">
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">Weight:</span>
                    <span className="font-bold text-stone-900">{numWeight} kg</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-stone-500">Rate:</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-stone-900">
                        {currency} {effectiveRate.toFixed(0)} / kg
                      </span>
                      {effectiveRate !== defaultRate && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">
                          Custom
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-1 border-t border-stone-200/60">
                    <span className="text-stone-600 font-medium">Total Due:</span>
                    <span className="font-black text-amber-700 text-sm">{formatPrice(totalPrice, currency)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="py-3 px-4 rounded-xl font-bold text-xs text-stone-700 bg-stone-100 hover:bg-stone-200 transition flex items-center gap-1.5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </button>

                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-3 px-4 rounded-xl font-bold text-sm text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.98] transition shadow-md shadow-amber-600/20 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Generating Token...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        Create & Generate QR
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
