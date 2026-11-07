'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Order } from '@/types/database';
import { X, Search, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CodeLookupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderFound: (order: Order) => void;
}

export default function CodeLookupModal({
  isOpen,
  onClose,
  onOrderFound,
}: CodeLookupModalProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const supabase = createClient();

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = code.trim();
    if (!cleanCode) return;

    setLoading(true);
    setError(null);

    try {
      // First try matching access_code (4-digit PIN)
      let query = supabase
        .from('orders')
        .select('*')
        .eq('access_code', cleanCode)
        .neq('status', 'completed')
        .limit(1);

      let { data, error: dbError } = await query;

      // If not found and input is numeric, also check token_number
      if ((!data || data.length === 0) && !isNaN(Number(cleanCode))) {
        const tokenQuery = await supabase
          .from('orders')
          .select('*')
          .eq('token_number', Number(cleanCode))
          .limit(1);
        if (tokenQuery.data && tokenQuery.data.length > 0) {
          data = tokenQuery.data;
        }
      }

      if (dbError) throw dbError;

      if (!data || data.length === 0) {
        setError('No active order found with this code. Please verify your receipt.');
        setLoading(false);
        return;
      }

      const foundOrder = data[0] as Order;
      setSuccess(true);
      setTimeout(() => {
        onOrderFound(foundOrder);
        setCode('');
        setSuccess(false);
        setLoading(false);
        onClose();
      }, 700);
    } catch (err: unknown) {
      console.error(err);
      setError('Something went wrong checking the code. Please try again.');
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl border border-stone-100"
          >
            <div className="flex items-center justify-between pb-3 border-b border-stone-100">
              <h2 className="text-base font-bold text-stone-900 flex items-center gap-2">
                <Search className="w-4 h-4 text-amber-600" />
                Track by 4-Digit PIN
              </h2>
              <button
                onClick={onClose}
                className="p-1.5 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleLookup} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-stone-600 mb-1.5">
                  Enter 4-Digit PIN
                </label>
                <input
                  type="text"
                  maxLength={4}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="e.g. 9457"
                  autoFocus
                  className="w-full px-4 py-3 text-center text-2xl font-mono font-bold tracking-widest rounded-2xl border-2 border-stone-200 focus:border-amber-500 focus:outline-none transition text-stone-900 bg-stone-50"
                />
                <p className="text-[11px] text-stone-600 text-center mt-1.5">
                  Printed directly on your order slip
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-rose-600 text-xs bg-rose-50 p-3 rounded-xl border border-rose-200">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div className="flex items-center justify-center gap-2 text-emerald-700 text-xs bg-emerald-50 p-3 rounded-xl border border-emerald-200 font-semibold">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Order found! Adding to dashboard...</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading || code.trim().length === 0}
                className="w-full py-3.5 px-4 rounded-xl font-bold text-sm text-white bg-amber-600 hover:bg-amber-700 active:scale-[0.98] transition shadow-md shadow-amber-600/20 disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Finding Order...
                  </>
                ) : (
                  'Track Order'
                )}
              </button>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
