'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle2, Loader2, Sparkles, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

function TrackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  const orderId = searchParams.get('id');
  const accessCode = searchParams.get('code');

  useEffect(() => {
    async function verifyAndSave() {
      if (!orderId) {
        setStatus('error');
        setErrorMessage('Invalid order link. Missing order ID.');
        return;
      }

      try {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('orders')
          .select('id, token_number, status')
          .eq('id', orderId)
          .single();

        if (error || !data) {
          setStatus('error');
          setErrorMessage('Order not found or link has expired.');
          return;
        }

        // Save order ID to localStorage
        try {
          const stored = localStorage.getItem('chakki_customer_order_ids');
          let ids: string[] = stored ? JSON.parse(stored) : [];
          if (!ids.includes(data.id)) {
            ids = [data.id, ...ids];
            localStorage.setItem('chakki_customer_order_ids', JSON.stringify(ids));
          }
        } catch (e) {
          console.error(e);
        }

        setStatus('success');
        setTimeout(() => {
          router.replace('/');
        }, 1000);
      } catch (err: unknown) {
        console.error(err);
        setStatus('error');
        setErrorMessage('Failed to connect. Please try again.');
      }
    }

    verifyAndSave();
  }, [orderId, accessCode, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#faf8f5]">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-xl border border-amber-100 text-center space-y-5"
      >
        {status === 'verifying' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-stone-900">Verifying Order...</h2>
              <p className="text-xs text-stone-600">Connecting you to live chakki tracking</p>
            </div>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-stone-900">Order Added!</h2>
              <p className="text-xs text-stone-600">Redirecting to your live dashboard...</p>
            </div>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-200">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-lg font-bold text-stone-900">Unable to Track</h2>
              <p className="text-xs text-stone-600">{errorMessage}</p>
            </div>
            <button
              onClick={() => router.replace('/')}
              className="mt-3 w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-stone-900 text-white hover:bg-stone-800 transition"
            >
              Go to Dashboard
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#faf8f5]">
          <div className="w-10 h-10 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
        </div>
      }
    >
      <TrackContent />
    </Suspense>
  );
}
