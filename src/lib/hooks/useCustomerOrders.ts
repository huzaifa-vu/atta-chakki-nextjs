'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Order, ShopSettings } from '@/types/database';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'chakki_customer_order_ids';

// Synchronous helper: extracts IDs from localStorage AND instant URL query (?track= or ?id=)
function getInitialOrderIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const params = new URLSearchParams(window.location.search);
    const trackId = params.get('track') || params.get('id');
    const stored = localStorage.getItem(STORAGE_KEY);
    let ids: string[] = stored ? JSON.parse(stored) : [];
    if (!Array.isArray(ids)) ids = [];

    if (trackId && !ids.includes(trackId)) {
      ids = [trackId, ...ids];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    }

    // Clean URL query params silently without causing a re-render or reload
    if (trackId) {
      window.history.replaceState({}, '', window.location.pathname);
    }

    return ids;
  } catch {
    return [];
  }
}

export function useCustomerOrders() {
  const [orderIds, setOrderIds] = useState<string[]>(getInitialOrderIds);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const previousStatusMap = useRef<Record<string, string>>({});
  const supabase = createClient();

  // Save order IDs whenever updated
  const saveOrderIds = useCallback((newIds: string[]) => {
    setOrderIds(newIds);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newIds));
    } catch (e) {
      console.error('Failed to save orders to localStorage', e);
    }
  }, []);

  // Add an order ID to saved list
  const addOrderId = useCallback((id: string) => {
    setOrderIds((prev) => {
      if (!prev.includes(id)) {
        const updated = [id, ...prev];
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        } catch (e) {
          console.error(e);
        }
        return updated;
      }
      return prev;
    });
  }, []);

  // Remove an order ID from saved list
  const removeOrderId = useCallback((id: string) => {
    setOrderIds((prev) => {
      const updated = prev.filter((item) => item !== id);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      } catch (e) {
        console.error(e);
      }
      return updated;
    });
  }, []);

  // Fire celebratory confetti when an order becomes ready
  const triggerCelebration = useCallback(() => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#F59E0B', '#D97706', '#10B981', '#3B82F6'],
      });
    } catch {
      // Ignored if confetti fails
    }
  }, []);

  // High-performance parallel fetch for settings and orders
  const fetchData = useCallback(
    async (ids: string[]) => {
      try {
        const settingsPromise = supabase
          .from('shop_settings')
          .select('*')
          .limit(1)
          .single();

        const ordersPromise =
          ids.length > 0
            ? supabase
                .from('orders')
                .select('*')
                .in('id', ids)
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] as Order[], error: null });

        const [settingsRes, ordersRes] = await Promise.all([settingsPromise, ordersPromise]);

        if (settingsRes.data) {
          setSettings(settingsRes.data as ShopSettings);
        }

        if (ordersRes.data) {
          ordersRes.data.forEach((ord: Order) => {
            const prevStatus = previousStatusMap.current[ord.id];
            if (prevStatus && prevStatus !== 'ready' && ord.status === 'ready') {
              triggerCelebration();
            }
            previousStatusMap.current[ord.id] = ord.status;
          });
          setOrders(ordersRes.data as Order[]);
        }
      } catch (err) {
        console.error('Error fetching customer data:', err);
      } finally {
        setLoading(false);
      }
    },
    [supabase, triggerCelebration]
  );

  // Initial mount & updates when orderIds change
  useEffect(() => {
    fetchData(orderIds);
  }, [orderIds, fetchData]);

  // Supabase Realtime Subscription for instant live updates
  useEffect(() => {
    const channel = supabase
      .channel('customer-orders-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          if (payload.eventType === 'UPDATE') {
            const updated = payload.new as Order;
            setOrders((prev) =>
              prev.map((ord) => {
                if (ord.id === updated.id) {
                  if (ord.status !== 'ready' && updated.status === 'ready') {
                    triggerCelebration();
                  }
                  return updated;
                }
                return ord;
              })
            );
          } else if (payload.eventType === 'INSERT') {
            const inserted = payload.new as Order;
            setOrders((prev) => {
              if (orderIds.includes(inserted.id)) {
                return [inserted, ...prev.filter((o) => o.id !== inserted.id)];
              }
              return prev;
            });
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'shop_settings' },
        (payload) => {
          if (payload.new) {
            setSettings(payload.new as ShopSettings);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, orderIds, triggerCelebration]);

  const activeOrders = orders.filter((o) => o.status !== 'completed');
  const pastOrders = orders.filter((o) => o.status === 'completed');

  return {
    orders,
    activeOrders,
    pastOrders,
    settings,
    loading,
    addOrderId,
    removeOrderId,
    saveOrderIds,
    refetch: () => fetchData(orderIds),
  };
}
