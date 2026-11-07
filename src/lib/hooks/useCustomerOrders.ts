'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Order, ShopSettings } from '@/types/database';
import confetti from 'canvas-confetti';

const STORAGE_KEY = 'chakki_customer_order_ids';

export function useCustomerOrders() {
  const [orderIds, setOrderIds] = useState<string[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<ShopSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const previousStatusMap = useRef<Record<string, string>>({});
  const supabase = createClient();

  // Load saved order IDs from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setOrderIds(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to parse saved orders', e);
    }
  }, []);

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

  // Fetch shop settings
  const fetchSettings = useCallback(async () => {
    const { data } = await supabase
      .from('shop_settings')
      .select('*')
      .limit(1)
      .single();
    if (data) {
      setSettings(data);
    }
  }, [supabase]);

  // Fetch orders matching orderIds
  const fetchOrders = useCallback(async (ids: string[]) => {
    if (ids.length === 0) {
      setOrders([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false });

    if (!error && data) {
      // Check if any order transitioned to 'ready'
      data.forEach((ord: Order) => {
        const prevStatus = previousStatusMap.current[ord.id];
        if (prevStatus && prevStatus !== 'ready' && ord.status === 'ready') {
          triggerCelebration();
        }
        previousStatusMap.current[ord.id] = ord.status;
      });

      setOrders(data);
    }
    setLoading(false);
  }, [supabase, triggerCelebration]);

  // Initial load
  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    fetchOrders(orderIds);
  }, [orderIds, fetchOrders]);

  // Supabase Realtime Subscription for instant updates
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
    refetch: () => fetchOrders(orderIds),
  };
}
