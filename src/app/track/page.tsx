'use client';

import { Suspense, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

function TrackContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const orderId = searchParams.get('id') || searchParams.get('track');

  useEffect(() => {
    if (orderId) {
      try {
        const stored = localStorage.getItem('chakki_customer_order_ids');
        let ids: string[] = stored ? JSON.parse(stored) : [];
        if (!ids.includes(orderId)) {
          ids = [orderId, ...ids];
          localStorage.setItem('chakki_customer_order_ids', JSON.stringify(ids));
        }
      } catch (e) {
        console.error(e);
      }
      // Instant zero-delay handoff to dashboard with order loaded
      router.replace(`/?track=${orderId}`);
    } else {
      router.replace('/');
    }
  }, [orderId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#faf8f5]">
      <div className="flex items-center gap-3 text-stone-600 font-semibold text-sm">
        <Loader2 className="w-5 h-5 animate-spin text-amber-600" />
        <span>Loading live tracker...</span>
      </div>
    </div>
  );
}

export default function TrackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center p-4 bg-[#faf8f5]">
          <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
        </div>
      }
    >
      <TrackContent />
    </Suspense>
  );
}
